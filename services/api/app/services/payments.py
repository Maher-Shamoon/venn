import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser
from app.schemas.ledger import PaymentDetail, PaymentIn, PaymentOut
from app.services import audit
from app.services.invoices import allocations_for
from app.services.ledger import max_allocation

SORTS = {"date": "p.payment_date", "payer": "lower(coalesce(p.payer_name_raw, ''))", "amount": "p.amount", "number": "p.number"}
TABS = {
    "all": "true",
    "unallocated": "p.reversed_at is null and p.direction = 'in' and p.allocated_amount < p.amount",
    "allocated": "p.reversed_at is null and p.allocated_amount >= p.amount",
    "review": "p.under_review and p.reversed_at is null",
    "reversed": "p.reversed_at is not null",
    "duplicate": "false",  # flagged by reconciliation rule R7 (Stage D)
}
COLS = ("p.id, p.number, p.customer_id, c.name as customer_name, p.payment_date, p.amount, p.currency, p.allocated_amount, p.method, p.reference, "
        "p.payer_name_raw, p.verification_level, p.under_review, p.reversed_at, p.version, p.memo, p.reversal_reason")


def _status(r: Any) -> str:
    if r.reversed_at is not None:
        return "reversed"
    if r.allocated_amount <= 0:
        return "unmatched"
    return "fully_allocated" if r.allocated_amount >= r.amount else "partially_allocated"


def _out(r: Any, cls: type[PaymentOut] = PaymentOut, **extra: Any) -> Any:
    fields = set(cls.model_fields) - {"status", "unallocated_amount"} - set(extra)
    return cls(**{k: getattr(r, k) for k in fields if hasattr(r, k)}, **extra, status=_status(r),
               unallocated_amount=Decimal(0) if r.reversed_at else r.amount - r.allocated_amount)


def list_payments(db: Session, tab: str, customer_id: uuid.UUID | None, q: str | None, sort: str, desc: bool, page: int, limit: int) -> tuple[list[PaymentOut], int]:
    if tab not in TABS or sort not in SORTS:
        raise ApiError(400, "bad_request", "Unknown tab or sort.")
    where = (f"{TABS[tab]} and (cast(:c as uuid) is null or p.customer_id = :c) and (cast(:q as text) is null or p.number ilike '%' || :q || '%' "
             "or coalesce(p.reference, '') ilike '%' || :q || '%' or coalesce(p.payer_name_raw, '') ilike '%' || :q || '%')")
    args = {"c": customer_id, "q": q or None}
    total = db.execute(text(f"select count(*) from payments p where {where}"), args).scalar_one()  # noqa: S608
    rows = db.execute(text(f"select {COLS} from payments p left join customers c on c.id = p.customer_id and c.organization_id = p.organization_id "  # noqa: S608
                           f"where {where} order by {SORTS[sort]} {'desc' if desc else 'asc'}, p.id limit :n offset :o"),
                      {**args, "n": limit, "o": (page - 1) * limit}).all()
    return [_out(r) for r in rows], int(total)


def get(db: Session, pid: uuid.UUID) -> PaymentDetail:
    r = db.execute(text(f"select {COLS} from payments p left join customers c on c.id = p.customer_id and c.organization_id = p.organization_id "  # noqa: S608
                        "where p.id = :p"), {"p": pid}).first()
    if r is None:
        raise ApiError(404, "not_found", "Payment not found.")
    out: PaymentDetail = _out(r, PaymentDetail, allocations=allocations_for(db, payment_id=pid))
    return out


def create(db: Session, org: uuid.UUID, actor: AuthUser, body: PaymentIn, info: RequestInfo) -> PaymentDetail:
    if body.customer_id and not db.execute(text("select 1 from customers where id = :c"), {"c": body.customer_id}).first():
        raise ApiError(422, "validation_error", "Choose an existing customer.")
    currency = body.currency or db.execute(text("select default_currency from organizations")).scalar_one().strip()
    pid = db.execute(text(
        "insert into payments (organization_id, number, customer_id, payment_date, amount, currency, method, reference, memo, payer_name_raw, verification_level) "
        "values (:o, next_number(:o, 'payment', 'PAY'), :c, :d, :a, :cur, :m, :r, :memo, :payer, 'manual') returning id"),
        {"o": org, "c": body.customer_id, "d": body.payment_date, "a": body.amount, "cur": currency, "m": body.method, "r": body.reference,
         "memo": body.memo, "payer": body.payer_name_raw}).scalar_one()
    audit.record(db, org, "payment.created", actor_id=actor.id, record_type="payment", record_id=pid,
                 after={"amount": str(body.amount), "currency": currency, "verification_level": "manual"}, info=info)
    return get(db, pid)


