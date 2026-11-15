"""Reconciliation: runs the deterministic rules over open payments and invoices, stores suggestions and discrepancies, applies exact
matches when the organization allows it, and lets a person accept, reject or resolve the rest. Every change is audited."""

import json
import uuid
from datetime import date
from decimal import Decimal
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser
from app.services import audit, payments
from app.services import recon_rules as rr
from app.services.settings import FINANCIAL_DEFAULTS

PRIOR_DAYS = 60


def _settings(db: Session) -> rr.Settings:
    fin = {**FINANCIAL_DEFAULTS, **(db.execute(text("select settings from organizations")).scalar_one() or {}).get("financial", {})}
    return rr.Settings(bool(fin["auto_apply_exact"]), int(fin["short_grace_days"]))


def _key(allocs: list[tuple[str, Decimal]]) -> str:
    return json.dumps(sorted((i, str(a)) for i, a in allocs))


def run(db: Session, org: uuid.UUID, actor: AuthUser, today: date, info: RequestInfo) -> dict[str, Any]:
    cfg = _settings(db)
    invs = [rr.Inv(str(r.id), r.invoice_number, str(r.customer_id), r.balance_due, r.currency.strip(), r.due_date)
            for r in db.execute(text("select id, invoice_number, customer_id, balance_due, currency, due_date from invoices where lifecycle_status = 'issued' and balance_due > 0")).all()]
    paid = {r.invoice_number for r in db.execute(text("select invoice_number from invoices where lifecycle_status = 'issued' and balance_due = 0 and total_amount > 0")).all()}
    names: dict[str, str] = {}
    for r in db.execute(text("select id, name, payer_aliases from customers where status = 'active'")).all():
        for n in [r.name, *(r.payer_aliases or [])]:
            names.setdefault(n.strip().lower(), str(r.id))
    pays = db.execute(text("select id, amount, allocated_amount, currency, payment_date, coalesce(reference, '') ref, coalesce(memo, '') memo, coalesce(payer_name_raw, '') payer, "
                           "customer_id, number, under_review from payments where reversed_at is null and direction = 'in' and allocated_amount < amount order by payment_date, number")).all()
    priors = [rr.PriorPayment(str(r.id), str(r.customer_id) if r.customer_id else None, r.payer, r.amount, r.currency.strip(), r.ref, r.payment_date)
              for r in db.execute(text(f"select id, customer_id, coalesce(payer_name_raw, '') payer, amount, currency, coalesce(reference, '') ref, payment_date from payments "  # noqa: S608
                                       f"where reversed_at is null and payment_date >= :d - {PRIOR_DAYS}"), {"d": today}).all()]
    rejected: dict[str, set[str]] = {}
    for r in db.execute(text("select payment_id, allocations from recon_suggestions where status = 'rejected'")).all():
        rejected.setdefault(str(r.payment_id), set()).add(_key([(a["invoice_id"], Decimal(a["amount"])) for a in r.allocations]))
    run_id = db.execute(text("insert into recon_runs (organization_id, started_by) values (:o, :u) returning id"), {"o": org, "u": actor.id}).scalar_one()
    db.execute(text("update recon_suggestions set status = 'stale' where status = 'pending'"))
    counts = {"payments": len(pays), "suggested": 0, "auto_applied": 0, "discrepancies": 0, "unmatched": 0}
    for p in pays:
        pay = rr.Pay(str(p.id), p.amount, p.allocated_amount, p.currency.strip(), p.payment_date, p.ref, p.memo, p.payer, str(p.customer_id) if p.customer_id else None)
        o = rr.reconcile(pay, invs, paid, priors, names, cfg, today)
        for d in o.discrepancies:
            n = db.execute(text("insert into discrepancies (organization_id, run_id, type, payment_id, invoice_id, exposure, detail) values (:o, :r, :t, :p, :i, :e, :d) "
                                "on conflict do nothing returning id"), {"o": org, "r": run_id, "t": d.type, "p": p.id, "i": d.invoice_id, "e": d.exposure, "d": d.detail}).first()
            counts["discrepancies"] += 1 if n else 0
        if o.under_review and not p.under_review:
            payments.set_review(db, org, actor, p.id, True, info)
        s = o.suggestion
        if s is None:
            counts["unmatched"] += 1
            continue
        if o.auto_apply:
            try:
                with db.begin_nested():
                    for iid, amt in s.allocations:
                        payments.allocate(db, org, actor, p.id, uuid.UUID(iid), amt, "auto_rule", info)
                counts["auto_applied"] += 1
                continue
            except ApiError:
                pass  # fall through: a person will decide
        if _key(s.allocations) in rejected.get(str(p.id), set()):
            continue
        db.execute(text("insert into recon_suggestions (organization_id, run_id, payment_id, rule, confidence, allocations, reason) values (:o, :r, :p, :rule, :c, cast(:a as jsonb), :why)"),
                   {"o": org, "r": run_id, "p": p.id, "rule": s.rule, "c": s.confidence, "a": json.dumps([{"invoice_id": i, "amount": str(a)} for i, a in s.allocations]), "why": s.reason})
        counts["suggested"] += 1
    db.execute(text("update recon_runs set counts = cast(:c as jsonb) where id = :r"), {"c": json.dumps(counts), "r": run_id})
    audit.record(db, org, "reconciliation.run", actor_id=actor.id, record_type="recon_run", record_id=run_id, after=counts, info=info)
    return {"id": str(run_id), **counts}


