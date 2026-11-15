"""Approvals and adjustments (MOD-12). A write-off, credit or refund-due record is requested by one person and decided by another.

Decisions are history and cannot change. Approving runs the adjustment in the same transaction, after checking that the invoice still
looks the way it did when the request was made.
"""

import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import ApiError
from app.core.money import Money
from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser
from app.services import audit

TYPES = ("write_off", "credit", "refund_due")
OPEN = ("pending", "info_requested")
TABS = {"pending": "r.status = 'pending'", "info": "r.status = 'info_requested'", "decided": "r.status in ('approved', 'rejected', 'withdrawn', 'expired')", "all": "true"}


class RequestIn(BaseModel):
    type: Literal["write_off", "credit", "refund_due"]
    invoice_id: uuid.UUID
    amount: Money
    reason: str = Field(min_length=1, max_length=2000)


class DecisionIn(BaseModel):
    decision: Literal["approve", "reject", "request_info"]
    comment: str | None = Field(default=None, max_length=2000)
    confirm_stale: bool = False


class PolicyIn(BaseModel):
    type: Literal["write_off", "credit", "refund_due"]
    auto_approve_below: Money
    expiry_days: int = Field(ge=1, le=365)


def _policy(db: Session, kind: str) -> tuple[Decimal, int]:
    r = db.execute(text("select auto_approve_below, expiry_days from approval_policies where type = :t"), {"t": kind}).first()
    return (r.auto_approve_below, r.expiry_days) if r else (Decimal(0), 30)


def _log(db: Session, org: uuid.UUID, rid: uuid.UUID, decision: str, comment: str | None, who: uuid.UUID | None) -> None:
    db.execute(text("insert into approval_decisions (organization_id, request_id, decision, comment, decided_by) values (:o, :r, :d, :c, :u)"),
               {"o": org, "r": rid, "d": decision, "c": comment, "u": who})


def expire_due(db: Session, org: uuid.UUID) -> int:
    rows = db.execute(text("update approval_requests set status = 'expired', decided_at = :n, version = version + 1 where status in ('pending', 'info_requested') and expires_at < :n returning id, number"),
                      {"n": clock.now()}).all()
    for r in rows:
        _log(db, org, r.id, "expire", "Not decided before it expired.", None)
        audit.record(db, org, "approval.expired", record_type="approval_request", record_id=r.id, after={"number": r.number})
    return len(rows)


INV_SQL = ("select i.id, i.invoice_number, i.customer_id, c.name as customer, i.total_amount, i.amount_paid, i.amount_adjusted, i.balance_due, i.currency, i.lifecycle_status "
           "from invoices i join customers c on c.id = i.customer_id where i.id = :i")


def _invoice(db: Session, iid: uuid.UUID, lock: bool = False) -> Any:
    r = db.execute(text(INV_SQL + (" for update of i" if lock else "")), {"i": iid}).first()
    if r is None:
        raise ApiError(404, "not_found", "Invoice not found.")
    return r


def _check_amount(kind: str, amount: Decimal, inv: Any) -> None:
    if inv.lifecycle_status != "issued":
        raise ApiError(409, "invalid_state", "Only issued invoices can be adjusted.")
    if amount <= 0:
        raise ApiError(422, "validation_error", "Enter an amount above zero.")
    limit = inv.amount_paid if kind == "refund_due" else inv.balance_due
    if amount > limit:
        what = "the amount paid on the invoice" if kind == "refund_due" else "the invoice balance"
        raise ApiError(422, "business_rule_violation", f"The amount cannot exceed {what} ({limit:.2f}).", [{"field": "amount", "code": "exceeds_limit", "message": "exceeds_limit"}])


def _execute(db: Session, org: uuid.UUID, actor: AuthUser, req: Any, inv: Any, info: RequestInfo) -> uuid.UUID:
    affects = req.type in ("write_off", "credit")
    aid = db.execute(text("insert into adjustments (organization_id, invoice_id, approval_id, type, amount, currency, reason, affects_balance, created_by) "
                          "values (:o, :i, :a, :t, :m, :c, :r, :f, :u) returning id"),
                     {"o": org, "i": inv.id, "a": req.id, "t": req.type, "m": req.amount, "c": inv.currency, "r": req.reason, "f": affects, "u": actor.id}).scalar_one()
    if affects:
        db.execute(text("update invoices set amount_adjusted = amount_adjusted + :a, balance_due = balance_due - :a, version = version + 1, updated_at = now() where id = :i"), {"a": req.amount, "i": inv.id})
    audit.record(db, org, "adjustment.executed", actor_id=actor.id, record_type="adjustment", record_id=aid,
                 before={"invoice_balance": str(inv.balance_due)}, after={"type": req.type, "invoice": inv.invoice_number, "amount": str(req.amount),
                                                                         "invoice_balance": str(inv.balance_due - req.amount if affects else inv.balance_due)}, info=info)
    return aid  # type: ignore[no-any-return]


