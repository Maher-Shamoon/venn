"""Disputes (MOD-14). A customer disagrees with an invoice. The explanation is kept as their words and labelled unverified; a credit outcome only
closes the dispute after the approval for it is decided."""

import uuid
from datetime import date
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.money import Money
from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser
from app.services import approvals, audit, notifications

CATEGORIES = ("pricing", "quantity", "quality", "duplicate_billing", "missing_po", "not_received", "tax", "already_paid", "other")
FILTERS = {"all": "true", "open": "d.status in ('open', 'awaiting_approval')", "awaiting_customer": "d.status = 'awaiting_customer'", "resolved": "d.status = 'resolved'"}


class DisputeIn(BaseModel):
    invoice_id: uuid.UUID
    category: Literal["pricing", "quantity", "quality", "duplicate_billing", "missing_po", "not_received", "tax", "already_paid", "other"]
    amount: Money
    explanation: str = Field(min_length=1, max_length=4000)
    due_date: date | None = None


class NoteIn(BaseModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]


class StatusIn(BaseModel):
    status: Literal["open", "awaiting_customer"]


class ResolveIn(BaseModel):
    outcome: Literal["upheld", "partially_upheld", "rejected"]
    note: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]
    credit_amount: Money | None = None


def _event(db: Session, org: uuid.UUID, did: uuid.UUID, kind: str, body: str, actor: uuid.UUID | None) -> None:
    db.execute(text("insert into dispute_events (organization_id, dispute_id, kind, text, actor_id) values (:o, :d, :k, :t, :a)"), {"o": org, "d": did, "k": kind, "t": body, "a": actor})


SQL = ("select d.id, d.number, d.category, d.amount, d.currency, d.explanation, d.status, d.outcome, d.outcome_note, d.approval_id, d.due_date, d.created_at, d.resolved_at, d.version, d.invoice_id, d.customer_id, "
       "i.invoice_number, c.name as customer, ar.status as approval_status from disputes d join invoices i on i.id = d.invoice_id join customers c on c.id = d.customer_id "
       "left join approval_requests ar on ar.id = d.approval_id")


def _out(r: Any, today: date) -> dict[str, Any]:
    return {"id": str(r.id), "number": r.number, "category": r.category, "amount": r.amount, "currency": r.currency.strip(), "explanation": r.explanation, "status": r.status, "outcome": r.outcome,
            "outcome_note": r.outcome_note, "approval_id": str(r.approval_id) if r.approval_id else None, "approval_status": r.approval_status, "due_date": r.due_date,
            "overdue": bool(r.due_date and r.due_date < today and r.status != "resolved"), "created_at": r.created_at, "resolved_at": r.resolved_at, "version": r.version,
            "invoice_id": str(r.invoice_id), "invoice_number": r.invoice_number, "customer_id": str(r.customer_id), "customer": r.customer}


