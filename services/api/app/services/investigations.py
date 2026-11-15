"""Investigations (MOD-11): a case file per discrepancy. Facts and calculations come from stored records through investigation_rules;
nothing here writes to the ledger except by asking the approvals service, which has its own checks."""

import json
import uuid
from decimal import Decimal
from typing import Annotated, Any, Literal

from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import clock
from app.core.errors import ApiError
from app.core.money import Money
from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser
from app.services import approvals, audit
from app.services import investigation_rules as rules

STATUSES = ("new", "in_progress", "ready_for_review", "awaiting_approval", "monitoring", "resolved", "dismissed")
CLOSED = ("resolved", "dismissed")
FILTERS = {
    "all": "true", "mine": "i.assignee_id = :u", "ready": "i.status = 'ready_for_review'", "awaiting": "i.status = 'awaiting_approval'", "monitoring": "i.status = 'monitoring'",
    "open": "i.status not in ('resolved', 'dismissed')",
}


class OpenIn(BaseModel):
    invoice_id: uuid.UUID | None = None
    payment_id: uuid.UUID | None = None
    title: str | None = Field(default=None, max_length=200)


class PatchIn(BaseModel):
    status: Literal["new", "in_progress", "ready_for_review", "awaiting_approval", "monitoring"] | None = None
    priority: Literal["critical", "high", "medium", "low"] | None = None
    assignee_id: uuid.UUID | None = None
    clear_assignee: bool = False


class NoteIn(BaseModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)]


class EvidenceIn(BaseModel):
    type: Literal["document", "email", "manual"]
    label: str = Field(min_length=1, max_length=300)
    ref_id: uuid.UUID | None = None
    tier: Literal["bank", "accounting", "manual", "claim"] = "manual"


class ActionIn(BaseModel):
    action: str
    amount: Money | None = None
    reason: str | None = Field(default=None, max_length=2000)


class ResolveIn(BaseModel):
    outcome: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


class DismissIn(BaseModel):
    reason: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]


def _event(db: Session, org: uuid.UUID, iid: uuid.UUID, kind: str, body: str, actor: uuid.UUID | None) -> None:
    db.execute(text("insert into investigation_events (organization_id, investigation_id, kind, text, actor_id, created_at) values (:o, :i, :k, :t, :a, clock_timestamp())"), {"o": org, "i": iid, "k": kind, "t": body, "a": actor})
    db.execute(text("update investigations set updated_at = now() where id = :i"), {"i": iid})


def _case(db: Session, iid: uuid.UUID, lock: bool = False) -> Any:
    sql = "select * from investigations where id = :i"
    r = db.execute(text(sql + " for update" if lock else sql), {"i": iid}).first()
    if r is None:
        raise ApiError(404, "not_found", "Investigation not found.")
    return r


def _open_case(db: Session, iid: uuid.UUID) -> Any:
    r = _case(db, iid, lock=True)
    if r.status in CLOSED:
        raise ApiError(409, "invalid_state", "This investigation is closed and read-only.")
    return r


# ------------------------------------------------------------------------------------------------ facts and analysis
def _payment_facts(r: Any) -> rules.PaymentFacts:
    return rules.PaymentFacts(str(r.id), r.number, r.amount, r.allocated_amount, r.payment_date, r.reference or "")


def _facts(db: Session, c: Any) -> rules.Facts:
    inv = pay = other = None
    if c.invoice_id:
        i = db.execute(text("select id, invoice_number, total_amount, amount_paid, amount_adjusted, balance_due, due_date from invoices where id = :i"), {"i": c.invoice_id}).one()
        inv = rules.InvoiceFacts(str(i.id), i.invoice_number, i.total_amount, i.amount_paid, i.amount_adjusted, i.balance_due, i.due_date)
    if c.payment_id:
        p = db.execute(text("select id, number, amount, allocated_amount, payment_date, reference from payments where id = :p"), {"p": c.payment_id}).one()
        pay = _payment_facts(p)
        if c.type == "duplicate_payment":
            o = db.execute(text("select id, number, amount, allocated_amount, payment_date, reference from payments where id <> :p and amount = :a and reversed_at is null "
                                "and lower(coalesce(reference, '')) = lower(coalesce(:r, '')) order by payment_date, number limit 1"), {"p": c.payment_id, "a": p.amount, "r": p.reference}).first()
            other = _payment_facts(o) if o else None
    ev = [rules.Evidence(e.type, str(e.ref_id or e.id), e.label) for e in db.execute(
        text("select id, type, ref_id, label from investigation_evidence where investigation_id = :i and removed_at is null"), {"i": c.id}).all()]
    return rules.Facts(c.type, c.currency.strip(), inv, pay, other, ev, c.exposure)


