"""Dashboards and reports (MOD-05, MOD-15): every number is an aggregate over stored records. No model writes or estimates any figure.

The outstanding-balance history is rebuilt from the immutable history (invoices, allocations with their void times, adjustments), so a past
point never changes when records are edited and no snapshot table is needed yet. Everything is filtered to the organization's default
currency; other currencies are counted, never converted.
"""

import csv
import io
import uuid
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError

RANGES = {"7d": 7, "30d": 30, "90d": 90, "12m": 365}
BUCKETS = ("Current", "1 to 30 days", "31 to 60 days", "61 to 90 days", "Over 90 days")
OPEN_INVOICE = "i.lifecycle_status = 'issued' and i.balance_due > 0 and i.currency = :cur"


def _range(r: str) -> int:
    if r not in RANGES:
        raise ApiError(400, "bad_request", "Range must be 7d, 30d, 90d or 12m.")
    return RANGES[r]


def points(r: str, today: date) -> list[date]:
    """7d daily; 30d the last five weeks; 90d thirteen weeks; 12m month ends (the last point is today)."""
    _range(r)
    if r == "7d":
        return [today - timedelta(days=n) for n in range(6, -1, -1)]
    if r in ("30d", "90d"):
        return [today - timedelta(days=7 * n) for n in range(4 if r == "30d" else 12, -1, -1)]
    out: list[date] = []
    y, m = today.year, today.month
    for _ in range(12):
        out.append(today if (y, m) == (today.year, today.month) else date(y + (m == 12), m % 12 + 1, 1) - timedelta(days=1))
        y, m = (y, m - 1) if m > 1 else (y - 1, 12)
    return out[::-1]


def label(r: str, d: date) -> str:
    return d.strftime("%b %Y") if r == "12m" else d.strftime("%a %d") if r == "7d" else f"{d.day} {d.strftime('%b')}"


def _ctx(db: Session) -> tuple[str, str]:
    o = db.execute(text("select default_currency, timezone from organizations")).one()
    return o.default_currency.strip(), o.timezone


def _money(v: Any) -> Decimal:
    return Decimal(v or 0)


HISTORY_SQL = """
select d.d as day,
 (select coalesce(sum(i.total_amount), 0) from invoices i where i.issue_date <= d.d and i.lifecycle_status <> 'draft' and i.currency = :cur
    and (i.cancelled_at is null or (i.cancelled_at at time zone :tz)::date > d.d)) as inv_all,
 (select coalesce(sum(i.total_amount), 0) from invoices i where i.issue_date <= d.d and i.due_date < d.d and i.lifecycle_status <> 'draft' and i.currency = :cur
    and (i.cancelled_at is null or (i.cancelled_at at time zone :tz)::date > d.d)) as inv_late,
 (select coalesce(sum(a.amount), 0) from payment_allocations a join invoices i on i.id = a.invoice_id where i.currency = :cur and i.lifecycle_status <> 'draft' and (i.cancelled_at is null or (i.cancelled_at at time zone :tz)::date > d.d) and (a.created_at at time zone :tz)::date <= d.d
    and (a.voided_at is null or (a.voided_at at time zone :tz)::date > d.d)) as paid_all,
 (select coalesce(sum(a.amount), 0) from payment_allocations a join invoices i on i.id = a.invoice_id where i.currency = :cur and i.due_date < d.d and i.lifecycle_status <> 'draft' and (i.cancelled_at is null or (i.cancelled_at at time zone :tz)::date > d.d) and (a.created_at at time zone :tz)::date <= d.d
    and (a.voided_at is null or (a.voided_at at time zone :tz)::date > d.d)) as paid_late,
 (select coalesce(sum(j.amount), 0) from adjustments j join invoices i on i.id = j.invoice_id where j.affects_balance and i.currency = :cur and i.lifecycle_status <> 'draft' and (i.cancelled_at is null or (i.cancelled_at at time zone :tz)::date > d.d) and (j.created_at at time zone :tz)::date <= d.d) as adj_all,
 (select coalesce(sum(j.amount), 0) from adjustments j join invoices i on i.id = j.invoice_id where j.affects_balance and i.currency = :cur and i.due_date < d.d and i.lifecycle_status <> 'draft' and (i.cancelled_at is null or (i.cancelled_at at time zone :tz)::date > d.d) and (j.created_at at time zone :tz)::date <= d.d) as adj_late
from unnest(cast(:dates as date[])) as d(d) order by d.d
"""