def create(db: Session, org: uuid.UUID, actor: AuthUser, body: RequestIn, info: RequestInfo) -> dict[str, Any]:
    expire_due(db, org)
    inv = _invoice(db, body.invoice_id, lock=True)
    _check_amount(body.type, body.amount, inv)
    if db.execute(text("select 1 from approval_requests where invoice_id = :i and type = :t and status in ('pending', 'info_requested')"), {"i": inv.id, "t": body.type}).first():
        raise ApiError(409, "duplicate", "There is already an open request of this kind for this invoice.")
    below, days = _policy(db, body.type)
    auto = body.type != "refund_due" and below > 0 and body.amount <= below
    now = clock.now()
    rid = db.execute(text("insert into approval_requests (organization_id, number, type, invoice_id, amount, currency, reason, status, requested_by, balance_at_request, expires_at, decided_at) "
                          "values (:o, next_number(:o, 'approval', 'APR'), :t, :i, :a, :c, :r, :s, :u, :b, :e, :d) returning id"),
                     {"o": org, "t": body.type, "i": inv.id, "a": body.amount, "c": inv.currency, "r": body.reason.strip(), "s": "approved" if auto else "pending", "u": actor.id,
                      "b": inv.balance_due, "e": now + timedelta(days=days), "d": now if auto else None}).scalar_one()
    audit.record(db, org, "approval.requested", actor_id=actor.id, record_type="approval_request", record_id=rid,
                 after={"type": body.type, "invoice": inv.invoice_number, "amount": str(body.amount), "auto_approved": auto}, info=info)
    if auto:
        _log(db, org, rid, "auto_approve", f"Within the auto-approve limit of {below:.2f}.", None)
        req = db.execute(text("select id, type, amount, reason from approval_requests where id = :r"), {"r": rid}).one()
        _execute(db, org, actor, req, inv, info)
    return get(db, actor.id, True, rid)


def _out(r: Any) -> dict[str, Any]:
    return {"id": str(r.id), "number": r.number, "type": r.type, "status": r.status, "amount": r.amount, "currency": r.currency.strip(), "reason": r.reason, "invoice_id": str(r.invoice_id),
            "invoice_number": r.invoice_number, "customer": r.customer, "requested_by": r.requester, "requested_by_id": str(r.requested_by), "requested_at": r.requested_at,
            "expires_at": r.expires_at, "decided_at": r.decided_at, "version": r.version}


BASE = ("select r.id, r.number, r.type, r.status, r.amount, r.currency, r.reason, r.invoice_id, r.requested_by, r.requested_at, r.expires_at, r.decided_at, r.version, r.balance_at_request, "
        "i.invoice_number, c.name as customer, p.full_name as requester from approval_requests r join invoices i on i.id = r.invoice_id join customers c on c.id = i.customer_id "
        "join profiles p on p.id = r.requested_by")


def list_requests(db: Session, org: uuid.UUID, user: uuid.UUID, can_decide: bool, tab: str, page: int, limit: int) -> tuple[list[dict[str, Any]], int]:
    if tab not in TABS and tab != "mine":
        raise ApiError(400, "bad_request", "Unknown tab.")
    expire_due(db, org)
    where = "r.requested_by = :u" if tab == "mine" or not can_decide else f"{TABS[tab]}"
    if not can_decide and tab in TABS and tab != "all":
        where = f"r.requested_by = :u and {TABS[tab]}"
    total = db.execute(text(f"select count(*) from approval_requests r where {where}"), {"u": user}).scalar_one()  # noqa: S608
    rows = db.execute(text(f"{BASE} where {where} order by r.requested_at desc, r.id limit :n offset :o"), {"u": user, "n": limit, "o": (page - 1) * limit}).all()  # noqa: S608
    return [_out(r) for r in rows], int(total)


def get(db: Session, user: uuid.UUID, can_decide: bool, rid: uuid.UUID) -> dict[str, Any]:
    r = db.execute(text(f"{BASE} where r.id = :r"), {"r": rid}).first()
    if r is None or (not can_decide and r.requested_by != user):
        raise ApiError(404, "not_found", "Request not found.")
    inv = _invoice(db, r.invoice_id)
    affects = r.type in ("write_off", "credit")
    decisions = db.execute(text("select d.decision, d.comment, d.created_at, p.full_name as who from approval_decisions d left join profiles p on p.id = d.decided_by where d.request_id = :r order by d.created_at, d.id"), {"r": rid}).all()
    out = _out(r)
    out["impact"] = {"balance_at_request": r.balance_at_request, "balance_now": inv.balance_due, "balance_after": inv.balance_due - r.amount if affects else inv.balance_due,
                     "stale": r.status in OPEN and inv.balance_due != r.balance_at_request, "affects_balance": affects}
    out["decisions"] = [{"decision": d.decision, "comment": d.comment, "at": d.created_at, "by": d.who} for d in decisions]
    return out


def _open(db: Session, rid: uuid.UUID, org: uuid.UUID) -> Any:
    expire_due(db, org)
    r = db.execute(text("select id, number, type, amount, reason, status, invoice_id, requested_by, balance_at_request, version from approval_requests where id = :r for update"), {"r": rid}).first()
    if r is None:
        raise ApiError(404, "not_found", "Request not found.")
    return r


