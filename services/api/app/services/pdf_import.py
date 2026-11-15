"""Reading invoices or payments from a PDF (MOD-09, E2). The PDF's text is extracted with pypdf, a model proposes rows, and every proposed row
goes through exactly the same review as a CSV: nothing is saved until a person confirms it.

The model cannot invent a row: a record number or amount that does not appear in the document's own text removes that row, and the rest of
the validation (duplicates, dates, customers, balances) is the deterministic import pipeline.
"""

import csv
import io
import json
import re
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.errors import ApiError
from app.services import ai

FIELDS = {
    "invoices": ["invoice_number", "customer", "issue_date", "due_date", "total_amount", "currency", "po_number"],
    "payments": ["date", "amount", "currency", "reference", "payer_name"],
}
KEY = {"invoices": "invoice_number", "payments": "reference"}
MONEY = {"invoices": "total_amount", "payments": "amount"}
MAX_TEXT = 30_000
SYSTEM = (
    "You read the text of a document and list the {what} it contains. Return JSON only: {{\"rows\": [{{{fields}}}]}}. "
    "Copy values exactly as written in the document. Use ISO dates (YYYY-MM-DD). Leave a value empty if it is not written in the document. "
    "Never invent a row or a value. If the document contains no {what}, return {{\"rows\": []}}."
)


def pdf_text(content: bytes) -> str:
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            raise ApiError(422, "validation_error", "The PDF is password protected.")
        return "\n".join((p.extract_text() or "") for p in reader.pages[:50]).strip()[:MAX_TEXT]
    except ApiError:
        raise
    except Exception as e:  # noqa: BLE001
        raise ApiError(422, "validation_error", "The PDF could not be read.") from e


def _ask(kind: str, text_in: str) -> str:
    c = get_settings()
    what = "invoices" if kind == "invoices" else "payments received"
    system = SYSTEM.format(what=what, fields=", ".join(f'"{f}": "..."' for f in FIELDS[kind]))
    return ai.chat({"model": c.llm_model, "temperature": 0, "max_tokens": 3000, "response_format": {"type": "json_object"}, "messages": [{"role": "system", "content": system}, {"role": "user", "content": text_in}]}, timeout=40)


def _digits(s: str) -> str:
    return re.sub(r"[^0-9]", "", s)


def grounded(rows: list[dict[str, Any]], kind: str, source: str) -> tuple[list[dict[str, str]], int]:
    """Keeps rows whose record number and amount are written in the document."""
    norm = re.sub(r"\s+", " ", source).lower()
    digits = _digits(source)
    kept: list[dict[str, str]] = []
    dropped = 0
    for r in rows[:500]:
        row = {f: str(r.get(f, "") or "").strip() for f in FIELDS[kind]}
        key, money = row[KEY[kind]], row[MONEY[kind]]
        amount_ok = bool(money) and (re.sub(r"[^0-9.]", "", money).replace(".", "") in digits or _digits(money) in digits)
        key_ok = bool(key) and re.sub(r"\s+", " ", key).lower() in norm
        if kind == "payments" and not key:
            key_ok = True  # a payment may have no reference; its amount must still be in the document
        if amount_ok and key_ok:
            kept.append(row)
        else:
            dropped += 1
    return kept, dropped


def to_csv(kind: str, rows: list[dict[str, str]]) -> bytes:
    out = io.StringIO()
    w = csv.DictWriter(out, fieldnames=FIELDS[kind])
    w.writeheader()
    w.writerows(rows)
    return out.getvalue().encode("utf-8")


def extract(kind: str, content: bytes) -> tuple[bytes, int, int]:
    """Returns (csv bytes of the grounded rows, rows kept, rows removed). Raises ApiError with a plain message on every failure."""
    c = get_settings()
    if not (c.llm_api_key and c.llm_model):
        raise ApiError(409, "ai_unavailable", "Reading PDFs needs the AI service, which is not configured.")
    source = pdf_text(content)
    if not source:
        raise ApiError(422, "validation_error", "No text was found in this PDF. A scanned PDF needs OCR, which is not available yet. Upload a CSV instead.")
    try:
        rows = json.loads(_ask(kind, source))["rows"]
        if not isinstance(rows, list):
            raise TypeError
    except ai.BusyError as e:
        raise ApiError(429, "ai_busy", "The AI service is busy right now (the free plan has a per-minute limit). Wait a minute and try again. Nothing was changed.") from e
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as e:
        raise ApiError(424, "ai_failed", "The document could not be read this time. Nothing was changed. Try again, or upload a CSV.") from e
    kept, dropped = grounded([r for r in rows if isinstance(r, dict)], kind, source)
    if not kept:
        raise ApiError(422, "validation_error", f"No {kind} that match the document's text were found.")
    return to_csv(kind, kept), len(kept), dropped