def _snapshot(f: rules.Facts) -> dict[str, Any]:
    return {"invoice_balance": str(f.invoice.balance) if f.invoice else None, "payment_allocated": str(f.payment.allocated) if f.payment else None,
            "evidence": sorted(e.ref for e in f.evidence if e.type in ("document", "email", "manual"))}


def run_analysis(db: Session, org: uuid.UUID, actor: AuthUser | None, iid: uuid.UUID, info: RequestInfo | None = None) -> dict[str, Any]:
    c = _case(db, iid, lock=True)
    f = _facts(db, c)
    snap = _snapshot(f)
    prev = db.execute(text("select status, snapshot from investigation_analyses where investigation_id = :i order by version desc limit 1"), {"i": iid}).first()
    if prev and prev.status == "insufficient_evidence" and prev.snapshot == snap:
        raise ApiError(409, "insufficient_evidence", "Still not enough evidence. Link a document or message, then run the analysis again.")
    a = rules.analyze(f)
    version = c.analysis_version + 1
    rec = {"action": a.recommendation.action, "amount": str(a.recommendation.amount) if a.recommendation.amount is not None else None, "why": a.recommendation.why,
           "label": rules.ACTIONS[a.recommendation.action]["label"], "gate": rules.ACTIONS[a.recommendation.action]["gate"]} if a.recommendation else None
    db.execute(text("insert into investigation_analyses (organization_id, investigation_id, version, status, summary, findings, recommendation, snapshot, created_by) "
                    "values (:o, :i, :v, :s, :sum, cast(:f as jsonb), cast(:r as jsonb), cast(:sn as jsonb), :u)"),
               {"o": org, "i": iid, "v": version, "s": a.status, "sum": a.summary, "f": json.dumps([{"kind": x.kind, "text": x.text, "cites": x.cites} for x in a.findings]),
                "r": json.dumps(rec) if rec else None, "sn": json.dumps(snap), "u": actor.id if actor else None})
    status = c.status
    if a.status == "completed" and a.recommendation and status in ("new", "in_progress"):
        status = "ready_for_review"
    db.execute(text("update investigations set analysis_version = :v, analysis_status = :s, analyzed_at = now(), status = :st, version = version + 1 where id = :i"),
               {"v": version, "s": a.status, "st": status, "i": iid})
    _event(db, org, iid, "analysis", f"Analysis v{version}: {a.summary}" + (" Not enough evidence to recommend an action." if a.status == "insufficient_evidence" else ""), actor.id if actor else None)
    audit.record(db, org, "investigation.analysed", actor_id=actor.id if actor else None, record_type="investigation", record_id=iid, after={"version": version, "status": a.status}, info=info)
    return {"version": version, "status": a.status}


# ------------------------------------------------------------------------------------------------------------ open
def _title(kind: str, inv: str | None, pay: str | None) -> str:
    label = {"short_payment": "Short payment", "overpayment": "Overpayment", "duplicate_payment": "Possible duplicate payment", "currency_mismatch": "Currency mismatch", "manual": "Investigation"}[kind]
    return f"{label} on {inv}" if inv else f"{label} {pay}" if pay else label


