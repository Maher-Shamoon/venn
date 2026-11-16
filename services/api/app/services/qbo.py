"""QuickBooks Online (read-only OAuth). Open invoices become venn invoices; venn never writes to QuickBooks.

Shortcuts, stated plainly:
- Only unpaid invoices are read. An invoice that was partly paid in QuickBooks arrives with its remaining balance as its total, and the original total
  is kept in its description, because venn's own balances must equal its own payment records. Payments are not read (use the bank or Stripe).
- An invoice that venn has already applied money to is never overwritten by a later sync.
- Intuit rotates the refresh token on every use; the new one is stored each time.
"""

import base64
import json
import secrets
import uuid
from datetime import date
from decimal import Decimal
from typing import Any
from urllib.parse import urlencode

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.requestinfo import RequestInfo
from app.core.secrets import read_state, seal, sign_state, unseal
from app.core.security import AuthUser
from app.services import audit

AUTHORIZE = "https://appcenter.intuit.com/connect/oauth2"
TOKEN = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer"  # noqa: S105  # a URL, not a password
SCOPE = "com.intuit.quickbooks.accounting"
PAGE = 100
MAX_PAGES = 10  # shortcut: 1,000 invoices a sync, raise when a company needs more


def configured() -> bool:
    c = get_settings()
    return bool(c.qbo_client_id and c.qbo_client_secret and c.secrets_key)


def start(org: uuid.UUID, actor: AuthUser) -> str:
    c = get_settings()
    if not configured():
        raise ApiError(503, "not_configured", "QuickBooks is not configured on this server.")
    q = {"client_id": c.qbo_client_id, "redirect_uri": c.qbo_redirect_uri, "response_type": "code", "scope": SCOPE, "state": sign_state(f"quickbooks:{org}:{actor.id}:{secrets.token_urlsafe(12)}")}
    return f"{AUTHORIZE}?{urlencode(q)}"


def _token(grant: dict[str, str]) -> dict[str, Any]:
    c = get_settings()
    basic = base64.b64encode(f"{c.qbo_client_id}:{c.qbo_client_secret}".encode()).decode()
    r = httpx.post(TOKEN, data=grant, headers={"Authorization": f"Basic {basic}", "Accept": "application/json"}, timeout=20)
    if r.status_code >= 400:
        raise ApiError(409, "reconnect", "QuickBooks refused the connection. Connect it again.")
    return dict(r.json())


def finish(code: str, state: str, realm: str) -> tuple[uuid.UUID, uuid.UUID, str, str]:
    provider, org, user, _ = read_state(state).split(":")
    if provider != "quickbooks":
        raise ApiError(400, "bad_request", "The sign-in link is not valid.")
    t = _token({"grant_type": "authorization_code", "code": code, "redirect_uri": get_settings().qbo_redirect_uri})
    if not realm.isdigit() or not t.get("refresh_token"):
        raise ApiError(409, "reconnect", "QuickBooks did not return a company. Connect again.")
    return uuid.UUID(org), uuid.UUID(user), str(t["refresh_token"]), realm


def store(db: Session, org: uuid.UUID, user: uuid.UUID, refresh: str, realm: str) -> None:
    label = f"company {realm} ({get_settings().qbo_env})"
    db.execute(text("insert into integrations (organization_id, provider, secret_enc, account_label, connected_by) values (:o, 'quickbooks', :s, :l, :u) "
                    "on conflict (organization_id, provider) do update set secret_enc = :s, account_label = :l, status = 'connected', last_error = null, connected_by = :u, connected_at = now()"),
               {"o": org, "s": seal(json.dumps({"refresh": refresh, "realm": realm})), "l": label, "u": user})
    audit.record(db, org, "integration.connected", actor_id=user, record_type="integration", record_id="quickbooks")


def _api(db: Session, realm: str, access: str, query: str) -> list[dict[str, Any]]:
    host = "https://sandbox-quickbooks.api.intuit.com" if get_settings().qbo_env != "production" else "https://quickbooks.api.intuit.com"
    r = httpx.get(f"{host}/v3/company/{realm}/query", params={"query": query, "minorversion": "70"}, headers={"Authorization": f"Bearer {access}", "Accept": "application/json"}, timeout=30)
    if r.status_code in (401, 403):
        raise ApiError(409, "reconnect", "QuickBooks refused access. Connect it again.")
    if r.status_code >= 400:
        raise ApiError(502, "provider_unreachable", "QuickBooks could not be read right now. Try again.")
    body = r.json().get("QueryResponse", {})
    rows = body.get("Invoice", [])
    return list(rows)