def list_runs(db: Session) -> list[dict[str, Any]]:
    return [{"id": str(r.id), "started_at": r.started_at, "counts": r.counts, "by": r.by} for r in db.execute(text(
        "select r.id, r.started_at, r.counts, p.full_name as by from recon_runs r left join profiles p on p.id = r.started_by order by r.started_at desc limit 20")).all()]


def list_suggestions(db: Session, status: str, page: int, limit: int) -> tuple[list[dict[str, Any]], int]:
    total = db.execute(text("select count(*) from recon_suggestions where status = :s"), {"s": status}).scalar_one()
    rows = db.execute(text(
        "select s.id, s.rule, s.confidence, s.allocations, s.reason, s.created_at, p.id as payment_id, p.number as payment_number, p.amount, p.allocated_amount, p.currency, p.payment_date, "
        "p.reference, p.payer_name_raw from recon_suggestions s join payments p on p.id = s.payment_id where s.status = :s order by s.created_at desc, s.id limit :n offset :o"),
        {"s": status, "n": limit, "o": (page - 1) * limit}).all()
    ids = {a["invoice_id"] for r in rows for a in r.allocations}
    inv = {str(i.id): i for i in db.execute(text("select i.id, i.invoice_number, i.balance_due, c.name as customer from invoices i join customers c on c.id = i.customer_id where i.id = any(cast(:ids as uuid[]))"),
                                           {"ids": list(ids)}).all()} if ids else {}
    out = [{"id": str(r.id), "rule": r.rule, "confidence": r.confidence, "reason": r.reason, "created_at": r.created_at,
            "payment": {"id": str(r.payment_id), "number": r.payment_number, "amount": r.amount, "unallocated": r.amount - r.allocated_amount, "currency": r.currency.strip(),
                        "date": r.payment_date, "reference": r.reference, "payer": r.payer_name_raw},
            "allocations": [{"invoice_id": a["invoice_id"], "invoice_number": inv[a["invoice_id"]].invoice_number if a["invoice_id"] in inv else "?", "amount": Decimal(a["amount"]),
                             "balance": inv[a["invoice_id"]].balance_due if a["invoice_id"] in inv else None, "customer": inv[a["invoice_id"]].customer if a["invoice_id"] in inv else None}
                            for a in r.allocations]} for r in rows]
    return out, int(total)


def _suggestion(db: Session, sid: uuid.UUID) -> Any:
    s = db.execute(text("select id, payment_id, rule, allocations, status from recon_suggestions where id = :s for update"), {"s": sid}).first()
    if s is None:
        raise ApiError(404, "not_found", "Suggestion not found.")
    if s.status != "pending":
        raise ApiError(409, "invalid_state", f"This suggestion is already {s.status}.")
    return s


