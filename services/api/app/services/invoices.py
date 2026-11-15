import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.money import round_half_even
from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser
from app.schemas.ledger import AllocationOut, InvoiceDetail, InvoiceIn, InvoiceOut, LineOut
from app.services import audit
from app.services.ledger import InvoiceFacts, balance, days_late, display_status

SORTS = {"invoice": "i.invoice_number", "customer": "lower(c.name)", "due": "i.due_date", "total": "i.total_amount", "balance": "i.balance_due", "days_late": "i.due_date"}
TABS = {
    "all": "true",
    "open": "i.lifecycle_status = 'issued' and i.balance_due > 0",
    "overdue": "i.lifecycle_status = 'issued' and i.balance_due > 0 and i.due_date < :today",
    "paid": "i.lifecycle_status = 'issued' and i.balance_due = 0",
    "cancelled": "i.lifecycle_status = 'cancelled'",
    "disputed": "false",  # disputes arrive with the disputes module
}
COLS = ("i.id, i.invoice_number, i.customer_id, c.name as customer_name, i.po_number, i.issue_date, i.due_date, i.currency, i.total_amount, "
        "i.amount_paid, i.amount_adjusted, i.balance_due, i.lifecycle_status, i.version, i.description, i.cancel_reason")


def _out(r: Any, today: date, cls: type[InvoiceOut] = InvoiceOut, **extra: Any) -> Any:
    facts = InvoiceFacts(r.lifecycle_status, r.total_amount, r.amount_paid, r.amount_adjusted, r.due_date)
    open_ = r.lifecycle_status == "issued"
    keys = set(cls.model_fields) - {"status", "days_late", "balance_due"} - set(extra)
    data = {k: getattr(r, k) for k in keys if hasattr(r, k)}
    return cls(**data, **extra, status=display_status(facts, today).value,
               days_late=days_late(r.due_date, today) if open_ and r.balance_due > 0 else 0,
               balance_due=balance(r.total_amount, r.amount_paid, r.amount_adjusted) if open_ else Decimal(0))


def list_invoices(db: Session, today: date, tab: str, customer_id: uuid.UUID | None, q: str | None, sort: str, desc: bool, page: int,
                  limit: int) -> tuple[list[InvoiceOut], int]:
    if tab not in TABS or sort not in SORTS:
        raise ApiError(400, "bad_request", "Unknown tab or sort.")
    order = f"{SORTS[sort]} {'desc' if desc else 'asc'}, i.id"
    where = f"{TABS[tab]} and (cast(:c as uuid) is null or i.customer_id = :c) and (cast(:q as text) is null or i.invoice_number ilike '%' || :q || '%' " \
            f"or c.name ilike '%' || :q || '%' or coalesce(i.po_number, '') ilike '%' || :q || '%')"
    total = db.execute(text(f"select count(*) from invoices i join customers c on c.id = i.customer_id where {where}"),  # noqa: S608
                       {"today": today, "c": customer_id, "q": q or None}).scalar_one()
    rows = db.execute(text(f"select {COLS} from invoices i join customers c on c.id = i.customer_id and c.organization_id = i.organization_id "  # noqa: S608
                           f"where {where} order by {order} limit :n offset :o"),
                      {"today": today, "c": customer_id, "q": q or None, "n": limit, "o": (page - 1) * limit}).all()
    return [_out(r, today) for r in rows], int(total)


def allocations_for(db: Session, *, invoice_id: uuid.UUID | None = None, payment_id: uuid.UUID | None = None) -> list[AllocationOut]:
    rows = db.execute(text(
        "select a.id, a.payment_id, p.number as payment_number, a.invoice_id, i.invoice_number, a.amount, a.currency, a.method, a.created_at, "
        "a.voided_at, a.void_reason from payment_allocations a join payments p on p.id = a.payment_id join invoices i on i.id = a.invoice_id "
        "where (cast(:i as uuid) is null or a.invoice_id = :i) and (cast(:p as uuid) is null or a.payment_id = :p) order by a.created_at"),
        {"i": invoice_id, "p": payment_id}).all()
    return [AllocationOut(**r._mapping) for r in rows]


