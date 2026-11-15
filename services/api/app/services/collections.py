"""Collections (MOD-13): one case per customer with overdue invoices. Reminders are drafted from recorded facts only and every amount, date and
invoice number in the text is checked against those facts before anything is sent. Nothing is sent without a person pressing send.

Shortcuts: the queue is refreshed when it is viewed (there is no nightly job yet); sending records the message and logs it through the mailer
(real delivery needs the SMTP settings of Stage J); an outbox with retries comes with the job runner.
"""

import re
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.mailer import Mailer, Message
from app.core.money import Money
from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser
from app.services import approvals, audit, notifications

STAGES = ("reminder_1", "reminder_2", "final_notice", "promise")
NEXT = {"reminder_1": "reminder_2", "reminder_2": "final_notice"}
INTERVAL_DAYS = 7
FILTERS = {"all": "true", "due_today": "c.next_action_date <= :t and c.paused_reason is null and c.stage <> 'promise'", "reminder_1": "c.stage = 'reminder_1'", "reminder_2": "c.stage = 'reminder_2'",
           "final_notice": "c.stage = 'final_notice'", "promise": "c.stage = 'promise'", "paused": "c.paused_reason is not null"}
TONES = {"friendly": "I hope you are well. A quick note that", "firm": "Our records show that", "final": "This is a final notice. Our records show that"}


class DraftIn(BaseModel):
    tone: Literal["friendly", "firm", "final"] = "friendly"


class SendIn(BaseModel):
    subject: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1, max_length=8000)
    mode: Literal["email", "mark_sent"] = "email"


class PromiseIn(BaseModel):
    promise_date: date
    promise_amount: Money


class NoteIn(BaseModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]


def fmt_date(d: date) -> str:
    return f"{d.day} {d.strftime('%b %Y')}"


def _event(db: Session, org: uuid.UUID, cid: uuid.UUID, kind: str, body: str, actor: uuid.UUID | None) -> None:
    db.execute(text("insert into collection_events (organization_id, case_id, kind, text, actor_id) values (:o, :c, :k, :t, :a)"), {"o": org, "c": cid, "k": kind, "t": body, "a": actor})


def _default_currency(db: Session) -> str:
    return str(db.execute(text("select default_currency from organizations")).scalar_one()).strip()


# --------------------------------------------------------------------------------------------------------- queue
def sync(db: Session, org: uuid.UUID, today: date, actor: uuid.UUID | None = None) -> dict[str, int]:
    """Opens a case for every customer with an overdue invoice, closes cases with nothing overdue, and flags promises that were not kept."""
    late = {r.customer_id: r for r in db.execute(text("select customer_id, count(*) as n, sum(balance_due) as total from invoices where lifecycle_status = 'issued' and balance_due > 0 and due_date < :t group by customer_id"),
                                                 {"t": today}).all()}
    cases = {r.customer_id: r for r in db.execute(text("select id, customer_id, status, stage, promise_date, paused_reason from collection_cases")).all()}
    opened = closed = broken = 0
    for cust, r in late.items():
        c = cases.get(cust)
        if c is None:
            disputed = db.execute(text("select 1 from disputes d join invoices i on i.id = d.invoice_id where i.customer_id = :c and d.status <> 'resolved'"), {"c": cust}).first() is not None
            cid = db.execute(text("insert into collection_cases (organization_id, number, customer_id, next_action_date, paused_reason) values (:o, next_number(:o, 'collection', 'COL'), :c, :t, :p) returning id"),
                             {"o": org, "c": cust, "t": today, "p": "dispute" if disputed else None}).scalar_one()
            _event(db, org, cid, "opened", f"Case opened: {r.n} overdue invoice{'s' if r.n != 1 else ''}.", actor)
            opened += 1
        elif c.status == "closed":
            db.execute(text("update collection_cases set status = 'active', stage = 'reminder_1', next_action_date = :t, promise_date = null, promise_amount = null, version = version + 1 where id = :i"), {"t": today, "i": c.id})
            _event(db, org, c.id, "reopened", "Reopened: an invoice is overdue again.", actor)
            opened += 1
        elif c.stage == "promise" and c.promise_date and c.promise_date < today:
            db.execute(text("update collection_cases set stage = 'reminder_2', broken_promise = true, promise_date = null, promise_amount = null, next_action_date = :t, paused_reason = null, version = version + 1 where id = :i"), {"t": today, "i": c.id})
            _event(db, org, c.id, "promise_broken", "The promise to pay was not kept. The case is back in the queue.", actor)
            name = db.execute(text("select name from customers where id = :c"), {"c": cust}).scalar_one()
            notifications.notify(db, org, notifications.users_with(db, org, "collections.view"), "collections", f"Broken promise: {name}", "The promised payment did not arrive.", f"/app/collections/{c.id}", f"promise-broken-{c.id}-{today}")
            broken += 1
    for cust, c in cases.items():
        if cust not in late and c.status == "active":
            db.execute(text("update collection_cases set status = 'closed', version = version + 1 where id = :i"), {"i": c.id})
            _event(db, org, c.id, "closed", "Closed: nothing is overdue.", actor)
            closed += 1
    return {"opened": opened, "closed": closed, "broken": broken}