def allocate(db: Session, org: uuid.UUID, actor: AuthUser, pid: uuid.UUID, iid: uuid.UUID, amount: Decimal, method: str, info: RequestInfo) -> PaymentDetail:
    """Applies part of a payment to an invoice. Locks the payment, then the invoice, in that order, so concurrent allocations cannot overspend either."""
    p = db.execute(text("select amount, allocated_amount, currency, direction, reversed_at, number from payments where id = :p for update"), {"p": pid}).first()
    if p is None:
        raise ApiError(404, "not_found", "Payment not found.")
    inv = db.execute(text("select total_amount, amount_paid, amount_adjusted, balance_due, currency, lifecycle_status, invoice_number "
                          "from invoices where id = :i for update"), {"i": iid}).first()
    if inv is None:
        raise ApiError(422, "validation_error", "Choose an open invoice.", [{"field": "invoice_id", "code": "not_found", "message": "Unknown invoice."}])
    if p.reversed_at is not None or p.direction != "in":
        raise ApiError(409, "invalid_state", "This payment cannot be allocated.")
    if inv.lifecycle_status != "issued":
        raise ApiError(409, "invalid_state", "Only issued invoices can receive payments.")
    if p.currency != inv.currency:
        raise ApiError(422, "business_rule_violation", "The payment and the invoice are in different currencies.", [{"field": "invoice_id", "code": "currency_mismatch", "message": "currency_mismatch"}])
    if amount <= 0:
        raise ApiError(422, "validation_error", "Enter an amount above zero.")
    room = max_allocation(p.amount, p.allocated_amount, inv.balance_due)
    if amount > room:
        raise ApiError(422, "business_rule_violation", f"The most that can be applied is {room}.", [{"field": "amount", "code": "allocation_exceeds_balance", "message": "allocation_exceeds_balance"}])
    if db.execute(text("select 1 from payment_allocations where payment_id = :p and invoice_id = :i and voided_at is null"), {"p": pid, "i": iid}).first():
        raise ApiError(409, "duplicate", "This payment is already applied to this invoice. Void that allocation first to change it.")
    aid = db.execute(text("insert into payment_allocations (organization_id, payment_id, invoice_id, amount, currency, method, created_by) "
                          "values (:o, :p, :i, :a, :c, :m, :u) returning id"), {"o": org, "p": pid, "i": iid, "a": amount, "c": p.currency, "m": method, "u": actor.id}).scalar_one()
    db.execute(text("update payments set allocated_amount = allocated_amount + :a, version = version + 1, updated_at = now() where id = :p"), {"a": amount, "p": pid})
    db.execute(text("update invoices set amount_paid = amount_paid + :a, balance_due = balance_due - :a, version = version + 1, updated_at = now() where id = :i"), {"a": amount, "i": iid})
    audit.record(db, org, "allocation.created", actor_id=actor.id, record_type="payment_allocation", record_id=aid,
                 before={"invoice_balance": str(inv.balance_due), "payment_unallocated": str(p.amount - p.allocated_amount)},
                 after={"payment": p.number, "invoice": inv.invoice_number, "amount": str(amount), "invoice_balance": str(inv.balance_due - amount),
                        "payment_unallocated": str(p.amount - p.allocated_amount - amount)}, info=info)
    return get(db, pid)


def _void(db: Session, org: uuid.UUID, actor: AuthUser, a: Any, reason: str, info: RequestInfo) -> None:
    db.execute(text("update payment_allocations set voided_at = now(), voided_by = :u, void_reason = :r where id = :a"), {"u": actor.id, "r": reason, "a": a.id})
    db.execute(text("update payments set allocated_amount = allocated_amount - :a, version = version + 1, updated_at = now() where id = :p"), {"a": a.amount, "p": a.payment_id})
    db.execute(text("update invoices set amount_paid = amount_paid - :a, balance_due = balance_due + :a, version = version + 1, updated_at = now() where id = :i"), {"a": a.amount, "i": a.invoice_id})
    audit.record(db, org, "allocation.voided", actor_id=actor.id, record_type="payment_allocation", record_id=a.id,
                 after={"amount": str(a.amount), "reason": reason}, info=info)


