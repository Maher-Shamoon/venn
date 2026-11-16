"""Connected sources (MOD-17): Stripe (read-only key) and Gmail (read-only OAuth). Each organization connects its own account; the secrets are
encrypted in the database and never sent back. Stripe charges become payments marked source-verified; Gmail is only searched on demand and a message
becomes evidence only when a person links it. venn never writes to either service.

Shortcuts: Gmail apps in Google's Testing mode make the login expire after 7 days (connect again); QuickBooks needs Intuit app credentials that are
not configured, so it is listed as unavailable.
"""

import json
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any
from urllib.parse import urlencode

import httpx
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.money import currency_digits
from app.core.requestinfo import RequestInfo
from app.core.secrets import read_state, seal, sign_state, unseal
from app.core.security import AuthUser
from app.services import audit

PROVIDERS = {"stripe": "Stripe", "gmail": "Gmail", "quickbooks": "QuickBooks Online"}
GMAIL_SCOPE = "openid email https://www.googleapis.com/auth/gmail.readonly"


def _row(db: Session, provider: str) -> Any:
    return db.execute(text("select id, status, secret_enc, account_label, connected_at, last_sync_at, last_error from integrations where provider = :p"), {"p": provider}).first()


def list_status(db: Session) -> list[dict[str, Any]]:
    c = get_settings()
    out = []
    for key, name in PROVIDERS.items():
        r = _row(db, key)
        available = key == "stripe" or (key == "gmail" and bool(c.google_client_id and c.google_client_secret)) or (key == "quickbooks" and bool(c.qbo_client_id and c.qbo_client_secret))
        out.append({"provider": key, "name": name, "available": bool(available) and bool(c.secrets_key), "connected": r is not None, "status": r.status if r else "not_connected",
                    "account": r.account_label if r else None, "connected_at": r.connected_at if r else None, "last_sync_at": r.last_sync_at if r else None, "last_error": r.last_error if r else None})
    return out


def _store(db: Session, org: uuid.UUID, provider: str, secret: str, label: str, actor: uuid.UUID | None) -> None:
    db.execute(text("insert into integrations (organization_id, provider, secret_enc, account_label, connected_by) values (:o, :p, :s, :l, :u) "
                    "on conflict (organization_id, provider) do update set secret_enc = :s, account_label = :l, status = 'connected', last_error = null, connected_by = :u, connected_at = now()"),
               {"o": org, "p": provider, "s": seal(secret), "l": label, "u": actor})


def disconnect(db: Session, org: uuid.UUID, actor: AuthUser, provider: str, info: RequestInfo) -> None:
    if provider not in PROVIDERS or not db.execute(text("delete from integrations where provider = :p returning id"), {"p": provider}).first():
        raise ApiError(404, "not_found", "That connection does not exist.")
    audit.record(db, org, "integration.disconnected", actor_id=actor.id, record_type="integration", record_id=provider, info=info)