def _access(db: Session) -> tuple[str, str]:
    row = db.execute(text("select secret_enc from integrations where provider = 'quickbooks'")).first()
    if row is None:
        raise ApiError(409, "invalid_state", "QuickBooks is not connected.")
    s = json.loads(unseal(row.secret_enc))
    try:
        t = _token({"grant_type": "refresh_token", "refresh_token": s["refresh"]})
    except ApiError:
        db.execute(text("update integrations set status = 'error', last_error = 'The QuickBooks login expired. Connect again.' where provider = 'quickbooks'"))
        db.commit()
        raise
    s["refresh"] = t.get("refresh_token", s["refresh"])
    db.execute(text("update integrations set secret_enc = :s where provider = 'quickbooks'"), {"s": seal(json.dumps(s))})
    return str(t["access_token"]), str(s["realm"])


def _customer(db: Session, org: uuid.UUID, inv: dict[str, Any], cache: dict[str, uuid.UUID]) -> uuid.UUID:
    ref = inv.get("CustomerRef") or {}
    ext, name = str(ref.get("value", "")), str(ref.get("name", "")).strip() or "QuickBooks customer"
    if ext in cache:
        return cache[ext]
    found = db.execute(text("select id from customers where (source = 'quickbooks' and external_id = :e) or lower(name) = lower(:n) order by (source = 'quickbooks') desc limit 1"), {"e": ext, "n": name}).scalar()
    if found is None:
        email = ((inv.get("BillEmail") or {}).get("Address")) or None
        found = db.execute(text("insert into customers (organization_id, name, contact_email, source, external_id) values (:o, :n, :e, 'quickbooks', :x) returning id"), {"o": org, "n": name, "e": email, "x": ext}).scalar_one()
    cache[ext] = found
    return found  # type: ignore[no-any-return]


def sync(db: Session, org: uuid.UUID, actor: AuthUser, info: RequestInfo) -> dict[str, Any]:
    access, realm = _access(db)
    default_cur = str(db.execute(text("select default_currency from organizations")).scalar_one()).strip()
    cache: dict[str, uuid.UUID] = {}
    seen = new = updated = skipped = 0
    for page in range(MAX_PAGES):
        start_at, size = page * PAGE + 1, PAGE  # integers only: they are the only parts of the query text that vary
        rows = _api(db, realm, access, f"select * from Invoice where Balance > '0' order by Id startposition {start_at} maxresults {size}")  # noqa: S608
        for q in rows:
            seen += 1
            balance = Decimal(str(q.get("Balance", 0)))
            total = Decimal(str(q.get("TotalAmt", 0)))
            number = str(q.get("DocNumber") or f"QB-{q['Id']}").strip()
            issue = date.fromisoformat(q.get("TxnDate") or date.today().isoformat())
            due = date.fromisoformat(q.get("DueDate") or issue.isoformat())
            if balance <= 0 or due < issue:
                skipped += 1
                continue
            cur = str((q.get("CurrencyRef") or {}).get("value") or default_cur)[:3].upper()
            note = f"From QuickBooks invoice {number}." + (f" Original total {total:.2f}; {total - balance:.2f} already paid in QuickBooks." if total != balance else "")
            existing = db.execute(text("select id, total_amount, amount_paid, amount_adjusted, lifecycle_status from invoices where source = 'quickbooks' and external_id = :x for update"), {"x": str(q["Id"])}).first()
            if existing is None:
                if db.execute(text("select 1 from invoices where lower(invoice_number) = lower(:n)"), {"n": number}).first():
                    skipped += 1  # an invoice with this number is already here (for example from a CSV)
                    continue
                db.execute(text("insert into invoices (organization_id, customer_id, invoice_number, issue_date, due_date, currency, total_amount, balance_due, description, source, external_id) "
                                "values (:o, :c, :n, :i, :d, :cur, :t, :t, :ds, 'quickbooks', :x)"), {"o": org, "c": _customer(db, org, q, cache), "n": number, "i": issue, "d": due, "cur": cur, "t": balance, "ds": note, "x": str(q["Id"])})
                new += 1
            elif existing.lifecycle_status == "issued" and existing.amount_paid == 0 and existing.amount_adjusted == 0 and existing.total_amount != balance:
                db.execute(text("update invoices set total_amount = :t, balance_due = :t, description = :ds, version = version + 1, updated_at = now() where id = :i"), {"t": balance, "ds": note, "i": existing.id})
                updated += 1
        if len(rows) < PAGE:
            break
    db.execute(text("update integrations set last_sync_at = now(), last_error = null, status = 'connected' where provider = 'quickbooks'"))
    audit.record(db, org, "integration.synced", actor_id=actor.id, record_type="integration", record_id="quickbooks", after={"seen": seen, "new": new, "updated": updated, "skipped": skipped}, info=info)
    return {"seen": seen, "new": new, "updated": updated, "skipped": skipped}