def get(db: Session, today: date, iid: uuid.UUID) -> InvoiceDetail:
    r = db.execute(text(f"select {COLS} from invoices i join customers c on c.id = i.customer_id and c.organization_id = i.organization_id "  # noqa: S608
                        "where i.id = :i"), {"i": iid}).first()
    if r is None:
        raise ApiError(404, "not_found", "Invoice not found.")
    lines = [LineOut(**x._mapping) for x in db.execute(text(
        "select position, description, quantity, unit_price, amount from invoice_line_items where invoice_id = :i order by position"), {"i": iid})]
    out: InvoiceDetail = _out(r, today, InvoiceDetail, lines=lines, allocations=allocations_for(db, invoice_id=iid))
    return out


def create(db: Session, org: uuid.UUID, actor: AuthUser, body: InvoiceIn, today: date, info: RequestInfo) -> InvoiceDetail:
    if body.due_date < body.issue_date:
        raise ApiError(422, "validation_error", "The due date cannot be before the issue date.", [{"field": "due_date", "code": "before_issue", "message": "Due date is before issue date."}])
    cust = db.execute(text("select id from customers where id = :c and status = 'active'"), {"c": body.customer_id}).first()
    if cust is None:
        raise ApiError(422, "validation_error", "Choose an existing customer.", [{"field": "customer_id", "code": "not_found", "message": "Unknown customer."}])
    currency = body.currency or db.execute(text("select default_currency from organizations")).scalar_one().strip()
    lines = [(i + 1, ln.description.strip(), ln.quantity, ln.unit_price, round_half_even(ln.quantity * ln.unit_price, currency)) for i, ln in enumerate(body.lines)]
    for pos, desc, qty, price, _ in lines:
        if not desc or qty <= 0 or price < 0:
            raise ApiError(422, "validation_error", "Each line needs a description, a quantity above zero and a price.", [{"field": f"lines[{pos - 1}]", "code": "invalid", "message": "Invalid line."}])
    total = sum((x[4] for x in lines), Decimal(0))
    if total <= 0:
        raise ApiError(422, "validation_error", "The invoice total must be above zero.")
    number = body.invoice_number.strip() if body.invoice_number and body.invoice_number.strip() else db.execute(
        text("select next_number(:o, 'invoice', 'INV')"), {"o": org}).scalar_one()
    try:
        with db.begin_nested():
            iid = db.execute(text(
                "insert into invoices (organization_id, customer_id, invoice_number, po_number, issue_date, due_date, currency, total_amount, balance_due, description) "
                "values (:o, :c, :n, :po, :issue, :due, :cur, :t, :t, :d) returning id"),
                {"o": org, "c": body.customer_id, "n": number, "po": body.po_number, "issue": body.issue_date, "due": body.due_date,
                 "cur": currency, "t": total, "d": body.description}).scalar_one()
    except IntegrityError as e:
        raise ApiError(409, "duplicate", f"Invoice {number} already exists for this customer.") from e
    for pos, desc, qty, price, amount in lines:
        db.execute(text("insert into invoice_line_items (organization_id, invoice_id, position, description, quantity, unit_price, amount) "
                        "values (:o, :i, :p, :d, :q, :u, :a)"), {"o": org, "i": iid, "p": pos, "d": desc, "q": qty, "u": price, "a": amount})
    audit.record(db, org, "invoice.created", actor_id=actor.id, record_type="invoice", record_id=iid,
                 after={"invoice_number": number, "customer_id": str(body.customer_id), "total_amount": str(total), "currency": currency}, info=info)
    return get(db, today, iid)


def cancel(db: Session, org: uuid.UUID, actor: AuthUser, iid: uuid.UUID, reason: str, today: date, info: RequestInfo) -> InvoiceDetail:
    r = db.execute(text("select lifecycle_status, invoice_number from invoices where id = :i for update"), {"i": iid}).first()
    if r is None:
        raise ApiError(404, "not_found", "Invoice not found.")
    if r.lifecycle_status == "cancelled":
        raise ApiError(409, "invalid_state", "This invoice is already cancelled.")
    if db.execute(text("select 1 from payment_allocations where invoice_id = :i and voided_at is null"), {"i": iid}).first():
        raise ApiError(409, "invalid_state", "Void the payments applied to this invoice before cancelling it.")
    db.execute(text("update invoices set lifecycle_status = 'cancelled', cancelled_at = now(), cancel_reason = :r, version = version + 1, "
                    "updated_at = now() where id = :i"), {"r": reason.strip(), "i": iid})
    audit.record(db, org, "invoice.cancelled", actor_id=actor.id, record_type="invoice", record_id=iid,
                 before={"lifecycle_status": r.lifecycle_status}, after={"lifecycle_status": "cancelled", "reason": reason.strip()}, info=info)
    return get(db, today, iid)