def history(db: Session, dates: list[date], cur: str, tz: str) -> list[dict[str, Any]]:
    rows = db.execute(text(HISTORY_SQL), {"dates": dates, "tz": tz, "cur": cur}).all()
    return [{"date": r.day, "total": _money(r.inv_all) - _money(r.paid_all) - _money(r.adj_all), "overdue": _money(r.inv_late) - _money(r.paid_late) - _money(r.adj_late)} for r in rows]


AGING_SQL = ("select case when i.due_date >= :t then 0 when :t - i.due_date <= 30 then 1 when :t - i.due_date <= 60 then 2 when :t - i.due_date <= 90 then 3 else 4 end as b, "
             "count(*) as n, sum(i.balance_due) as amount from invoices i where " + OPEN_INVOICE + " and (cast(:c as uuid) is null or i.customer_id = :c) group by 1")
OVERDUE_SQL = ("select c.id, c.name, count(*) as n, sum(i.balance_due) as amount, max(:t - i.due_date) as oldest from invoices i join customers c on c.id = i.customer_id where " + OPEN_INVOICE +
               " and i.due_date < :t and (cast(:days as int) is null or i.due_date >= :t - cast(:days as int)) and (cast(:c as uuid) is null or i.customer_id = :c) "
               "group by c.id, c.name order by sum(i.balance_due) desc, c.name limit :l")


def aging(db: Session, today: date, cur: str, customer: uuid.UUID | None = None) -> list[dict[str, Any]]:
    rows = db.execute(text(AGING_SQL), {"t": today, "cur": cur, "c": customer}).all()
    by = {r.b: r for r in rows}
    return [{"bucket": BUCKETS[n], "amount": _money(by[n].amount) if n in by else Decimal(0), "count": int(by[n].n) if n in by else 0} for n in range(5)]


def overdue_by_customer(db: Session, today: date, cur: str, days: int | None, limit: int | None, customer: uuid.UUID | None = None) -> list[dict[str, Any]]:
    rows = db.execute(text(OVERDUE_SQL), {"t": today, "cur": cur, "days": days, "c": customer, "l": limit or 1000}).all()
    return [{"customer_id": str(r.id), "customer": r.name, "invoices": int(r.n), "amount": _money(r.amount), "oldest_days": int(r.oldest)} for r in rows]


def _kpis(db: Session, today: date, cur: str) -> dict[str, Any]:
    a = db.execute(text(f"select count(*) as n, coalesce(sum(i.balance_due), 0) as total, coalesce(sum(case when i.due_date < :t then i.balance_due else 0 end), 0) as overdue, "
                        f"count(*) filter (where i.due_date < :t) as overdue_n from invoices i where {OPEN_INVOICE}"), {"t": today, "cur": cur}).one()
    u = db.execute(text("select count(*) as n, coalesce(sum(p.amount - p.allocated_amount), 0) as amount from payments p where p.reversed_at is null and p.direction = 'in' "
                        "and p.allocated_amount < p.amount and p.currency = :cur"), {"cur": cur}).one()
    e = db.execute(text("select count(*) as n, coalesce(sum(exposure), 0) as amount from investigations where status not in ('resolved', 'dismissed') and currency = :cur"), {"cur": cur}).one()
    other = db.execute(text("select count(distinct currency) from invoices where lifecycle_status = 'issued' and balance_due > 0 and currency <> :cur"), {"cur": cur}).scalar_one()
    return {"total_ar": _money(a.total), "open_invoices": int(a.n), "overdue": _money(a.overdue), "overdue_invoices": int(a.overdue_n), "unmatched": _money(u.amount), "unmatched_payments": int(u.n),
            "open_exposure": _money(e.amount), "open_investigations": int(e.n), "other_currencies": int(other)}