def open_dispute(db: Session, org: uuid.UUID, actor: AuthUser, body: DisputeIn, today: date, info: RequestInfo) -> dict[str, Any]:
    inv = db.execute(text("select id, customer_id, invoice_number, total_amount, currency, lifecycle_status from invoices where id = :i for update"), {"i": body.invoice_id}).first()
    if inv is None:
        raise ApiError(404, "not_found", "Invoice not found.")
    if inv.lifecycle_status != "issued":
        raise ApiError(409, "invalid_state", "Only issued invoices can be disputed.")
    if body.amount <= 0 or body.amount > inv.total_amount:
        raise ApiError(422, "validation_error", f"The disputed amount must be above zero and at most the invoice total of {inv.total_amount:.2f}.", [{"field": "amount", "code": "exceeds_total", "message": "exceeds_total"}])
    if db.execute(text("select 1 from disputes where invoice_id = :i and status <> 'resolved'"), {"i": inv.id}).first():
        raise ApiError(409, "duplicate", "This invoice already has an open dispute.")
    did = db.execute(text("insert into disputes (organization_id, number, invoice_id, customer_id, category, amount, currency, explanation, due_date, created_by) "
                          "values (:o, next_number(:o, 'dispute', 'DSP'), :i, :c, :cat, :a, :cur, :e, :d, :u) returning id"),
                     {"o": org, "i": inv.id, "c": inv.customer_id, "cat": body.category, "a": body.amount, "cur": inv.currency, "e": body.explanation.strip(), "d": body.due_date, "u": actor.id}).scalar_one()
    _event(db, org, did, "opened", f"Dispute opened on {inv.invoice_number} for {body.amount:.2f}.", actor.id)
    audit.record(db, org, "dispute.opened", actor_id=actor.id, record_type="dispute", record_id=did, after={"invoice": inv.invoice_number, "amount": str(body.amount), "category": body.category}, info=info)
    notifications.notify(db, org, notifications.users_with(db, org, "approvals.decide"), "dispute", f"Dispute on {inv.invoice_number}", f"{body.category.replace('_', ' ')}, {body.amount:.2f}", f"/app/disputes/{did}", f"dispute-open-{did}", skip=actor.id)
    from app.services import collections  # local import: collections also reads disputes

    collections.pause_for_customer(db, org, inv.customer_id, "dispute", actor.id)
    return get(db, did, today)


def list_disputes(db: Session, flt: str, q: str | None, today: date) -> list[dict[str, Any]]:
    if flt not in FILTERS:
        raise ApiError(400, "bad_request", "Unknown filter.")
    rows = db.execute(text(f"{SQL} where {FILTERS[flt]} and (cast(:q as text) is null or d.number ilike '%' || :q || '%' or i.invoice_number ilike '%' || :q || '%' or c.name ilike '%' || :q || '%') "  # noqa: S608
                           "order by (d.status = 'resolved'), d.due_date nulls last, d.created_at desc limit 300"), {"q": q or None}).all()
    return [_out(r, today) for r in rows]


def get(db: Session, did: uuid.UUID, today: date) -> dict[str, Any]:
    r = db.execute(text(f"{SQL} where d.id = :d"), {"d": did}).first()  # noqa: S608
    if r is None:
        raise ApiError(404, "not_found", "Dispute not found.")
    out = _out(r, today)
    out["events"] = [{"kind": e.kind, "text": e.text, "at": e.created_at, "by": e.who} for e in db.execute(text(
        "select e.kind, e.text, e.created_at, p.full_name as who from dispute_events e left join profiles p on p.id = e.actor_id where e.dispute_id = :d order by e.created_at, e.id"), {"d": did}).all()]
    out["documents"] = [{"id": str(x.id), "filename": x.filename} for x in db.execute(text(
        "select distinct d.id, d.filename from documents d join investigation_evidence e on e.ref_id = d.id join investigations g on g.id = e.investigation_id "
        "where g.invoice_id = :i and e.removed_at is null and d.deleted_at is null"), {"i": r.invoice_id}).all()]
    return out


def _open(db: Session, did: uuid.UUID) -> Any:
    d = db.execute(text("select * from disputes where id = :d for update"), {"d": did}).first()
    if d is None:
        raise ApiError(404, "not_found", "Dispute not found.")
    if d.status == "resolved":
        raise ApiError(409, "invalid_state", "This dispute is resolved and read-only.")
    return d


def add_note(db: Session, org: uuid.UUID, actor: AuthUser, did: uuid.UUID, body: str, today: date, info: RequestInfo) -> dict[str, Any]:
    _open(db, did)
    _event(db, org, did, "note", body.strip(), actor.id)
    audit.record(db, org, "dispute.note_added", actor_id=actor.id, record_type="dispute", record_id=did, info=info)
    return get(db, did, today)