# ------------------------------------------------------------------------------------------------------------- Stripe
def _stripe(key: str, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
    try:
        r = httpx.get(f"https://api.stripe.com/v1/{path}", params=params, headers={"Authorization": f"Bearer {key}"}, timeout=20)
    except httpx.HTTPError as e:
        raise ApiError(502, "provider_unreachable", "Stripe could not be reached. Try again.") from e
    if r.status_code in (401, 403):
        raise ApiError(422, "validation_error", "Stripe did not accept this key, or it cannot read charges. Create a restricted key with read access to Charges.")
    if r.status_code == 429:
        raise ApiError(429, "provider_busy", "Stripe is asking us to slow down. Try again in a minute.")
    r.raise_for_status()
    return dict(r.json())


def _refuse_write_access(key: str) -> None:
    """A key that can write is refused. Each probe targets an object that does not exist, so it changes nothing: Stripe answers 403 when
    the key lacks the permission and 404 (no such object) when it has it."""
    for path, params in (("charges/ch_venn_probe/capture", {}), ("payment_intents/pi_venn_probe/cancel", {}), ("refunds", {"charge": "ch_venn_probe"})):
        try:
            r = httpx.post(f"https://api.stripe.com/v1/{path}", data=params, headers={"Authorization": f"Bearer {key}"}, timeout=20)
        except httpx.HTTPError as e:
            raise ApiError(502, "provider_unreachable", "Stripe could not be reached. Try again.") from e
        if r.status_code != 403:
            raise ApiError(422, "validation_error", "This key can change data in Stripe. Create a restricted key with read-only access and use that.")


def connect_stripe(db: Session, org: uuid.UUID, actor: AuthUser, key: str, info: RequestInfo) -> dict[str, Any]:
    key = key.strip()
    if not key.startswith("rk_"):
        raise ApiError(422, "validation_error", "Use a restricted key (it starts with rk_) with read access only. Full secret keys are refused.")
    _stripe(key, "charges", {"limit": 1})
    _refuse_write_access(key)
    _store(db, org, "stripe", key, "test mode" if key.startswith("rk_test_") else "live mode", actor.id)
    audit.record(db, org, "integration.connected", actor_id=actor.id, record_type="integration", record_id="stripe", info=info)
    return {"connected": True}


def sync_stripe(db: Session, org: uuid.UUID, actor: AuthUser, info: RequestInfo) -> dict[str, Any]:
    r = _row(db, "stripe")
    if r is None:
        raise ApiError(409, "invalid_state", "Stripe is not connected.")
    key = unseal(r.secret_enc)
    since = int((datetime.now(UTC) - timedelta(days=90)).timestamp())
    seen = new = skipped = 0
    after: str | None = None
    for _ in range(5):  # at most 500 charges a sync: shortcut, raise when a deployment needs more
        page = _stripe(key, "charges", {"limit": 100, "created[gte]": since, **({"starting_after": after} if after else {})})
        for ch in page["data"]:
            seen += 1
            net = int(ch["amount"]) - int(ch.get("amount_refunded") or 0)
            if ch.get("status") != "succeeded" or not ch.get("paid") or net <= 0:
                skipped += 1
                continue
            cur = str(ch["currency"]).upper()
            amount = Decimal(net) / (10 ** currency_digits(cur))
            payer = ((ch.get("billing_details") or {}).get("name") or ch.get("receipt_email") or "Stripe customer").strip()
            ref = ((ch.get("metadata") or {}).get("invoice") or ch.get("description") or ch["id"]).strip()[:200]
            cust = db.execute(text("select id from customers where lower(name) = lower(:n) or exists (select 1 from unnest(payer_aliases) a where lower(a) = lower(:n)) limit 1"), {"n": payer}).scalar()
            made = db.execute(text(
                "insert into payments (organization_id, number, customer_id, payment_date, amount, currency, method, reference, memo, payer_name_raw, verification_level, source, external_id) "
                "values (:o, next_number(:o, 'payment', 'PAY'), :c, :d, :a, :cur, 'card', :r, :m, :p, 'source_verified', 'stripe', :x) on conflict do nothing returning id"),
                {"o": org, "c": cust, "d": datetime.fromtimestamp(int(ch["created"]), UTC).date(), "a": amount, "cur": cur, "r": ref, "m": f"Stripe charge {ch['id']}", "p": payer, "x": ch["id"]}).first()
            new += 1 if made else 0
        if not page.get("has_more") or not page["data"]:
            break
        after = page["data"][-1]["id"]
    db.execute(text("update integrations set last_sync_at = now(), last_error = null, status = 'connected' where provider = 'stripe'"))
    audit.record(db, org, "integration.synced", actor_id=actor.id, record_type="integration", record_id="stripe", after={"seen": seen, "new": new, "skipped": skipped}, info=info)
    return {"seen": seen, "new": new, "skipped": skipped, "already_here": seen - skipped - new}


# ------------------------------------------------------------------------------------------------------------- Gmail
def gmail_start(org: uuid.UUID, actor: AuthUser) -> str:
    c = get_settings()
    if not (c.google_client_id and c.google_client_secret and c.secrets_key):
        raise ApiError(503, "not_configured", "Gmail is not configured on this server.")
    q = {"client_id": c.google_client_id, "redirect_uri": c.google_redirect_uri, "response_type": "code", "scope": GMAIL_SCOPE, "access_type": "offline", "prompt": "consent", "state": sign_state(f"gmail:{org}:{actor.id}:{secrets.token_urlsafe(12)}")}
    return "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(q)


def _token(grant: dict[str, str]) -> dict[str, Any]:
    c = get_settings()
    r = httpx.post("https://oauth2.googleapis.com/token", data={"client_id": c.google_client_id, "client_secret": c.google_client_secret, **grant}, timeout=20)
    if r.status_code >= 400:
        raise ApiError(409, "reconnect", "Google refused the connection. Connect Gmail again.")
    return dict(r.json())


def gmail_finish(code: str, state: str) -> tuple[uuid.UUID, uuid.UUID, str, str]:
    """Exchanges the one-time code. Returns (organization, user, refresh token, email address)."""
    provider, org, user, _ = read_state(state).split(":")
    if provider != "gmail":  # a state minted for another provider is not accepted here
        raise ApiError(400, "bad_request", "The sign-in link is not valid.")
    t = _token({"grant_type": "authorization_code", "code": code, "redirect_uri": get_settings().google_redirect_uri})
    refresh = t.get("refresh_token")
    if not refresh:
        raise ApiError(409, "reconnect", "Google did not return a long-lived login. Remove venn under Google Account, Security, Third-party access, then connect again.")
    me = httpx.get("https://gmail.googleapis.com/gmail/v1/users/me/profile", headers={"Authorization": f"Bearer {t['access_token']}"}, timeout=20)
    email = me.json().get("emailAddress", "Gmail") if me.status_code == 200 else "Gmail"
    return uuid.UUID(org), uuid.UUID(user), str(refresh), str(email)


def claim_state(db: Session, state: str) -> None:
    """Lets a connect link finish once, and only while its person still may manage connections (the signature alone proves neither)."""
    _, org, user, nonce = read_state(state).split(":")
    db.execute(text("delete from oauth_used where used_at < now() - interval '1 day'"))
    if db.execute(text("insert into oauth_used (nonce) values (:n) on conflict do nothing returning 1"), {"n": nonce}).first() is None:
        raise ApiError(400, "bad_request", "This connect link was already used. Start again.")
    allowed = db.execute(text("select 1 from memberships m join role_permissions rp on rp.role_id = m.role_id where m.user_id = :u and m.organization_id = :o "
                              "and m.status = 'active' and rp.permission_key = 'integrations.manage'"), {"u": user, "o": org}).first()
    if allowed is None:
        raise ApiError(403, "permission_denied", "You can no longer manage connections for this organization.")


def gmail_store(db: Session, org: uuid.UUID, user: uuid.UUID, refresh: str, email: str) -> None:
    _store(db, org, "gmail", json.dumps({"refresh": refresh}), email, user)
    audit.record(db, org, "integration.connected", actor_id=user, record_type="integration", record_id="gmail")


def _gmail(db: Session, path: str, params: dict[str, Any]) -> dict[str, Any]:
    r = _row(db, "gmail")
    if r is None:
        raise ApiError(409, "invalid_state", "Gmail is not connected.")
    try:
        access = _token({"grant_type": "refresh_token", "refresh_token": json.loads(unseal(r.secret_enc))["refresh"]})["access_token"]
    except ApiError:
        db.execute(text("update integrations set status = 'error', last_error = 'The Google login expired. Connect Gmail again.' where provider = 'gmail'"))
        db.commit()
        raise
    resp = httpx.get(f"https://gmail.googleapis.com/gmail/v1/users/me/{path}", params=params, headers={"Authorization": f"Bearer {access}"}, timeout=20)
    if resp.status_code >= 400:
        raise ApiError(502, "provider_unreachable", "Gmail could not be searched right now. Try again.")
    return dict(resp.json())


def gmail_search(db: Session, query: str, limit: int = 8) -> list[dict[str, str]]:
    ids = [m["id"] for m in _gmail(db, "messages", {"q": query, "maxResults": limit}).get("messages", [])]
    out = []
    for mid in ids:
        m = _gmail(db, f"messages/{mid}", {"format": "metadata", "metadataHeaders": ["Subject", "From", "Date"]})
        h = {x["name"]: x["value"] for x in m.get("payload", {}).get("headers", [])}
        out.append({"id": mid, "subject": h.get("Subject", "(no subject)")[:200], "from": h.get("From", "")[:200], "date": h.get("Date", ""), "snippet": str(m.get("snippet", ""))[:240]})
    return out


def gmail_for_case(db: Session, iid: uuid.UUID) -> list[dict[str, str]]:
    c = db.execute(text("select i.invoice_number, cu.contact_email, cu.name from investigations g left join invoices i on i.id = g.invoice_id left join customers cu on cu.id = g.customer_id where g.id = :g"), {"g": iid}).first()
    if c is None:
        raise ApiError(404, "not_found", "Investigation not found.")
    terms = [f'"{c.invoice_number}"'] if c.invoice_number else []
    if c.contact_email:
        terms.append(f"from:{c.contact_email}")
    if not terms:
        raise ApiError(422, "validation_error", "This case has no invoice number or customer email to search for.")
    return gmail_search(db, " OR ".join(terms))

