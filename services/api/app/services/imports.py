import json
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser
from app.services import audit, importing
from app.services.importing import Lookups, Result

PERMISSION = {"invoices": "invoices.import", "payments": "payments.import"}
CLASSES = ("valid", "warning", "error", "duplicate")


def _lookups(db: Session, kind: str) -> Lookups:
    cur = db.execute(text("select default_currency from organizations")).scalar_one().strip()
    lk = Lookups(default_currency=cur)
    for r in db.execute(text("select id, lower(name) as n, payer_aliases from customers where status = 'active'")):
        lk.customers[r.n] = str(r.id)
        for a in r.payer_aliases or []:
            lk.customers.setdefault(a.lower(), str(r.id))
    if kind == "invoices":
        lk.invoice_keys = {(r.n, r.i) for r in db.execute(text(
            "select lower(c.name) as n, lower(i.invoice_number) as i from invoices i join customers c on c.id = i.customer_id where i.lifecycle_status <> 'cancelled'"))}
    else:
        for r in db.execute(text("select fingerprint, external_id from payments")):
            if r.fingerprint:
                lk.fingerprints.add(r.fingerprint)
            if r.external_id:
                lk.external_ids.add(r.external_id)
    return lk


def _validate(db: Session, kind: str, rows: list[dict[str, str]], mapping: dict[str, str], fmt: str) -> list[Result]:
    lk = _lookups(db, kind)
    return (importing.validate_invoices if kind == "invoices" else importing.validate_payments)(rows, mapping, fmt, lk)


def _store(db: Session, org: uuid.UUID, job_id: uuid.UUID, rows: list[dict[str, str]], results: list[Result]) -> dict[str, int]:
    db.execute(text("delete from import_rows where job_id = :j"), {"j": job_id})
    counts = dict.fromkeys(CLASSES, 0)
    batch = []
    for i, (raw, res) in enumerate(zip(rows, results, strict=True), start=1):
        counts[res.cls] += 1
        batch.append({"o": org, "j": job_id, "n": i, "raw": json.dumps(raw), "c": res.cls, "m": json.dumps(res.messages), "d": json.dumps(res.data) if res.data else None})
    if batch:
        db.execute(text("insert into import_rows (organization_id, job_id, row_number, raw, class, messages, data) values "
                        "(:o, :j, :n, cast(:raw as jsonb), :c, cast(:m as jsonb), cast(:d as jsonb))"), batch)
    counts["total"] = len(rows)
    return counts


def _date_values(rows: list[dict[str, str]], mapping: dict[str, str], kind: str) -> list[str]:
    cols = [mapping[f] for f in (("issue_date", "due_date") if kind == "invoices" else ("date",)) if f in mapping]
    return [r.get(c, "") for r in rows for c in cols]


def _summary(db: Session, job_id: uuid.UUID) -> dict[str, Any]:
    j = db.execute(text("select id, kind, filename, status, headers, mapping, date_format, counts, created_at, committed_at from import_jobs where id = :j"), {"j": job_id}).first()
    if j is None:
        raise ApiError(404, "not_found", "Import not found.")
    d = dict(j._mapping)
    d["missing"] = importing.missing_required(j.kind, j.mapping)
    d["targets"] = importing.FIELDS[j.kind]
    d["required"] = importing.REQUIRED[j.kind]
    return d


def create(db: Session, org: uuid.UUID, actor: AuthUser, kind: str, filename: str, content: bytes, date_format: str | None, info: RequestInfo) -> dict[str, Any]:
    if kind not in PERMISSION:
        raise ApiError(422, "validation_error", "Choose invoices or payments.")
    try:
        parsed = importing.read_csv(content)
    except importing.CsvProblem as e:
        raise ApiError(422, "validation_error", str(e)) from e
    mapping = importing.detect_mapping(kind, parsed.headers)
    fmt = date_format or importing.detect_date_format(_date_values(parsed.rows, mapping, kind)) or "ambiguous"
    results = _validate(db, kind, parsed.rows, mapping, fmt if fmt != "ambiguous" else "none") if not importing.missing_required(kind, mapping) else [
        Result("error", ["Some required columns are not matched yet. Map them to continue."]) for _ in parsed.rows]
    job = db.execute(text("insert into import_jobs (organization_id, kind, filename, headers, mapping, date_format, created_by) values "
                          "(:o, :k, :f, cast(:h as jsonb), cast(:m as jsonb), :d, :u) returning id"),
                     {"o": org, "k": kind, "f": filename[:200], "h": json.dumps(parsed.headers), "m": json.dumps(mapping), "d": "iso" if fmt == "ambiguous" else fmt, "u": actor.id}).scalar_one()
    counts = _store(db, org, job, parsed.rows, results)
    counts["ambiguous_dates"] = int(fmt == "ambiguous")
    db.execute(text("update import_jobs set counts = cast(:c as jsonb) where id = :j"), {"c": json.dumps(counts), "j": job})
    audit.record(db, org, "import.validated", actor_id=actor.id, record_type="import", record_id=job, after={"kind": kind, "filename": filename, **counts}, info=info)
    return _summary(db, job)


