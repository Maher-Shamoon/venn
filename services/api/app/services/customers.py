import uuid
from datetime import date
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser
from app.schemas.ledger import CustomerIn, CustomerOut, CustomerPatch
from app.services import audit

SORTS = {
    "name": "lower(c.name)", "open_balance": "open_balance", "overdue": "overdue", "open_invoices": "open_invoices",
    "last_payment": "last_payment", "avg_days_to_pay": "avg_days_to_pay",
}

SELECT = """
  select c.id, c.name, c.legal_name, c.contact_name, c.contact_email, c.city, c.payment_terms_days, c.payer_aliases,
    c.notes, c.version,
    coalesce(sum(i.balance_due) filter (where i.lifecycle_status = 'issued' and i.balance_due > 0), 0) as open_balance,
    coalesce(sum(i.balance_due) filter (where i.lifecycle_status = 'issued' and i.balance_due > 0 and i.due_date < :today), 0) as overdue,
    count(i.id) filter (where i.lifecycle_status = 'issued' and i.balance_due > 0) as open_invoices,
    (select max(p.payment_date) from payments p where p.customer_id = c.id and p.reversed_at is null and p.direction = 'in') as last_payment,
    (select round(avg(p.payment_date - i2.issue_date))::int
       from payment_allocations a join payments p on p.id = a.payment_id join invoices i2 on i2.id = a.invoice_id
      where i2.customer_id = c.id and a.voided_at is null and i2.balance_due = 0
        and p.payment_date >= cast(:today as date) - 365) as avg_days_to_pay,
    count(*) over () as total
  from customers c
  left join invoices i on i.customer_id = c.id and i.organization_id = c.organization_id
  where c.status = 'active'
    and (cast(:q as text) is null or c.name ilike '%' || :q || '%'
         or exists (select 1 from unnest(c.payer_aliases) al where al ilike '%' || :q || '%'))
  group by c.id
"""


def _out(r: Any) -> CustomerOut:
    return CustomerOut(**{k: v for k, v in r._mapping.items() if k != "total"})


def list_customers(db: Session, today: date, q: str | None, flt: str, sort: str, desc: bool, page: int, limit: int) -> tuple[list[CustomerOut], int]:
    if sort not in SORTS:
        raise ApiError(400, "bad_request", f"Cannot sort by {sort}.")
    having = {"all": "", "overdue": "having coalesce(sum(i.balance_due) filter (where i.lifecycle_status = 'issued' "
                                    "and i.balance_due > 0 and i.due_date < :today), 0) > 0"}.get(flt)
    if having is None:
        raise ApiError(400, "bad_request", "Unknown filter.")
    order = f"{SORTS[sort]} {'desc' if desc else 'asc'} nulls last, c.id"
    rows = db.execute(text(f"{SELECT} {having} order by {order} limit :n offset :o"),  # noqa: S608  (parts come from fixed maps)
                      {"today": today, "q": q or None, "n": limit, "o": (page - 1) * limit}).all()
    return [_out(r) for r in rows], int(rows[0].total) if rows else 0


def get(db: Session, today: date, cid: uuid.UUID) -> CustomerOut:
    r = db.execute(text(SELECT.replace("where c.status = 'active'", "where c.id = :cid")), {"today": today, "q": None, "cid": cid}).first()
    if r is None:
        raise ApiError(404, "not_found", "Customer not found.")
    return _out(r)


def _name_taken(db: Session, org: uuid.UUID, name: str, except_id: uuid.UUID | None = None) -> bool:
    return db.execute(text("select 1 from customers where organization_id = :o and lower(name) = lower(:n) and status = 'active' "
                           "and (cast(:x as uuid) is null or id <> :x)"), {"o": org, "n": name, "x": except_id}).first() is not None


def create(db: Session, org: uuid.UUID, actor: AuthUser, body: CustomerIn, today: date, info: RequestInfo) -> CustomerOut:
    if _name_taken(db, org, body.name):
        raise ApiError(409, "duplicate", f"A customer named {body.name} already exists.")
    cid = db.execute(text(
        "insert into customers (organization_id, name, legal_name, contact_name, contact_email, city, payment_terms_days, payer_aliases, notes) "
        "values (:o, :name, :legal_name, :contact_name, :contact_email, :city, :payment_terms_days, :payer_aliases, :notes) returning id"),
        {"o": org, **body.model_dump()}).scalar_one()
    audit.record(db, org, "customer.created", actor_id=actor.id, record_type="customer", record_id=cid, after=body.model_dump(), info=info)
    return get(db, today, cid)


def update(db: Session, org: uuid.UUID, actor: AuthUser, cid: uuid.UUID, body: CustomerPatch, expected: int | None,
           today: date, info: RequestInfo) -> CustomerOut:
    cur = db.execute(text("select name, legal_name, contact_name, contact_email, city, payment_terms_days, payer_aliases, notes, version "
                          "from customers where id = :i and status = 'active' for update"), {"i": cid}).first()
    if cur is None:
        raise ApiError(404, "not_found", "Customer not found.")
    if expected is not None and cur.version != expected:
        raise ApiError(409, "version_conflict", "Someone else changed this customer. Reload to see the latest.")
    changes = body.model_dump(exclude_unset=True)
    if "name" in changes:
        if not (changes["name"] or "").strip():
            raise ApiError(422, "validation_error", "Customer name is required.")
        changes["name"] = changes["name"].strip()
        if _name_taken(db, org, changes["name"], cid):
            raise ApiError(409, "duplicate", f"A customer named {changes['name']} already exists.")
    if "payer_aliases" in changes and changes["payer_aliases"] is not None:
        changes["payer_aliases"] = CustomerIn(name="x", payer_aliases=changes["payer_aliases"]).payer_aliases
    if changes:
        sets = ", ".join(f"{k} = :{k}" for k in changes)  # keys come from CustomerPatch fields
        db.execute(text(f"update customers set {sets}, version = version + 1, updated_at = now() where id = :id"), {**changes, "id": cid})  # noqa: S608
        audit.record(db, org, "customer.updated", actor_id=actor.id, record_type="customer", record_id=cid,
                     before={k: cur._mapping[k] for k in changes}, after=changes, info=info)
    return get(db, today, cid)