def recovered(db: Session, since: date, today: date, cur: str, tz: str) -> tuple[Decimal, list[dict[str, Any]]]:
    """Money received after venn started an investigation and confirmed by a source: allocations of source-verified payments to invoices with a case opened before the allocation."""
    rows = db.execute(text(
        "select a.id, a.amount, (a.created_at at time zone :tz)::date as day, p.number as payment, i.invoice_number, c.name as customer from payment_allocations a "
        "join payments p on p.id = a.payment_id join invoices i on i.id = a.invoice_id join customers c on c.id = i.customer_id "
        "where a.voided_at is null and p.verification_level = 'source_verified' and a.currency = :cur and (a.created_at at time zone :tz)::date between :s and :t "
        "and exists (select 1 from investigations g where g.invoice_id = i.id and g.created_at <= a.created_at) order by a.created_at desc"), {"tz": tz, "cur": cur, "s": since, "t": today}).all()
    items = [{"date": r.day, "payment": r.payment, "invoice": r.invoice_number, "customer": r.customer, "amount": _money(r.amount)} for r in rows]
    return sum((x["amount"] for x in items), Decimal(0)), items


def owner(db: Session, rng: str, today: date) -> dict[str, Any]:
    days = _range(rng)
    cur, tz = _ctx(db)
    pts = points(rng, today)
    hist = history(db, pts, cur, tz)
    k = _kpis(db, today, cur)
    rec_total, _ = recovered(db, today - timedelta(days=days), today, cur, tz)
    apr = db.execute(text("select r.id, r.number, r.type, r.amount, r.currency, c.name as customer, p.full_name as requester from approval_requests r join invoices i on i.id = r.invoice_id "
                          "join customers c on c.id = i.customer_id join profiles p on p.id = r.requested_by where r.status = 'pending' order by r.requested_at limit 5")).all()
    statuses = {r.status: int(r.n) for r in db.execute(text("select status, count(*) as n from investigations where status not in ('resolved', 'dismissed') group by status")).all()}
    top = db.execute(text("select g.id, g.number, g.title, g.exposure, g.currency, g.priority from investigations g where g.status not in ('resolved', 'dismissed') order by g.exposure desc, g.created_at limit 5")).all()
    act = db.execute(text("select e.action, e.occurred_at as created_at, p.full_name as who from audit_events e left join profiles p on p.id = e.actor_id order by e.seq desc limit 8")).all()
    setup = db.execute(text("select (select count(*) from customers) as customers, (select count(*) from invoices) as invoices, (select count(*) from payments) as payments, "
                            "(select count(*) from recon_runs) as runs, (select count(*) from memberships where status = 'active') as members")).one()
    return {
        "range": rng, "currency": cur, "kpis": {**k, "recovered": rec_total, "total_ar_change": k["total_ar"] - hist[0]["total"]},
        "aging": aging(db, today, cur),
        "trend": [{"date": h["date"], "label": label(rng, h["date"]), "total": h["total"], "overdue": h["overdue"]} for h in hist],
        "approvals": [{"id": str(r.id), "number": r.number, "type": r.type, "amount": r.amount, "currency": r.currency.strip(), "customer": r.customer, "requested_by": r.requester} for r in apr],
        "investigations_by_status": statuses,
        "top_exposure": [{"id": str(r.id), "number": r.number, "title": r.title, "exposure": r.exposure, "currency": r.currency.strip(), "priority": r.priority} for r in top],
        "overdue_by_customer": overdue_by_customer(db, today, cur, days, 10),
        "activity": [{"action": r.action, "at": r.created_at, "by": r.who} for r in act],
        "setup": {"customers": setup.customers > 0, "invoices": setup.invoices > 0, "payments": setup.payments > 0, "reconciliation": setup.runs > 0, "team": setup.members > 1},
        "has_data": setup.invoices > 0 or setup.payments > 0,
    }