def revalidate(db: Session, org: uuid.UUID, actor: AuthUser, job_id: uuid.UUID, mapping: dict[str, str] | None, date_format: str | None, info: RequestInfo) -> dict[str, Any]:
    j = db.execute(text("select kind, status, headers, mapping, date_format from import_jobs where id = :j for update"), {"j": job_id}).first()
    if j is None:
        raise ApiError(404, "not_found", "Import not found.")
    if j.status != "validated":
        raise ApiError(409, "invalid_state", "This import is already finished.")
    new_map = {k: v for k, v in (mapping if mapping is not None else j.mapping).items() if v in j.headers and k in importing.FIELDS[j.kind]}
    fmt = date_format or j.date_format
    rows = [dict(r.raw) for r in db.execute(text("select raw from import_rows where job_id = :j order by row_number"), {"j": job_id})]
    if importing.missing_required(j.kind, new_map):
        results = [Result("error", ["Some required columns are not matched yet. Map them to continue."]) for _ in rows]
    else:
        results = _validate(db, j.kind, rows, new_map, fmt)
    counts = _store(db, org, job_id, rows, results)
    counts["ambiguous_dates"] = 0
    db.execute(text("update import_jobs set mapping = cast(:m as jsonb), date_format = :d, counts = cast(:c as jsonb) where id = :j"),
               {"m": json.dumps(new_map), "d": fmt, "c": json.dumps(counts), "j": job_id})
    audit.record(db, org, "import.revalidated", actor_id=actor.id, record_type="import", record_id=job_id, after={"mapping": new_map, "date_format": fmt, **counts}, info=info)
    return _summary(db, job_id)


def get(db: Session, job_id: uuid.UUID) -> dict[str, Any]:
    return _summary(db, job_id)


def list_rows(db: Session, job_id: uuid.UUID, cls: str | None, page: int, limit: int) -> dict[str, Any]:
    _summary(db, job_id)
    if cls is not None and cls not in CLASSES:
        raise ApiError(400, "bad_request", "Unknown row class.")
    total = db.execute(text("select count(*) from import_rows where job_id = :j and (cast(:c as text) is null or class = :c)"), {"j": job_id, "c": cls}).scalar_one()
    rows = db.execute(text("select row_number, class, messages, raw from import_rows where job_id = :j and (cast(:c as text) is null or class = :c) order by row_number limit :n offset :o"),
                      {"j": job_id, "c": cls, "n": limit, "o": (page - 1) * limit}).all()
    return {"data": [dict(r._mapping) for r in rows], "total": int(total), "page": page, "limit": limit}


def problems(db: Session, job_id: uuid.UUID) -> str:
    headers = _summary(db, job_id)["headers"]
    rows = db.execute(text("select row_number, class, messages, raw from import_rows where job_id = :j and class in ('error', 'duplicate') order by row_number"), {"j": job_id}).all()
    return importing.problems_csv([dict(r._mapping) for r in rows], headers)