def open_case(db: Session, org: uuid.UUID, actor: AuthUser | None, kind: str, invoice_id: uuid.UUID | None, payment_id: uuid.UUID | None, exposure: Decimal, title: str | None,
              discrepancy_id: uuid.UUID | None, info: RequestInfo | None) -> uuid.UUID:
    inv = db.execute(text("select i.id, i.invoice_number, i.customer_id, i.currency, i.due_date from invoices i where i.id = :i"), {"i": invoice_id}).first() if invoice_id else None
    pay = db.execute(text("select id, number, customer_id, currency, payment_date, verification_level from payments where id = :p"), {"p": payment_id}).first() if payment_id else None
    if (invoice_id and inv is None) or (payment_id and pay is None):
        raise ApiError(404, "not_found", "Record not found.")
    if inv is None and pay is None:
        raise ApiError(422, "validation_error", "Choose an invoice or a payment.")
    cur = (inv.currency if inv else pay.currency).strip()  # type: ignore[union-attr]
    cust = inv.customer_id if inv else pay.customer_id  # type: ignore[union-attr]
    today = clock.now().date()
    age = max(0, (today - (inv.due_date if inv else pay.payment_date)).days)  # type: ignore[union-attr]
    iid = db.execute(text("insert into investigations (organization_id, number, type, title, priority, exposure, currency, customer_id, invoice_id, payment_id, discrepancy_id, created_by) "
                          "values (:o, next_number(:o, 'investigation', 'INVG'), :t, :ti, :pr, :e, :c, :cu, :i, :p, :d, :u) returning id"),
                     {"o": org, "t": kind, "ti": (title or "").strip() or _title(kind, inv.invoice_number if inv else None, pay.number if pay else None), "pr": rules.priority(exposure, age), "e": exposure, "c": cur,
                      "cu": cust, "i": invoice_id, "p": payment_id, "d": discrepancy_id, "u": actor.id if actor else None}).scalar_one()
    if inv:
        db.execute(text("insert into investigation_evidence (organization_id, investigation_id, type, ref_id, label, tier, added_by) values (:o, :i, 'invoice', :r, :l, 'accounting', :u)"),
                   {"o": org, "i": iid, "r": inv.id, "l": f"Invoice {inv.invoice_number}", "u": actor.id if actor else None})
    if pay:
        db.execute(text("insert into investigation_evidence (organization_id, investigation_id, type, ref_id, label, tier, added_by) values (:o, :i, 'payment', :r, :l, :t, :u)"),
                   {"o": org, "i": iid, "r": pay.id, "l": f"Payment {pay.number}", "t": "bank" if pay.verification_level == "source_verified" else "manual", "u": actor.id if actor else None})
    _event(db, org, iid, "opened", "Investigation opened" + (" from a discrepancy." if discrepancy_id else " by hand."), actor.id if actor else None)
    audit.record(db, org, "investigation.opened", actor_id=actor.id if actor else None, record_type="investigation", record_id=iid, after={"type": kind, "exposure": str(exposure)}, info=info)
    run_analysis(db, org, actor, iid, info)
    return iid  # type: ignore[no-any-return]


def open_from_discrepancy(db: Session, org: uuid.UUID, actor: AuthUser | None, did: uuid.UUID, kind: str, payment_id: uuid.UUID | None, invoice_id: uuid.UUID | None, exposure: Decimal,
                          info: RequestInfo | None) -> uuid.UUID | None:
    if db.execute(text("select 1 from investigations where discrepancy_id = :d"), {"d": did}).first():
        return None
    return open_case(db, org, actor, kind, invoice_id, payment_id, exposure, None, did, info)


def open_manual(db: Session, org: uuid.UUID, actor: AuthUser, body: OpenIn, info: RequestInfo) -> dict[str, Any]:
    exposure = Decimal(0)
    if body.invoice_id:
        exposure = db.execute(text("select balance_due from invoices where id = :i"), {"i": body.invoice_id}).scalar() or Decimal(0)
    iid = open_case(db, org, actor, "manual", body.invoice_id, body.payment_id, exposure, body.title, None, info)
    return get(db, iid)


# ---------------------------------------------------------------------------------------------------------- read
LIST_SQL = ("select i.id, i.number, i.type, i.title, i.status, i.priority, i.exposure, i.currency, i.analysis_status, i.analysis_version, i.created_at, i.updated_at, i.assignee_id, "
            "c.name as customer, inv.invoice_number, p.full_name as assignee, ar.status as approval_status from investigations i left join customers c on c.id = i.customer_id "
            "left join invoices inv on inv.id = i.invoice_id left join profiles p on p.id = i.assignee_id left join approval_requests ar on ar.id = i.approval_id")


def _card(r: Any) -> dict[str, Any]:
    return {"id": str(r.id), "number": r.number, "type": r.type, "title": r.title, "status": r.status, "priority": r.priority, "exposure": r.exposure, "currency": r.currency.strip(),
            "analysis_status": r.analysis_status, "analysis_version": r.analysis_version, "customer": r.customer, "invoice_number": r.invoice_number, "assignee": r.assignee,
            "assignee_id": str(r.assignee_id) if r.assignee_id else None, "approval_status": r.approval_status, "created_at": r.created_at, "updated_at": r.updated_at}