def decide(db: Session, org: uuid.UUID, actor: AuthUser, rid: uuid.UUID, body: DecisionIn, info: RequestInfo) -> dict[str, Any]:
    r = _open(db, rid, org)
    if r.status not in OPEN:
        raise ApiError(409, "invalid_state", f"This request is already {r.status}. A decision cannot be changed.")
    if r.requested_by == actor.id:
        raise ApiError(403, "permission_denied", "You cannot decide your own request.")
    comment = (body.comment or "").strip()
    if body.decision == "reject" and not comment:
        raise ApiError(422, "validation_error", "Give a reason for rejecting.", [{"field": "comment", "code": "required", "message": "required"}])
    if body.decision == "request_info":
        if not comment:
            raise ApiError(422, "validation_error", "Say what information you need.", [{"field": "comment", "code": "required", "message": "required"}])
        db.execute(text("update approval_requests set status = 'info_requested', version = version + 1 where id = :r"), {"r": rid})
    elif body.decision == "reject":
        db.execute(text("update approval_requests set status = 'rejected', decided_at = now(), version = version + 1 where id = :r"), {"r": rid})
    else:
        inv = _invoice(db, r.invoice_id, lock=True)
        _check_amount(r.type, r.amount, inv)  # cancelled, paid off or too small now: nothing can be done
        if inv.balance_due != r.balance_at_request and not body.confirm_stale:
            raise ApiError(409, "approval_stale", f"The invoice balance changed from {r.balance_at_request:.2f} to {inv.balance_due:.2f} since this was requested. Confirm to approve it anyway.")
        _execute(db, org, actor, r, inv, info)
        db.execute(text("update approval_requests set status = 'approved', decided_at = now(), version = version + 1 where id = :r"), {"r": rid})
    _log(db, org, rid, body.decision, comment or None, actor.id)
    audit.record(db, org, f"approval.{body.decision}", actor_id=actor.id, record_type="approval_request", record_id=rid, after={"number": r.number, "comment": comment or None}, info=info)
    return get(db, actor.id, True, rid)


def reply(db: Session, org: uuid.UUID, actor: AuthUser, rid: uuid.UUID, comment: str, info: RequestInfo) -> dict[str, Any]:
    r = _open(db, rid, org)
    if r.requested_by != actor.id:
        raise ApiError(404, "not_found", "Request not found.")
    if r.status != "info_requested":
        raise ApiError(409, "invalid_state", "No information has been requested.")
    if not comment.strip():
        raise ApiError(422, "validation_error", "Write a reply.")
    db.execute(text("update approval_requests set status = 'pending', version = version + 1 where id = :r"), {"r": rid})
    _log(db, org, rid, "reply", comment.strip(), actor.id)
    audit.record(db, org, "approval.replied", actor_id=actor.id, record_type="approval_request", record_id=rid, after={"number": r.number}, info=info)
    return get(db, actor.id, False, rid)


def withdraw(db: Session, org: uuid.UUID, actor: AuthUser, rid: uuid.UUID, info: RequestInfo) -> dict[str, Any]:
    r = _open(db, rid, org)
    if r.requested_by != actor.id:
        raise ApiError(404, "not_found", "Request not found.")
    if r.status not in OPEN:
        raise ApiError(409, "invalid_state", f"This request is already {r.status}.")
    db.execute(text("update approval_requests set status = 'withdrawn', decided_at = now(), version = version + 1 where id = :r"), {"r": rid})
    _log(db, org, rid, "withdraw", None, actor.id)
    audit.record(db, org, "approval.withdrawn", actor_id=actor.id, record_type="approval_request", record_id=rid, after={"number": r.number}, info=info)
    return get(db, actor.id, False, rid)


def read_policies(db: Session) -> list[dict[str, Any]]:
    rows = {r.type: r for r in db.execute(text("select type, auto_approve_below, expiry_days from approval_policies")).all()}
    return [{"type": t, "auto_approve_below": rows[t].auto_approve_below if t in rows else Decimal(0), "expiry_days": rows[t].expiry_days if t in rows else 30} for t in TYPES]


def set_policy(db: Session, org: uuid.UUID, actor: AuthUser, body: PolicyIn, info: RequestInfo) -> list[dict[str, Any]]:
    if body.type == "refund_due" and body.auto_approve_below > 0:
        raise ApiError(422, "validation_error", "Refunds always need a person to approve them.")
    db.execute(text("insert into approval_policies (organization_id, type, auto_approve_below, expiry_days) values (:o, :t, :a, :e) "
                    "on conflict (organization_id, type) do update set auto_approve_below = :a, expiry_days = :e"), {"o": org, "t": body.type, "a": body.auto_approve_below, "e": body.expiry_days})
    audit.record(db, org, "approval.policy_changed", actor_id=actor.id, record_type="approval_policy", after={"type": body.type, "auto_approve_below": str(body.auto_approve_below), "expiry_days": body.expiry_days}, info=info)
    return read_policies(db)