def ar(db: Session, user: uuid.UUID, today: date) -> dict[str, Any]:
    cur, _ = _ctx(db)
    sug = db.execute(text("select s.id, s.rule, p.number, p.amount, p.currency, p.payer_name_raw from recon_suggestions s join payments p on p.id = s.payment_id where s.status = 'pending' order by s.created_at desc limit 5")).all()
    n_sug = db.execute(text("select count(*) from recon_suggestions where status = 'pending'")).scalar_one()
    mine = db.execute(text("select g.id, g.number, g.title, g.exposure, g.currency, g.status, g.priority from investigations g where g.assignee_id = :u and g.status not in ('resolved', 'dismissed') "
                           "order by g.exposure desc limit 5"), {"u": user}).all()
    unm = db.execute(text("select p.id, p.number, p.payer_name_raw, p.amount - p.allocated_amount as open_amount, p.currency, p.payment_date from payments p where p.reversed_at is null and p.direction = 'in' "
                          "and p.allocated_amount < p.amount order by p.amount - p.allocated_amount desc limit 5")).all()
    late = db.execute(text(f"select i.id, i.invoice_number, c.name as customer, i.balance_due, i.currency, :t - i.due_date as late from invoices i join customers c on c.id = i.customer_id "
                           f"where {OPEN_INVOICE} and i.due_date < :t order by i.balance_due desc, i.due_date, i.invoice_number limit 5"), {"t": today, "cur": cur}).all()
    reqs = db.execute(text("select r.id, r.number, r.type, r.amount, r.currency, r.status from approval_requests r where r.requested_by = :u and r.status in ('pending', 'info_requested') order by r.requested_at desc limit 5"), {"u": user}).all()
    run = db.execute(text("select started_at, counts from recon_runs order by started_at desc limit 1")).first()
    k = _kpis(db, today, cur)
    return {
        "currency": cur, "needs_review": {"count": int(n_sug), "items": [{"id": str(r.id), "rule": r.rule, "payment": r.number, "amount": r.amount, "currency": r.currency.strip(), "payer": r.payer_name_raw} for r in sug]},
        "my_investigations": [{"id": str(r.id), "number": r.number, "title": r.title, "exposure": r.exposure, "currency": r.currency.strip(), "status": r.status, "priority": r.priority} for r in mine],
        "unmatched": [{"id": str(r.id), "number": r.number, "payer": r.payer_name_raw, "amount": r.open_amount, "currency": r.currency.strip(), "date": r.payment_date} for r in unm],
        "attention": [{"id": str(r.id), "number": r.invoice_number, "customer": r.customer, "balance": r.balance_due, "currency": r.currency.strip(), "days_late": int(r.late)} for r in late],
        "my_requests": [{"id": str(r.id), "number": r.number, "type": r.type, "amount": r.amount, "currency": r.currency.strip(), "status": r.status} for r in reqs],
        "last_run": {"at": run.started_at, "counts": run.counts} if run else None,
        "kpis": {"overdue": k["overdue"], "overdue_invoices": k["overdue_invoices"], "unmatched_payments": k["unmatched_payments"]},
    }


# ----------------------------------------------------------------------------------------------------------- reports
REPORTS = {
    "aging": ("Receivables aging", "financial", "Open invoices grouped by how many days past their due date they are today. Balance is total less payments applied and approved adjustments."),
    "ar-trend": ("Outstanding balance trend", "financial", "What was owed, and how much of it was past due, at the end of each period, rebuilt from invoices, payments applied and approved adjustments as they stood on that day."),
    "overdue-by-customer": ("Overdue by customer", "financial", "Open balance of invoices that fell due in the selected range and are still unpaid, by customer."),
    "recovered": ("Verified recovered", "financial", "Payments confirmed by a connected source and applied to an invoice that had an investigation open before the payment was applied. Manual payments are never counted."),
    "reconciliation-performance": ("Reconciliation performance", "operational", "Matches per period: applied automatically by the exact-match rule, confirmed by a person, and suggestions created that still need a decision."),
    "investigation-resolution": ("Investigation resolution time", "operational", "Investigations resolved in the range, by type, with the average days from opening to resolution."),
}


def catalog(can_financial: bool, can_operational: bool) -> list[dict[str, str]]:
    return [{"slug": s, "title": t, "kind": k, "definition": d} for s, (t, k, d) in REPORTS.items() if (k == "financial" and can_financial) or (k == "operational" and can_operational)]