def list_cases(db: Session, user: uuid.UUID, flt: str, q: str | None) -> list[dict[str, Any]]:
    if flt not in FILTERS:
        raise ApiError(400, "bad_request", "Unknown filter.")
    where = f"{FILTERS[flt]} and (cast(:q as text) is null or i.number ilike '%' || :q || '%' or i.title ilike '%' || :q || '%' or coalesce(c.name, '') ilike '%' || :q || '%')"
    rows = db.execute(text(f"{LIST_SQL} where {where} order by case i.priority when 'critical' then 0 when 'high' then 1 when 'medium' then 2 else 3 end, i.created_at desc, i.id limit 300"),  # noqa: S608
                      {"u": user, "q": q or None}).all()
    return [_card(r) for r in rows]


def get(db: Session, iid: uuid.UUID) -> dict[str, Any]:
    r = db.execute(text(f"{LIST_SQL} where i.id = :i"), {"i": iid}).first()  # noqa: S608
    if r is None:
        raise ApiError(404, "not_found", "Investigation not found.")
    c = _case(db, iid)
    out = _card(r)
    out.update({"invoice_id": str(c.invoice_id) if c.invoice_id else None, "payment_id": str(c.payment_id) if c.payment_id else None, "approval_id": str(c.approval_id) if c.approval_id else None,
                "resolution": c.resolution, "dismiss_reason": c.dismiss_reason, "priority_overridden": c.priority_overridden, "version": c.version})
    versions = db.execute(text("select version, status, summary, findings, recommendation, snapshot, created_at from investigation_analyses where investigation_id = :i order by version desc"), {"i": iid}).all()
    latest = versions[0] if versions else None
    stale = False
    if latest:
        stale = _snapshot(_facts(db, c)) != latest.snapshot
    out["analysis"] = {"version": latest.version, "status": latest.status, "summary": latest.summary, "findings": latest.findings, "recommendation": latest.recommendation, "at": latest.created_at, "stale": stale} if latest else None
    out["versions"] = [{"version": v.version, "status": v.status, "summary": v.summary, "at": v.created_at} for v in versions]
    out["events"] = [{"kind": e.kind, "text": e.text, "at": e.created_at, "by": e.who} for e in db.execute(text(
        "select e.kind, e.text, e.created_at, p.full_name as who from investigation_events e left join profiles p on p.id = e.actor_id where e.investigation_id = :i order by e.created_at, e.id"), {"i": iid}).all()]
    out["evidence"] = [{"id": str(e.id), "type": e.type, "ref_id": str(e.ref_id) if e.ref_id else None, "label": e.label, "tier": e.tier, "at": e.created_at} for e in db.execute(text(
        "select id, type, ref_id, label, tier, created_at from investigation_evidence where investigation_id = :i and removed_at is null order by created_at, id"), {"i": iid}).all()]
    out["actions"] = [{"action": k, "label": v["label"], "gate": v["gate"]} for k, v in rules.ACTIONS.items()]
    return out