def void_allocation(db: Session, org: uuid.UUID, actor: AuthUser, aid: uuid.UUID, reason: str, info: RequestInfo) -> PaymentDetail:
    a = db.execute(text("select id, payment_id, invoice_id, amount, voided_at from payment_allocations where id = :a"), {"a": aid}).first()
    if a is None:
        raise ApiError(404, "not_found", "Allocation not found.")
    db.execute(text("select 1 from payments where id = :p for update"), {"p": a.payment_id})
    db.execute(text("select 1 from invoices where id = :i for update"), {"i": a.invoice_id})
    if db.execute(text("select voided_at from payment_allocations where id = :a"), {"a": aid}).scalar_one() is not None:
        raise ApiError(409, "invalid_state", "This allocation is already voided.")
    _void(db, org, actor, a, reason.strip(), info)
    return get(db, a.payment_id)


def reverse(db: Session, org: uuid.UUID, actor: AuthUser, pid: uuid.UUID, reason: str, info: RequestInfo) -> PaymentDetail:
    p = db.execute(text("select reversed_at, number from payments where id = :p for update"), {"p": pid}).first()
    if p is None:
        raise ApiError(404, "not_found", "Payment not found.")
    if p.reversed_at is not None:
        raise ApiError(409, "invalid_state", "This payment is already reversed.")
    acts = db.execute(text("select id, payment_id, invoice_id, amount from payment_allocations where payment_id = :p and voided_at is null order by invoice_id"), {"p": pid}).all()
    for a in acts:  # invoices in a fixed order, after the payment: same lock order as allocate
        db.execute(text("select 1 from invoices where id = :i for update"), {"i": a.invoice_id})
        _void(db, org, actor, a, f"Payment reversed: {reason.strip()}", info)
    db.execute(text("update payments set reversed_at = now(), reversal_reason = :r, version = version + 1, updated_at = now() where id = :p"), {"r": reason.strip(), "p": pid})
    audit.record(db, org, "payment.reversed", actor_id=actor.id, record_type="payment", record_id=pid,
                 after={"number": p.number, "reason": reason.strip(), "allocations_voided": len(acts)}, info=info)
    return get(db, pid)


def set_review(db: Session, org: uuid.UUID, actor: AuthUser, pid: uuid.UUID, under_review: bool, info: RequestInfo) -> PaymentDetail:
    n = db.execute(text("update payments set under_review = :r, version = version + 1, updated_at = now() where id = :p and reversed_at is null returning id"),
                   {"r": under_review, "p": pid}).first()
    if n is None:
        raise ApiError(404, "not_found", "Payment not found or reversed.")
    audit.record(db, org, "payment.review_changed", actor_id=actor.id, record_type="payment", record_id=pid, after={"under_review": under_review}, info=info)
    return get(db, pid)


def record_for_invoice(db: Session, org: uuid.UUID, actor: AuthUser, iid: uuid.UUID, amount: Decimal, method: str | None, reference: str | None,
                       when: date, info: RequestInfo) -> PaymentDetail:
    """A manual payment typed on an invoice: creates the payment, then applies it. Unverified until matched to a bank record."""
    inv = db.execute(text("select customer_id, currency, balance_due from invoices where id = :i"), {"i": iid}).first()
    if inv is None:
        raise ApiError(404, "not_found", "Invoice not found.")
    if amount > inv.balance_due:
        raise ApiError(422, "business_rule_violation", f"The amount cannot exceed the balance of {inv.balance_due}.",
                       [{"field": "amount", "code": "allocation_exceeds_balance", "message": "allocation_exceeds_balance"}])
    pay = create(db, org, actor, PaymentIn(payment_date=when, amount=amount, currency=inv.currency.strip(), method=method, reference=reference, customer_id=inv.customer_id), info)
    return allocate(db, org, actor, pay.id, iid, amount, "manual", info)