def report(db: Session, slug: str, rng: str, today: date, customer: uuid.UUID | None, can_financial: bool, can_operational: bool) -> dict[str, Any]:
    if slug not in REPORTS:
        raise ApiError(404, "not_found", "Unknown report.")
    title, kind, definition = REPORTS[slug]
    if (kind == "financial" and not can_financial) or (kind == "operational" and not can_operational):
        raise ApiError(403, "permission_denied", "You cannot open this report.")
    days = _range(rng)
    cur, tz = _ctx(db)
    pts = points(rng, today)
    cols: list[dict[str, Any]]
    rows: list[dict[str, Any]]
    if slug == "aging":
        cols = [{"key": "bucket", "label": "Age"}, {"key": "count", "label": "Invoices", "right": True}, {"key": "amount", "label": "Balance", "money": True}]
        rows = aging(db, today, cur, customer)
    elif slug == "ar-trend":
        cols = [{"key": "label", "label": "Period end"}, {"key": "total", "label": "Outstanding", "money": True}, {"key": "overdue", "label": "Overdue", "money": True}]
        rows = [{"label": label(rng, h["date"]), "total": h["total"], "overdue": h["overdue"]} for h in history(db, pts, cur, tz)]
    elif slug == "overdue-by-customer":
        cols = [{"key": "customer", "label": "Customer"}, {"key": "invoices", "label": "Invoices", "right": True}, {"key": "oldest_days", "label": "Oldest (days late)", "right": True}, {"key": "amount", "label": "Overdue balance", "money": True}]
        rows = overdue_by_customer(db, today, cur, days, None, customer)
    elif slug == "recovered":
        total, items = recovered(db, today - timedelta(days=days), today, cur, tz)
        cols = [{"key": "date", "label": "Date"}, {"key": "customer", "label": "Customer"}, {"key": "invoice", "label": "Invoice"}, {"key": "payment", "label": "Payment"}, {"key": "amount", "label": "Amount", "money": True}]
        rows = items
        return _out(slug, title, definition, rng, cur, cols, rows, {"total": total})
    elif slug == "reconciliation-performance":
        cols = [{"key": "label", "label": "Period end"}, {"key": "auto", "label": "Applied automatically", "right": True}, {"key": "manual", "label": "Confirmed by a person", "right": True}, {"key": "review", "label": "Left for review", "right": True}]
        rows = []
        for i, d in enumerate(pts):
            start = pts[i - 1] if i else d - timedelta(days=(pts[1] - pts[0]).days if len(pts) > 1 else 1)
            r = db.execute(text("select count(*) filter (where method = 'auto_rule') as auto, count(*) filter (where method in ('suggestion_confirmed', 'manual')) as manual from payment_allocations "
                                "where voided_at is null and (created_at at time zone :tz)::date > :s and (created_at at time zone :tz)::date <= :e"), {"tz": tz, "s": start, "e": d}).one()
            v = db.execute(text("select count(*) from recon_suggestions where (created_at at time zone :tz)::date > :s and (created_at at time zone :tz)::date <= :e"), {"tz": tz, "s": start, "e": d}).scalar_one()
            rows.append({"label": label(rng, d), "auto": int(r.auto), "manual": int(r.manual), "review": int(v)})
    else:
        cols = [{"key": "type", "label": "Type"}, {"key": "resolved", "label": "Resolved", "right": True}, {"key": "avg_days", "label": "Average days to resolve", "right": True}]
        rows = [{"type": r.type.replace("_", " "), "resolved": int(r.n), "avg_days": round(float(r.avg), 1)} for r in db.execute(text(
            "select type, count(*) as n, avg(extract(epoch from (resolved_at - created_at)) / 86400) as avg from investigations where status = 'resolved' and (resolved_at at time zone :tz)::date >= :s "
            "group by type order by n desc"), {"tz": tz, "s": today - timedelta(days=days)}).all()]
    return _out(slug, title, definition, rng, cur, cols, rows, {})


def _out(slug: str, title: str, definition: str, rng: str, cur: str, cols: list[dict[str, Any]], rows: list[dict[str, Any]], extra: dict[str, Any]) -> dict[str, Any]:
    return {"slug": slug, "title": title, "definition": definition, "range": rng, "currency": cur, "columns": cols, "rows": rows, **extra}


def to_csv(rep: dict[str, Any]) -> str:
    out = io.StringIO()
    w = csv.writer(out)
    w.writerow([c["label"] for c in rep["columns"]])
    for r in rep["rows"]:
        w.writerow([_cell(r.get(c["key"])) for c in rep["columns"]])
    return out.getvalue()


def _cell(v: Any) -> str:
    text_v = "" if v is None else f"{v:.2f}" if isinstance(v, Decimal) else str(v)
    return "'" + text_v if text_v[:1] in ("=", "+", "-", "@") and not text_v[1:2].isdigit() else text_v  # spreadsheet formula injection