# ------------------------------------------------------------------------------------------------------- changes
def patch(db: Session, org: uuid.UUID, actor: AuthUser, iid: uuid.UUID, body: PatchIn, version: int | None, info: RequestInfo) -> dict[str, Any]:
    c = _open_case(db, iid)
    if version is not None and version != c.version:
        raise ApiError(409, "version_conflict", "Someone else changed this investigation. Reload to see the latest version.")
    sets: list[str] = []
    args: dict[str, Any] = {"i": iid}
    if body.status and body.status != c.status:
        sets.append("status = :st")
        args["st"] = body.status
        _event(db, org, iid, "status", f"Moved to {body.status.replace('_', ' ')}.", actor.id)
    if body.priority and body.priority != c.priority:
        sets.append("priority = :pr, priority_overridden = true")
        args["pr"] = body.priority
        _event(db, org, iid, "priority", f"Priority set to {body.priority}.", actor.id)
    if body.assignee_id or body.clear_assignee:
        if body.assignee_id and not db.execute(text("select 1 from memberships where user_id = :u and organization_id = :o and status = 'active'"), {"u": body.assignee_id, "o": org}).first():
            raise ApiError(422, "validation_error", "Choose an active member of this organization.")
        sets.append("assignee_id = :a")
        args["a"] = None if body.clear_assignee else body.assignee_id
        name = db.execute(text("select full_name from profiles where id = :u"), {"u": body.assignee_id}).scalar() if body.assignee_id else None
        _event(db, org, iid, "assign", f"Assigned to {name}." if name else "Unassigned.", actor.id)
        if body.assignee_id:
            from app.services import notifications

            notifications.notify(db, org, [body.assignee_id], "assignment", f"{c.number} was assigned to you", c.title, f"/app/investigations/{iid}", f"assign-{iid}-{body.assignee_id}-{c.version}", skip=actor.id)
    if sets:
        db.execute(text(f"update investigations set {', '.join(sets)}, version = version + 1, updated_at = now() where id = :i"), args)  # noqa: S608
        audit.record(db, org, "investigation.updated", actor_id=actor.id, record_type="investigation", record_id=iid, after={k: str(v) for k, v in args.items() if k != "i"}, info=info)
    return get(db, iid)


def add_note(db: Session, org: uuid.UUID, actor: AuthUser, iid: uuid.UUID, body: str, info: RequestInfo) -> dict[str, Any]:
    _case(db, iid)
    _event(db, org, iid, "note", body.strip(), actor.id)
    audit.record(db, org, "investigation.note_added", actor_id=actor.id, record_type="investigation", record_id=iid, info=info)
    return get(db, iid)


def add_evidence(db: Session, org: uuid.UUID, actor: AuthUser, iid: uuid.UUID, body: EvidenceIn, info: RequestInfo) -> dict[str, Any]:
    _open_case(db, iid)
    if body.type == "document" and body.ref_id and not db.execute(text("select 1 from documents where id = :d and deleted_at is null"), {"d": body.ref_id}).first():
        raise ApiError(422, "validation_error", "Choose an uploaded document.")
    db.execute(text("insert into investigation_evidence (organization_id, investigation_id, type, ref_id, label, tier, added_by) values (:o, :i, :t, :r, :l, :ti, :u)"),
               {"o": org, "i": iid, "t": body.type, "r": body.ref_id, "l": body.label.strip(), "ti": body.tier, "u": actor.id})
    _event(db, org, iid, "evidence", f"Added evidence: {body.label.strip()}.", actor.id)
    audit.record(db, org, "investigation.evidence_added", actor_id=actor.id, record_type="investigation", record_id=iid, after={"label": body.label.strip(), "type": body.type}, info=info)
    return get(db, iid)


def link_document(db: Session, org: uuid.UUID, actor: AuthUser, iid: uuid.UUID, did: uuid.UUID, filename: str, info: RequestInfo) -> bool:
    """Links an uploaded document as evidence. Linking the same document twice does nothing."""
    _open_case(db, iid)
    if db.execute(text("select 1 from investigation_evidence where investigation_id = :i and ref_id = :d and removed_at is null"), {"i": iid, "d": did}).first():
        return False
    db.execute(text("insert into investigation_evidence (organization_id, investigation_id, type, ref_id, label, tier, added_by) values (:o, :i, 'document', :d, :l, 'manual', :u)"),
               {"o": org, "i": iid, "d": did, "l": filename, "u": actor.id})
    _event(db, org, iid, "evidence", f"Added evidence: {filename}.", actor.id)
    audit.record(db, org, "investigation.evidence_added", actor_id=actor.id, record_type="investigation", record_id=iid, after={"label": filename, "type": "document"}, info=info)
    return True


def remove_evidence(db: Session, org: uuid.UUID, actor: AuthUser, iid: uuid.UUID, eid: uuid.UUID, info: RequestInfo) -> dict[str, Any]:
    _open_case(db, iid)
    r = db.execute(text("update investigation_evidence set removed_at = now() where id = :e and investigation_id = :i and removed_at is null and type in ('document', 'email', 'manual') returning label"),
                   {"e": eid, "i": iid}).first()
    if r is None:
        raise ApiError(404, "not_found", "Evidence not found. The invoice and payment that opened the case cannot be removed.")
    _event(db, org, iid, "evidence", f"Removed evidence: {r.label}.", actor.id)
    audit.record(db, org, "investigation.evidence_removed", actor_id=actor.id, record_type="investigation", record_id=iid, after={"label": r.label}, info=info)
    return get(db, iid)