def priority(balance: Decimal, days: int) -> Decimal:
    return (balance * (1 + Decimal(days) / 30)).quantize(Decimal("1"))


SQL = ("select c.id, c.number, c.customer_id, c.stage, c.next_action_date, c.promise_date, c.promise_amount, c.broken_promise, c.paused_reason, c.final_approved, c.final_approval_id, c.last_sent_at, "
       "c.version, cu.name as customer, cu.contact_email, "
       "coalesce(sum(i.balance_due) filter (where i.currency = :cur), 0) as balance, count(i.id) as n, coalesce(max(:t - i.due_date), 0) as days "
       "from collection_cases c join customers cu on cu.id = c.customer_id left join invoices i on i.customer_id = c.customer_id and i.lifecycle_status = 'issued' and i.balance_due > 0 and i.due_date < :t")


def _out(r: Any) -> dict[str, Any]:
    return {"id": str(r.id), "number": r.number, "customer_id": str(r.customer_id), "customer": r.customer, "stage": r.stage, "next_action_date": r.next_action_date, "promise_date": r.promise_date,
            "promise_amount": r.promise_amount, "broken_promise": r.broken_promise, "paused_reason": r.paused_reason, "final_approved": r.final_approved, "last_sent_at": r.last_sent_at,
            "balance": r.balance, "overdue_invoices": int(r.n), "days_late": int(r.days), "priority": priority(r.balance, int(r.days)), "version": r.version, "has_email": bool(r.contact_email)}


def list_cases(db: Session, org: uuid.UUID, actor: uuid.UUID, flt: str, today: date) -> list[dict[str, Any]]:
    if flt not in FILTERS:
        raise ApiError(400, "bad_request", "Unknown filter.")
    sync(db, org, today, actor)
    rows = db.execute(text(f"{SQL} where c.status = 'active' and {FILTERS[flt]} group by c.id, cu.id"),  # noqa: S608
                      {"t": today, "cur": _default_currency(db)}).all()
    return sorted((_out(r) for r in rows), key=lambda x: (-x["priority"], x["number"]))


def _invoices(db: Session, customer: uuid.UUID, today: date) -> list[Any]:
    return list(db.execute(text("select i.id, i.invoice_number, i.total_amount, i.balance_due, i.currency, i.due_date, :t - i.due_date as late, "
                           "exists (select 1 from disputes d where d.invoice_id = i.id and d.status <> 'resolved') as disputed from invoices i "
                           "where i.customer_id = :c and i.lifecycle_status = 'issued' and i.balance_due > 0 and i.due_date < :t order by i.due_date, i.invoice_number"), {"c": customer, "t": today}).all())