def accept(db: Session, org: uuid.UUID, actor: AuthUser, sid: uuid.UUID, info: RequestInfo) -> dict[str, Any]:
    s = _suggestion(db, sid)
    try:
        with db.begin_nested():
            for a in s.allocations:
                payments.allocate(db, org, actor, s.payment_id, uuid.UUID(a["invoice_id"]), Decimal(a["amount"]), "suggestion_confirmed", info)
                db.execute(text("update payment_allocations set reconciliation_match_id = :m where payment_id = :p and invoice_id = :i and voided_at is null"),
                           {"m": sid, "p": s.payment_id, "i": a["invoice_id"]})
    except ApiError as e:  # balances moved since the run: the suggestion no longer describes reality
        db.execute(text("update recon_suggestions set status = 'stale' where id = :s"), {"s": sid})
        audit.record(db, org, "reconciliation.suggestion_stale", actor_id=actor.id, record_type="recon_suggestion", record_id=sid, after={"why": e.detail}, info=info)
        db.commit()
        raise ApiError(409, "stale", "The balances changed since this suggestion was made. Run reconciliation again.") from e
    db.execute(text("update recon_suggestions set status = 'accepted', decided_by = :u, decided_at = now() where id = :s"), {"u": actor.id, "s": sid})
    audit.record(db, org, "reconciliation.accepted", actor_id=actor.id, record_type="recon_suggestion", record_id=sid, after={"rule": s.rule}, info=info)
    return {"id": str(sid), "status": "accepted"}


def reject(db: Session, org: uuid.UUID, actor: AuthUser, sid: uuid.UUID, reason: str, info: RequestInfo) -> dict[str, Any]:
    s = _suggestion(db, sid)
    db.execute(text("update recon_suggestions set status = 'rejected', decided_by = :u, decided_at = now(), decision_note = :n where id = :s"), {"u": actor.id, "n": reason.strip(), "s": sid})
    audit.record(db, org, "reconciliation.rejected", actor_id=actor.id, record_type="recon_suggestion", record_id=sid, after={"rule": s.rule, "reason": reason.strip()}, info=info)
    return {"id": str(sid), "status": "rejected"}


def list_auto_applied(db: Session, page: int, limit: int) -> tuple[list[dict[str, Any]], int]:
    where = "a.method = 'auto_rule' and a.voided_at is null"
    total = db.execute(text(f"select count(*) from payment_allocations a where {where}")).scalar_one()  # noqa: S608
    rows = db.execute(text(f"select a.id, a.amount, a.currency, a.created_at, p.number as payment_number, p.payer_name_raw, i.invoice_number from payment_allocations a "  # noqa: S608
                           f"join payments p on p.id = a.payment_id join invoices i on i.id = a.invoice_id where {where} order by a.created_at desc limit :n offset :o"),
                      {"n": limit, "o": (page - 1) * limit}).all()
    return [{"id": str(r.id), "amount": r.amount, "currency": r.currency.strip(), "created_at": r.created_at, "payment_number": r.payment_number, "payer": r.payer_name_raw,
             "invoice_number": r.invoice_number} for r in rows], int(total)


def list_discrepancies(db: Session, status: str, page: int, limit: int) -> tuple[list[dict[str, Any]], int]:
    total = db.execute(text("select count(*) from discrepancies where status = :s"), {"s": status}).scalar_one()
    rows = db.execute(text("select d.id, d.type, d.exposure, d.detail, d.status, d.created_at, d.resolution_note, p.number as payment_number, p.id as payment_id, i.invoice_number "
                           "from discrepancies d left join payments p on p.id = d.payment_id left join invoices i on i.id = d.invoice_id where d.status = :s "
                           "order by d.exposure desc, d.created_at desc, d.id limit :n offset :o"), {"s": status, "n": limit, "o": (page - 1) * limit}).all()
    return [{"id": str(r.id), "type": r.type, "exposure": r.exposure, "detail": r.detail, "status": r.status, "created_at": r.created_at, "payment_number": r.payment_number,
             "payment_id": str(r.payment_id) if r.payment_id else None, "invoice_number": r.invoice_number, "resolution_note": r.resolution_note} for r in rows], int(total)


def resolve_discrepancy(db: Session, org: uuid.UUID, actor: AuthUser, did: uuid.UUID, note: str, info: RequestInfo) -> dict[str, Any]:
    r = db.execute(text("update discrepancies set status = 'resolved', resolved_by = :u, resolved_at = now(), resolution_note = :n where id = :d and status = 'open' returning type"),
                   {"u": actor.id, "n": note.strip(), "d": did}).first()
    if r is None:
        raise ApiError(404, "not_found", "Open discrepancy not found.")
    audit.record(db, org, "discrepancy.resolved", actor_id=actor.id, record_type="discrepancy", record_id=did, after={"type": r.type, "note": note.strip()}, info=info)
    return {"id": str(did), "status": "resolved"}