def resolve(db: Session, org: uuid.UUID, actor: AuthUser, iid: uuid.UUID, outcome: str, info: RequestInfo) -> dict[str, Any]:
    c = _open_case(db, iid)
    text_out = outcome.strip()
    if c.invoice_id:
        inv = db.execute(text("select invoice_number, balance_due, currency from invoices where id = :i"), {"i": c.invoice_id}).one()
        text_out += f" Verified from records: {inv.invoice_number} balance is {inv.balance_due:.2f} {inv.currency.strip()}."
    db.execute(text("update investigations set status = 'resolved', resolution = :r, resolved_at = now(), version = version + 1, updated_at = now() where id = :i"), {"r": text_out, "i": iid})
    _event(db, org, iid, "resolved", text_out, actor.id)
    audit.record(db, org, "investigation.resolved", actor_id=actor.id, record_type="investigation", record_id=iid, after={"outcome": text_out}, info=info)
    return get(db, iid)


def dismiss(db: Session, org: uuid.UUID, actor: AuthUser, iid: uuid.UUID, reason: str, info: RequestInfo) -> dict[str, Any]:
    c = _open_case(db, iid)
    if not reason.strip():
        raise ApiError(422, "validation_error", "Give a reason for dismissing.")
    db.execute(text("update investigations set status = 'dismissed', dismiss_reason = :r, version = version + 1, updated_at = now() where id = :i"), {"r": reason.strip(), "i": iid})
    if c.discrepancy_id:
        db.execute(text("update discrepancies set status = 'resolved', resolved_by = :u, resolved_at = now(), resolution_note = :n where id = :d and status = 'open'"),
                   {"u": actor.id, "n": f"Investigation dismissed: {reason.strip()}", "d": c.discrepancy_id})
    _event(db, org, iid, "dismissed", f"Dismissed: {reason.strip()}", actor.id)
    audit.record(db, org, "investigation.dismissed", actor_id=actor.id, record_type="investigation", record_id=iid, after={"reason": reason.strip()}, info=info)
    return get(db, iid)


def act(db: Session, org: uuid.UUID, actor: AuthUser, iid: uuid.UUID, body: ActionIn, can_request: bool, info: RequestInfo) -> dict[str, Any]:
    c = _open_case(db, iid)
    spec = rules.ACTIONS.get(body.action)
    if spec is None:
        raise ApiError(422, "validation_error", "That action is not in the list of allowed actions.")
    if spec["gate"] == "approval":
        if not can_request:
            raise ApiError(403, "permission_denied", "You cannot request adjustments.")
        if not c.invoice_id:
            raise ApiError(422, "validation_error", "This action needs an invoice linked to the case.")
        latest = db.execute(text("select recommendation from investigation_analyses where investigation_id = :i order by version desc limit 1"), {"i": iid}).scalar()
        amount = body.amount or (Decimal(latest["amount"]) if latest and latest.get("action") == body.action and latest.get("amount") else None)
        if amount is None:
            raise ApiError(422, "validation_error", "Enter the amount.")
        req = approvals.create(db, org, actor, approvals.RequestIn(type=str(spec["approval_type"]), invoice_id=c.invoice_id, amount=amount,
                                                                    reason=(body.reason or f"From investigation {c.number}: {c.title}").strip()), info)
        db.execute(text("update investigations set approval_id = :a, status = :s, version = version + 1, updated_at = now() where id = :i"),
                   {"a": req["id"], "s": "awaiting_approval" if req["status"] == "pending" else "monitoring", "i": iid})
        _event(db, org, iid, "action", f"{spec['label']} for {amount:.2f}: request {req['number']} is {req['status'].replace('_', ' ')}.", actor.id)
    else:
        db.execute(text("update investigations set status = 'monitoring', version = version + 1, updated_at = now() where id = :i"), {"i": iid})
        _event(db, org, iid, "action", "Moved to monitoring.", actor.id)
    audit.record(db, org, "investigation.action", actor_id=actor.id, record_type="investigation", record_id=iid, after={"action": body.action}, info=info)
    return get(db, iid)