def get(db: Session, cid: uuid.UUID, today: date) -> dict[str, Any]:
    r = db.execute(text(f"{SQL} where c.id = :i group by c.id, cu.id"), {"i": cid, "t": today, "cur": _default_currency(db)}).first()  # noqa: S608
    if r is None:
        raise ApiError(404, "not_found", "Case not found.")
    out = _out(r)
    out["invoices"] = [{"id": str(i.id), "number": i.invoice_number, "total": i.total_amount, "balance": i.balance_due, "currency": i.currency.strip(), "due_date": i.due_date, "days_late": int(i.late), "disputed": i.disputed} for i in _invoices(db, r.customer_id, today)]
    out["events"] = [{"kind": e.kind, "text": e.text, "at": e.created_at, "by": e.who} for e in db.execute(text(
        "select e.kind, e.text, e.created_at, p.full_name as who from collection_events e left join profiles p on p.id = e.actor_id where e.case_id = :c order by e.created_at, e.id"), {"c": cid}).all()]
    out["priority_note"] = f"Overdue balance {r.balance:.2f} weighted by {int(r.days)} days overdue (balance × (1 + days / 30))."
    out["final_approval_id"] = str(r.final_approval_id) if r.final_approval_id else None
    out["contact_email"] = r.contact_email
    return out


# ------------------------------------------------------------------------------------------------------ drafting
def facts(case: dict[str, Any], org_name: str, today: date) -> dict[str, set[str]]:
    amounts: set[str] = set()
    for i in case["invoices"]:
        for v in (i["total"], i["balance"]):
            amounts |= {f"{v:,.2f}", f"{v:.2f}"}
    total = sum((i["balance"] for i in case["invoices"]), Decimal(0))
    amounts |= {f"{total:,.2f}", f"{total:.2f}"}
    return {"amounts": amounts, "numbers": {i["number"] for i in case["invoices"]}, "dates": {fmt_date(i["due_date"]) for i in case["invoices"]} | {fmt_date(today)}}


def check_text(body: str, f: dict[str, set[str]]) -> str | None:
    """Returns the first amount, invoice number or date in the text that is not in the case facts, or None when everything is grounded."""
    for m in re.findall(r"\b\d{1,3}(?:,\d{3})*\.\d{2}\b|\b\d+\.\d{2}\b", body):
        if m not in f["amounts"]:
            return str(m)
    for m in re.findall(r"\b[A-Z][A-Z0-9]*-[A-Z0-9][A-Z0-9-]*\b", body):
        if m not in f["numbers"]:
            return str(m)
    for m in re.findall(r"\b\d{1,2} [A-Z][a-z]{2} \d{4}\b", body):
        if m not in f["dates"]:
            return str(m)
    return None


def draft(db: Session, org: uuid.UUID, actor: AuthUser, cid: uuid.UUID, tone: str, today: date, info: RequestInfo) -> dict[str, Any]:
    c = get(db, cid, today)
    if not c["invoices"]:
        raise ApiError(409, "invalid_state", "Nothing is overdue for this customer.")
    org_name = str(db.execute(text("select name from organizations")).scalar_one())
    lines = "\n".join(f"- {i['number']}: {i['balance']:,.2f} {i['currency']}, due {fmt_date(i['due_date'])} ({i['days_late']} days ago)" for i in c["invoices"])
    cur = c["invoices"][0]["currency"]
    total = sum((i["balance"] for i in c["invoices"]), Decimal(0))
    plural = len(c["invoices"]) != 1
    opening = TONES[tone]
    body = (f"Hello,\n\n{opening} the following invoice{'s are' if plural else ' is'} overdue as of {fmt_date(today)}:\n\n{lines}\n\nThe total overdue is {total:,.2f} {cur}. "
            f"Please arrange payment, or reply if you believe anything here is wrong so we can check it.\n\nKind regards,\n{org_name}")
    subject = f"{'Final notice: ' if tone == 'final' else ''}Overdue invoice{'s' if plural else ''} {', '.join(i['number'] for i in c['invoices'][:3])}{'…' if len(c['invoices']) > 3 else ''}"
    _event(db, org, cid, "draft", f"Drafted a {tone} message from the records.", actor.id)
    return {"subject": subject, "body": body, "tone": tone, "facts_checked": True}