def set_status(db: Session, org: uuid.UUID, actor: AuthUser, did: uuid.UUID, status: str, today: date, info: RequestInfo) -> dict[str, Any]:
    d = _open(db, did)
    if d.status == "awaiting_approval":
        raise ApiError(409, "invalid_state", "A credit is waiting for approval. Decide it first.")
    db.execute(text("update disputes set status = :s, version = version + 1 where id = :d"), {"s": status, "d": did})
    _event(db, org, did, "status", "Waiting for the customer." if status == "awaiting_customer" else "Back to open.", actor.id)
    audit.record(db, org, "dispute.status_changed", actor_id=actor.id, record_type="dispute", record_id=did, after={"status": status}, info=info)
    return get(db, did, today)


def _close(db: Session, org: uuid.UUID, d: Any, outcome: str, note: str, actor: uuid.UUID | None) -> None:
    db.execute(text("update disputes set status = 'resolved', outcome = :o, outcome_note = :n, resolved_at = now(), version = version + 1 where id = :d"), {"o": outcome, "n": note, "d": d.id})
    _event(db, org, d.id, "resolved", f"Resolved as {outcome.replace('_', ' ')}: {note}", actor)
    from app.services import collections

    collections.resume_for_customer(db, org, d.customer_id, actor)


def resolve(db: Session, org: uuid.UUID, actor: AuthUser, did: uuid.UUID, body: ResolveIn, today: date, info: RequestInfo) -> dict[str, Any]:
    d = _open(db, did)
    if d.status == "awaiting_approval":
        raise ApiError(409, "invalid_state", "A credit is already waiting for approval.")
    credit = body.credit_amount
    if body.outcome == "rejected":
        credit = None
    elif credit is None or credit <= 0 or credit > d.amount:
        raise ApiError(422, "validation_error", f"Enter the credit to issue, above zero and at most the disputed {d.amount:.2f}.", [{"field": "credit_amount", "code": "required", "message": "required"}])
    if credit is None:
        _close(db, org, d, body.outcome, body.note.strip(), actor.id)
    else:
        req = approvals.create(db, org, actor, approvals.RequestIn(type="credit", invoice_id=d.invoice_id, amount=credit, reason=f"Dispute {d.number}: {body.note.strip()}"), info)
        db.execute(text("update disputes set approval_id = :a, outcome = :o, outcome_note = :n, version = version + 1 where id = :d"), {"a": req["id"], "o": body.outcome, "n": body.note.strip(), "d": did})
        if req["status"] == "approved":  # inside an auto-approve limit: the credit is already applied
            _close(db, org, d, body.outcome, body.note.strip(), actor.id)
        else:
            db.execute(text("update disputes set status = 'awaiting_approval' where id = :d"), {"d": did})
            _event(db, org, did, "approval", f"Credit of {credit:.2f} sent for approval ({req['number']}). The dispute closes when it is decided.", actor.id)
    audit.record(db, org, "dispute.resolved", actor_id=actor.id, record_type="dispute", record_id=did, after={"outcome": body.outcome, "credit": str(credit) if credit else None}, info=info)
    return get(db, did, today)


def on_approval_decided(db: Session, org: uuid.UUID, approval_id: uuid.UUID, status: str, actor: uuid.UUID | None) -> None:
    """Called by approvals when a request is decided, so the dispute behind a credit can finish or reopen."""
    d = db.execute(text("select * from disputes where approval_id = :a and status = 'awaiting_approval' for update"), {"a": approval_id}).first()
    if d is None:
        return
    if status == "approved":
        _close(db, org, d, d.outcome, d.outcome_note or "", actor)
    else:
        db.execute(text("update disputes set status = 'open', approval_id = null, outcome = null, version = version + 1 where id = :d"), {"d": d.id})
        _event(db, org, d.id, "approval", f"The credit was {status.replace('_', ' ')}. The dispute is open again.", actor)


def totals(db: Session, today: date) -> dict[str, Any]:
    r = db.execute(text("select count(*) filter (where status <> 'resolved') as open_n, count(*) filter (where status <> 'resolved' and due_date < :t) as late_n, "
                        "coalesce(sum(amount) filter (where status <> 'resolved'), 0) as amount from disputes"), {"t": today}).one()
    return {"open": int(r.open_n), "overdue": int(r.late_n), "amount": Decimal(r.amount)}
