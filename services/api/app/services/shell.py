"""What the app frame needs about the signed-in person and organization: names, the badge counts in the sidebar, and global search."""

import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

PER_GROUP = 5


def frame(db: Session, user: uuid.UUID, permissions: frozenset[str]) -> dict[str, Any]:
    o = db.execute(text("select name from organizations")).scalar_one()
    p = db.execute(text("select full_name, email from profiles where id = :u"), {"u": user}).first()
    decider = "approvals.decide" in permissions
    counts = db.execute(text(
        "select (select count(*) from recon_suggestions where status = 'pending') as reconciliation, "
        "(select count(*) from investigations where status not in ('resolved', 'dismissed') and (:all or assignee_id = :u)) as investigations, "
        "(select count(*) from approval_requests where status = 'pending' and (:decider or requested_by = :u)) as approvals"),
        {"u": user, "all": "investigations.assign" in permissions, "decider": decider}).one()
    return {"organization": {"name": o}, "user": {"name": p.full_name if p else "", "email": p.email if p else ""},
            "counts": {"reconciliation": int(counts.reconciliation), "investigations": int(counts.investigations), "approvals": int(counts.approvals)}}


def search(db: Session, q: str, permissions: frozenset[str]) -> dict[str, Any]:
    needle = q.strip()
    out: dict[str, Any] = {"customers": [], "invoices": [], "payments": [], "investigations": []}
    if len(needle) < 2:
        return out
    args = {"q": needle, "n": PER_GROUP}
    if "customers.view" in permissions:
        out["customers"] = [{"id": str(r.id), "name": r.name} for r in db.execute(text(
            "select id, name from customers where name ilike '%' || :q || '%' or exists (select 1 from unnest(payer_aliases) a where a ilike '%' || :q || '%') order by name limit :n"), args).all()]
    if "invoices.view" in permissions:
        out["invoices"] = [{"id": str(r.id), "number": r.invoice_number, "customer": r.customer, "balance": r.balance_due, "currency": r.currency.strip()} for r in db.execute(text(
            "select i.id, i.invoice_number, c.name as customer, i.balance_due, i.currency from invoices i join customers c on c.id = i.customer_id "
            "where i.invoice_number ilike '%' || :q || '%' or c.name ilike '%' || :q || '%' or coalesce(i.po_number, '') ilike '%' || :q || '%' order by i.due_date desc limit :n"), args).all()]
    if "payments.view" in permissions:
        out["payments"] = [{"id": str(r.id), "number": r.number, "payer": r.payer_name_raw, "amount": r.amount, "currency": r.currency.strip()} for r in db.execute(text(
            "select id, number, payer_name_raw, amount, currency from payments where number ilike '%' || :q || '%' or coalesce(reference, '') ilike '%' || :q || '%' "
            "or coalesce(payer_name_raw, '') ilike '%' || :q || '%' order by payment_date desc limit :n"), args).all()]
    if "investigations.view" in permissions:
        out["investigations"] = [{"id": str(r.id), "number": r.number, "title": r.title} for r in db.execute(text(
            "select id, number, title from investigations where number ilike '%' || :q || '%' or title ilike '%' || :q || '%' order by created_at desc limit :n"), args).all()]
    return out
