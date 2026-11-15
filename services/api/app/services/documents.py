"""Documents (MOD-16, first part): upload, type check by content, text extraction, private download.

Shortcuts, each documented in the Stage E checkpoint: files live in PostgreSQL (move to object storage when volume needs it), there is no
virus scan and no OCR yet, so scanned images and image-only PDFs are stored without text.
"""

import hashlib
import io
import re
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser
from app.services import audit

MAX_BYTES = 20 * 1024 * 1024
MAX_TEXT = 200_000
TYPES = {"pdf": "application/pdf", "png": "image/png", "jpeg": "image/jpeg", "csv": "text/csv", "txt": "text/plain"}


def sniff(name: str, data: bytes) -> str:
    """The real type, decided from the bytes. The file name and the browser's claim are not trusted."""
    if data.startswith(b"%PDF-"):
        return "pdf"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext in ("csv", "txt") and b"\x00" not in data[:8192]:
        try:
            data[:65536].decode("utf-8-sig")
            return ext
        except UnicodeDecodeError:
            pass
    raise ApiError(415, "unsupported_type", "This file type is not accepted. Upload a PDF, PNG, JPEG, CSV or text file.")


def clean_name(name: str) -> str:
    base = re.split(r"[\\/]", name)[-1]
    base = re.sub(r"[\x00-\x1f\"<>|:*?]", "_", base).strip(". ")
    return base[:200] or "upload"


def extract(kind: str, data: bytes) -> tuple[str, str | None, str | None, int | None]:
    """Returns (status, note, text, pages)."""
    if kind in ("csv", "txt"):
        return "done", None, data.decode("utf-8-sig", errors="replace")[:MAX_TEXT], None
    if kind == "pdf":
        try:
            from pypdf import PdfReader

            reader = PdfReader(io.BytesIO(data))
            if reader.is_encrypted:
                return "failed", "The PDF is password protected.", None, None
            pages = len(reader.pages)
            body = "\n".join((p.extract_text() or "") for p in reader.pages[:200]).strip()
            if not body:
                return "none", "No text found. A scanned PDF needs OCR, which is not available yet.", None, pages
            return "done", None, body[:MAX_TEXT], pages
        except Exception:  # noqa: BLE001  # a damaged file must never fail the upload itself
            return "failed", "The PDF could not be read.", None, None
    return "none", "Images need OCR to read their text, which is not available yet.", None, None


def _meta(r: Any) -> dict[str, Any]:
    return {"id": str(r.id), "filename": r.filename, "content_type": r.content_type, "size_bytes": r.size_bytes, "extraction": r.extraction, "extraction_note": r.extraction_note,
            "page_count": r.page_count, "uploaded_by": r.uploader, "created_at": r.created_at}


COLS = "d.id, d.filename, d.content_type, d.size_bytes, d.extraction, d.extraction_note, d.page_count, d.created_at, p.full_name as uploader"
FROM = "from documents d left join profiles p on p.id = d.uploaded_by where d.deleted_at is null"


def upload(db: Session, org: uuid.UUID, actor: AuthUser, name: str, data: bytes, info: RequestInfo) -> tuple[dict[str, Any], bool]:
    if not data:
        raise ApiError(422, "validation_error", "The file is empty.")
    if len(data) > MAX_BYTES:
        raise ApiError(413, "payload_too_large", "Files can be up to 20 MB.")
    kind = sniff(name, data)
    digest = hashlib.sha256(data).hexdigest()
    same = db.execute(text(f"select {COLS} {FROM} and d.sha256 = :h"), {"h": digest}).first()  # noqa: S608
    if same:
        return _meta(same), False
    status, note, body, pages = extract(kind, data)
    did = db.execute(text("insert into documents (organization_id, filename, content_type, size_bytes, sha256, extraction, extraction_note, text_content, page_count, uploaded_by) "
                          "values (:o, :n, :t, :s, :h, :x, :xn, :tx, :pg, :u) returning id"),
                     {"o": org, "n": clean_name(name), "t": TYPES[kind], "s": len(data), "h": digest, "x": status, "xn": note, "tx": body, "pg": pages, "u": actor.id}).scalar_one()
    db.execute(text("insert into document_blobs (document_id, organization_id, content) values (:d, :o, :c)"), {"d": did, "o": org, "c": data})
    audit.record(db, org, "document.uploaded", actor_id=actor.id, record_type="document", record_id=did, after={"filename": clean_name(name), "type": TYPES[kind], "size": len(data), "extraction": status}, info=info)
    return get(db, did), True


def list_documents(db: Session, q: str | None, page: int, limit: int) -> tuple[list[dict[str, Any]], int]:
    where = "(cast(:q as text) is null or d.filename ilike '%' || :q || '%' or coalesce(d.text_content, '') ilike '%' || :q || '%')"
    total = db.execute(text(f"select count(*) {FROM} and {where}"), {"q": q or None}).scalar_one()  # noqa: S608
    rows = db.execute(text(f"select {COLS} {FROM} and {where} order by d.created_at desc, d.id limit :n offset :o"), {"q": q or None, "n": limit, "o": (page - 1) * limit}).all()  # noqa: S608
    return [_meta(r) for r in rows], int(total)


def get(db: Session, did: uuid.UUID) -> dict[str, Any]:
    r = db.execute(text(f"select {COLS}, d.text_content {FROM} and d.id = :d"), {"d": did}).first()  # noqa: S608
    if r is None:
        raise ApiError(404, "not_found", "Document not found.")
    out = _meta(r)
    out["text_preview"] = (r.text_content or "")[:3000]
    out["linked_cases"] = [{"id": str(c.id), "number": c.number, "title": c.title} for c in db.execute(text(
        "select distinct i.id, i.number, i.title from investigation_evidence e join investigations i on i.id = e.investigation_id where e.ref_id = :d and e.removed_at is null"), {"d": did}).all()]
    return out


def content(db: Session, did: uuid.UUID) -> tuple[str, str, bytes]:
    r = db.execute(text("select d.filename, d.content_type, b.content from documents d join document_blobs b on b.document_id = d.id where d.id = :d and d.deleted_at is null"), {"d": did}).first()
    if r is None:
        raise ApiError(404, "not_found", "Document not found.")
    return r.filename, r.content_type, bytes(r.content)


def delete(db: Session, org: uuid.UUID, actor: AuthUser, did: uuid.UUID, info: RequestInfo) -> None:
    if db.execute(text("select 1 from investigation_evidence e join investigations i on i.id = e.investigation_id where e.ref_id = :d and e.removed_at is null and i.status not in ('resolved', 'dismissed')"), {"d": did}).first():
        raise ApiError(409, "in_use", "This document is evidence in an open investigation. Remove it from the case first.")
    r = db.execute(text("update documents set deleted_at = now() where id = :d and deleted_at is null returning filename"), {"d": did}).first()
    if r is None:
        raise ApiError(404, "not_found", "Document not found.")
    audit.record(db, org, "document.deleted", actor_id=actor.id, record_type="document", record_id=did, after={"filename": r.filename}, info=info)