def commit(db: Session, org: uuid.UUID, actor: AuthUser, job_id: uuid.UUID, info: RequestInfo) -> dict[str, Any]:
    j = db.execute(text("select kind, status, counts from import_jobs where id = :j for update"), {"j": job_id}).first()
    if j is None:
        raise ApiError(404, "not_found", "Import not found.")
    if j.status != "validated":
        raise ApiError(409, "invalid_state", "This import has already been saved or discarded.")
    if j.counts.get("ambiguous_dates"):
        raise ApiError(409, "invalid_state", "Confirm the date format before saving.")
    rows = db.execute(text("select data from import_rows where job_id = :j and class in ('valid', 'warning') order by row_number"), {"j": job_id}).all()
    data = [r.data for r in rows]
    if not data:
        raise ApiError(409, "invalid_state", "There are no valid rows to save. Fix the problems or upload another file.")
    try:
        with db.begin_nested():
            created = _save_invoices(db, org, job_id, data) if j.kind == "invoices" else _save_payments(db, org, job_id, data)
    except IntegrityError as e:  # someone created the same record since validation
        raise ApiError(409, "duplicate", "Some rows were added by someone else while you were reviewing. Upload the file again.") from e
    result = {"created": len(data), "skipped_duplicates": j.counts.get("duplicate", 0), "errors": j.counts.get("error", 0), **created}
    db.execute(text("update import_jobs set status = 'committed', committed_at = now() where id = :j"), {"j": job_id})
    audit.record(db, org, "import.committed", actor_id=actor.id, record_type="import", record_id=job_id, after={"kind": j.kind, **result}, info=info)
    return result


def _save_invoices(db: Session, org: uuid.UUID, job_id: uuid.UUID, data: list[dict[str, Any]]) -> dict[str, int]:
    customers = {r.n: r.id for r in db.execute(text("select lower(name) as n, id from customers where status = 'active'"))}
    for r in db.execute(text("select lower(a) as n, id from customers c, unnest(c.payer_aliases) a where c.status = 'active'")):
        customers.setdefault(r.n, r.id)
    created = 0
    for name in sorted({d["customer"] for d in data if d["customer"].lower() not in customers}, key=str.lower):
        customers[name.lower()] = db.execute(text("insert into customers (organization_id, name, source) values (:o, :n, 'csv') returning id"), {"o": org, "n": name}).scalar_one()
        created += 1
    inv, lines = [], []
    for d in data:
        iid = uuid.uuid4()
        inv.append({"id": iid, "o": org, "c": customers[d["customer"].lower()], "n": d["invoice_number"], "po": d["po_number"], "i": d["issue_date"], "d": d["due_date"],
                    "cur": d["currency"], "t": d["total_amount"], "desc": d["description"], "ext": d["external_id"], "j": job_id})
        lines.append({"o": org, "i": iid, "t": d["total_amount"]})
    if inv:
        db.execute(text("insert into invoices (id, organization_id, customer_id, invoice_number, po_number, issue_date, due_date, currency, total_amount, balance_due, description, "
                        "source, external_id, import_batch_id) values (:id, :o, :c, :n, :po, :i, :d, :cur, :t, :t, :desc, 'csv', :ext, :j)"), inv)
        db.execute(text("insert into invoice_line_items (organization_id, invoice_id, position, description, quantity, unit_price, amount) values (:o, :i, 1, 'Imported invoice', 1, :t, :t)"), lines)
    return {"customers_created": created}


def _save_payments(db: Session, org: uuid.UUID, job_id: uuid.UUID, data: list[dict[str, Any]]) -> dict[str, int]:
    if not data:
        return {}
    numbers = [r[0] for r in db.execute(text("select next_number(:o, 'payment', 'PAY') from generate_series(1, :n)"), {"o": org, "n": len(data)})]
    db.execute(text("insert into payments (organization_id, number, customer_id, payment_date, amount, currency, method, reference, memo, payer_name_raw, "
                    "verification_level, source, external_id, import_batch_id, fingerprint) values (:o, :num, :c, :d, :a, :cur, :m, :ref, :memo, :payer, "
                    "'source_verified', 'csv', :ext, :j, :fp)"),
               [{"o": org, "num": n, "c": d["customer_id"], "d": d["payment_date"], "a": d["amount"], "cur": d["currency"], "m": d["method"], "ref": d["reference"],
                 "memo": d["memo"], "payer": d["payer_name_raw"], "ext": d["external_id"], "j": job_id, "fp": d["fingerprint"]} for n, d in zip(numbers, data, strict=True)])
    return {}


def discard(db: Session, org: uuid.UUID, actor: AuthUser, job_id: uuid.UUID, info: RequestInfo) -> None:
    n = db.execute(text("update import_jobs set status = 'discarded' where id = :j and status = 'validated' returning id"), {"j": job_id}).first()
    if n is None:
        raise ApiError(409, "invalid_state", "This import is already finished or does not exist.")
    audit.record(db, org, "import.discarded", actor_id=actor.id, record_type="import", record_id=job_id, info=info)