# ------------------------------------------------------------------------------------------------- send and stages
def send(db: Session, org: uuid.UUID, actor: AuthUser, mailer: Mailer, cid: uuid.UUID, body: SendIn, today: date, info: RequestInfo) -> dict[str, Any]:
    row = db.execute(text("select stage, final_approved, paused_reason, status from collection_cases where id = :i for update"), {"i": cid}).first()
    if row is None:
        raise ApiError(404, "not_found", "Case not found.")
    if row.paused_reason:
        raise ApiError(409, "invalid_state", f"This case is paused ({row.paused_reason}). Resume it before sending.")
    if row.status != "active":
        raise ApiError(409, "invalid_state", "This case is closed.")
    c = get(db, cid, today)
    org_name = str(db.execute(text("select name from organizations")).scalar_one())
    bad = check_text(f"{body.subject}\n{body.body}", facts(c, org_name, today))
    if bad:
        raise ApiError(422, "ungrounded_text", f"The message contains {bad}, which is not in this case's records. Remove it or correct it.", [{"field": "body", "code": "ungrounded", "message": bad}])
    if row.stage == "final_notice" and not row.final_approved:
        raise ApiError(409, "approval_required", "A final notice needs an approved request before it can be sent.")
    if body.mode == "email":
        if not c["contact_email"]:
            raise ApiError(422, "no_recipient", "This customer has no contact email. Add one, or send it yourself and choose Mark as sent.")
        mailer.send(Message(c["contact_email"], body.subject, body.body))
    kind = "sent" if body.mode == "email" else "marked_sent"
    _event(db, org, cid, kind, f"{'Sent to ' + c['contact_email'] if body.mode == 'email' else 'Marked as sent (sent outside venn)'}: {body.subject}", actor.id)
    nxt = NEXT.get(row.stage)
    db.execute(text("update collection_cases set last_sent_at = now(), stage = :s, next_action_date = :d, final_approved = case when :fin then false else final_approved end, version = version + 1 where id = :i"),
               {"s": nxt or row.stage, "d": today + timedelta(days=INTERVAL_DAYS), "fin": row.stage == "final_notice", "i": cid})
    if nxt:
        _event(db, org, cid, "stage", f"Moved to {nxt.replace('_', ' ')}. Next action {fmt_date(today + timedelta(days=INTERVAL_DAYS))}.", actor.id)
    audit.record(db, org, "collection.sent" if body.mode == "email" else "collection.marked_sent", actor_id=actor.id, record_type="collection_case", record_id=cid, after={"subject": body.subject, "stage": nxt or row.stage}, info=info)
    return get(db, cid, today)


def set_promise(db: Session, org: uuid.UUID, actor: AuthUser, cid: uuid.UUID, body: PromiseIn, today: date, info: RequestInfo) -> dict[str, Any]:
    get(db, cid, today)
    if body.promise_date < today:
        raise ApiError(422, "validation_error", "The promised date cannot be in the past.", [{"field": "promise_date", "code": "past", "message": "past"}])
    if body.promise_amount <= 0:
        raise ApiError(422, "validation_error", "Enter the promised amount.")
    db.execute(text("update collection_cases set stage = 'promise', promise_date = :d, promise_amount = :a, broken_promise = false, next_action_date = :d, version = version + 1 where id = :i"), {"d": body.promise_date, "a": body.promise_amount, "i": cid})
    _event(db, org, cid, "promise", f"Promise to pay {body.promise_amount:.2f} by {fmt_date(body.promise_date)}. The case waits until then.", actor.id)
    audit.record(db, org, "collection.promise", actor_id=actor.id, record_type="collection_case", record_id=cid, after={"date": str(body.promise_date), "amount": str(body.promise_amount)}, info=info)
    return get(db, cid, today)


def add_note(db: Session, org: uuid.UUID, actor: AuthUser, cid: uuid.UUID, body: str, today: date, info: RequestInfo) -> dict[str, Any]:
    get(db, cid, today)
    _event(db, org, cid, "note", body.strip(), actor.id)
    audit.record(db, org, "collection.note_added", actor_id=actor.id, record_type="collection_case", record_id=cid, info=info)
    return get(db, cid, today)


def request_final_notice(db: Session, org: uuid.UUID, actor: AuthUser, cid: uuid.UUID, today: date, info: RequestInfo) -> dict[str, Any]:
    c = get(db, cid, today)
    if c["stage"] != "final_notice":
        raise ApiError(409, "invalid_state", "Only a case at the final notice stage can request approval for it.")
    if c["final_approved"] or (c["final_approval_id"] and db.execute(text("select 1 from approval_requests where id = :a and status in ('pending', 'info_requested')"), {"a": c["final_approval_id"]}).first()):
        raise ApiError(409, "duplicate", "A final notice is already approved or waiting for approval.")
    oldest = next((i for i in c["invoices"] if not i["disputed"]), None)
    if oldest is None:
        raise ApiError(409, "invalid_state", "Every overdue invoice is disputed.")
    total = sum((i["balance"] for i in c["invoices"] if not i["disputed"]), Decimal(0))
    req = approvals.create(db, org, actor, approvals.RequestIn(type="final_notice", invoice_id=uuid.UUID(oldest["id"]), amount=total, reason=f"Final notice to {c['customer']} for {total:.2f} overdue."), info)
    db.execute(text("update collection_cases set final_approval_id = :a, version = version + 1 where id = :i"), {"a": req["id"], "i": cid})
    _event(db, org, cid, "approval", f"Final notice sent for approval ({req['number']}). It cannot be sent before it is approved.", actor.id)
    return get(db, cid, today)


def on_final_notice_approved(db: Session, org: uuid.UUID, approval_id: uuid.UUID, actor: uuid.UUID | None) -> None:
    c = db.execute(text("update collection_cases set final_approved = true, version = version + 1 where final_approval_id = :a returning id"), {"a": approval_id}).first()
    if c:
        _event(db, org, c.id, "approval", "The final notice was approved. It can be sent.", actor)


def on_final_notice_closed(db: Session, org: uuid.UUID, approval_id: uuid.UUID, status: str, actor: uuid.UUID | None) -> None:
    c = db.execute(text("update collection_cases set final_approval_id = null, stage = 'reminder_2', version = version + 1 where final_approval_id = :a and not final_approved returning id"), {"a": approval_id}).first()
    if c:
        _event(db, org, c.id, "approval", f"The final notice request was {status.replace('_', ' ')}. The case stays at reminder 2.", actor)


# --------------------------------------------------------------------------------------------------- disputes
def pause_for_customer(db: Session, org: uuid.UUID, customer: uuid.UUID, reason: str, actor: uuid.UUID | None) -> None:
    c = db.execute(text("update collection_cases set paused_reason = :r, version = version + 1 where customer_id = :c and status = 'active' and paused_reason is null returning id"), {"r": reason, "c": customer}).first()
    if c:
        _event(db, org, c.id, "paused", f"Paused: {reason}.", actor)


def resume_for_customer(db: Session, org: uuid.UUID, customer: uuid.UUID, actor: uuid.UUID | None) -> None:
    if db.execute(text("select 1 from disputes d join invoices i on i.id = d.invoice_id where i.customer_id = :c and d.status <> 'resolved'"), {"c": customer}).first():
        return  # another dispute is still open
    c = db.execute(text("update collection_cases set paused_reason = null, version = version + 1 where customer_id = :c and paused_reason = 'dispute' returning id"), {"c": customer}).first()
    if c:
        _event(db, org, c.id, "resumed", "Resumed: no dispute is open.", actor)
