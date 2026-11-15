"""CSV import rules, free of any database: header mapping, date formats and row validation.

Every row ends up as exactly one of: valid, warning (will be saved, with a note), error (not saved) or duplicate (skipped).
Nothing is silently overwritten (FEATURE_SPECIFICATION A.6).
"""

import csv
import hashlib
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from app.core.money import parse_money

MAX_BYTES = 20 * 1024 * 1024
MAX_ROWS = 20000

ALIASES: dict[str, dict[str, list[str]]] = {
    "invoices": {
        "invoice_number": ["invoice number", "invoice no", "invoice", "invoice id", "number", "inv no", "inv"],
        "customer": ["customer", "customer name", "client", "client name", "bill to"],
        "issue_date": ["issue date", "invoice date", "issued", "date issued", "date"],
        "due_date": ["due date", "due", "payment due", "date due"],
        "total_amount": ["total amount", "total", "amount", "invoice total", "gross", "amount due"],
        "currency": ["currency", "cur", "ccy"],
        "po_number": ["po number", "po", "purchase order", "po no"],
        "description": ["description", "memo", "notes"],
        "external_id": ["external id", "id", "source id"],
    },
    "payments": {
        "date": ["date", "payment date", "received", "received date", "value date", "posting date", "transaction date"],
        "amount": ["amount", "payment amount", "credit", "total"],
        "currency": ["currency", "cur", "ccy"],
        "reference": ["reference", "ref", "remittance", "remittance reference", "bank reference"],
        "payer_name": ["payer name", "payer", "from", "counterparty", "name", "sender", "customer"],
        "method": ["method", "payment method", "type"],
        "external_id": ["external id", "transaction id", "txn id", "id"],
        "memo": ["memo", "description", "notes", "narrative"],
    },
}
REQUIRED = {"invoices": ["invoice_number", "customer", "issue_date", "due_date", "total_amount"], "payments": ["date", "amount"]}
FIELDS = {k: list(v) for k, v in ALIASES.items()}


def norm(header: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[_\-]+", " ", header.strip().lower())).strip()


def detect_mapping(kind: str, headers: list[str]) -> dict[str, str]:
    """Maps each target field to the header that most likely holds it. A header is used for one field only."""
    by_norm = {norm(h): h for h in headers}
    mapping: dict[str, str] = {}
    used: set[str] = set()
    for target, names in ALIASES[kind].items():
        for cand in [target.replace("_", " "), *names]:
            h = by_norm.get(cand)
            if h is not None and h not in used:
                mapping[target] = h
                used.add(h)
                break
    return mapping


def missing_required(kind: str, mapping: dict[str, str]) -> list[str]:
    return [f for f in REQUIRED[kind] if f not in mapping]


@dataclass
class Parsed:
    headers: list[str]
    rows: list[dict[str, str]]


class CsvProblem(ValueError):  # noqa: N818
    pass


def read_csv(content: bytes) -> Parsed:
    if len(content) > MAX_BYTES:
        raise CsvProblem("The file is larger than 20 MB.")
    if b"\x00" in content[:4096]:
        raise CsvProblem("This does not look like a CSV text file.")
    try:
        text = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = content.decode("latin-1")
    sample = text[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
    except csv.Error:
        dialect = csv.excel
    reader = csv.reader(io.StringIO(text), dialect)
    try:
        headers = [h.strip() for h in next(reader)]
    except StopIteration as e:
        raise CsvProblem("The file is empty.") from e
    if len(set(headers)) != len(headers) or not all(headers):
        raise CsvProblem("The header row needs a distinct name for every column.")
    rows = [dict(zip(headers, (c.strip() for c in r), strict=False)) for r in reader if any(c.strip() for c in r)]
    if len(rows) > MAX_ROWS:
        raise CsvProblem(f"The file has more than {MAX_ROWS} rows. Split it and import in parts.")
    return Parsed(headers, rows)


# ----------------------------------------------------------------------------------------------------- dates
_ISO = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})$")
_SLASH = re.compile(r"^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$")


def detect_date_format(values: list[str]) -> str | None:
    """'iso' when every date is YYYY-MM-DD; 'dmy' or 'mdy' when the values settle it; None when it is ambiguous (03/04/2026)."""
    seen_dmy = seen_mdy = False
    for v in values:
        v = v.strip()
        if not v or _ISO.match(v):
            continue
        m = _SLASH.match(v)
        if not m:
            return "iso"  # unparseable text is reported per row
        a, b = int(m[1]), int(m[2])
        if a > 12:
            seen_dmy = True
        elif b > 12:
            seen_mdy = True
    if seen_dmy and not seen_mdy:
        return "dmy"
    if seen_mdy and not seen_dmy:
        return "mdy"
    return "iso" if not any(_SLASH.match(v.strip()) for v in values) else None


def parse_date(text: str, fmt: str) -> date:
    text = text.strip()
    m = _ISO.match(text)
    try:
        if m:
            return date(int(m[1]), int(m[2]), int(m[3]))
        s = _SLASH.match(text)
        if s:
            a, b, y = int(s[1]), int(s[2]), int(s[3])
            if fmt == "dmy":
                return date(y, b, a)
            if fmt == "mdy":
                return date(y, a, b)
            raise ValueError("Confirm whether dates are day/month/year or month/day/year.")
    except ValueError as e:
        raise ValueError(str(e) if "Confirm" in str(e) else f"{text} is not a valid date.") from e
    raise ValueError(f"{text} is not a valid date. Use YYYY-MM-DD.")


# -------------------------------------------------------------------------------------------------- validation
@dataclass
class Result:
    cls: str
    messages: list[str] = field(default_factory=list)
    data: dict[str, Any] | None = None


def fingerprint(d: date, amount: Decimal, currency: str, reference: str | None, payer: str | None) -> str:
    key = "|".join([d.isoformat(), format(amount.normalize(), "f"), currency.upper(), (reference or "").strip().lower(), (payer or "").strip().lower()])
    return hashlib.sha256(key.encode()).hexdigest()


@dataclass
class Lookups:
    default_currency: str
    customers: dict[str, str] = field(default_factory=dict)  # lower name or alias -> customer id
    invoice_keys: set[tuple[str, str]] = field(default_factory=set)  # (lower customer name, lower invoice number) already stored
    fingerprints: set[str] = field(default_factory=set)
    external_ids: set[str] = field(default_factory=set)


def _get(row: dict[str, str], mapping: dict[str, str], key: str) -> str:
    h = mapping.get(key)
    return (row.get(h, "") if h else "").strip()


def _amount(text: str, what: str, msgs: list[str], errors: list[str]) -> Decimal | None:
    cleaned = text.replace(",", "").replace("$", "").replace("£", "").replace("€", "").strip()
    try:
        d = parse_money(cleaned)
    except ValueError:
        errors.append(f"{what} is missing or not a valid amount.")
        return None
    if d <= 0:
        errors.append(f"{what} must be above zero.")
        return None
    if d.as_tuple().exponent < -2:  # type: ignore[operator]
        msgs.append(f"{what} has more than two decimals; it will be saved exactly as written.")
    return d


def validate_invoices(rows: list[dict[str, str]], mapping: dict[str, str], fmt: str, lk: Lookups) -> list[Result]:
    out: list[Result] = []
    seen: set[tuple[str, str]] = set()
    for row in rows:
        errors: list[str] = []
        warns: list[str] = []
        number, cust = _get(row, mapping, "invoice_number"), _get(row, mapping, "customer")
        if not number:
            errors.append("Invoice number is missing.")
        if not cust:
            errors.append("Customer is missing.")
        dates: dict[str, date] = {}
        for f, label in (("issue_date", "Issue date"), ("due_date", "Due date")):
            try:
                dates[f] = parse_date(_get(row, mapping, f), fmt)
            except ValueError as e:
                errors.append(f"{label}: {e}" if _get(row, mapping, f) else f"{label} is missing.")
        total = _amount(_get(row, mapping, "total_amount"), "Total amount", warns, errors)
        if len(dates) == 2 and dates["due_date"] < dates["issue_date"]:
            errors.append("The due date is before the issue date.")
        currency = (_get(row, mapping, "currency") or lk.default_currency).upper()
        if not re.fullmatch(r"[A-Z]{3}", currency):
            errors.append(f"{currency} is not a currency code.")
        if errors:
            out.append(Result("error", errors))
            continue
        key = (cust.lower(), number.lower())
        if key in lk.invoice_keys or key in seen:
            out.append(Result("duplicate", [f"Invoice {number} already exists for {cust}." if key in lk.invoice_keys else f"Invoice {number} appears more than once in this file."]))
            continue
        seen.add(key)
        if cust.lower() not in lk.customers:
            warns.append(f"{cust} is not a customer yet and will be created.")
        if not _get(row, mapping, "currency"):
            warns.append(f"No currency given; using {lk.default_currency}.")
        out.append(Result("warning" if warns else "valid", warns, {
            "invoice_number": number, "customer": cust, "issue_date": dates["issue_date"].isoformat(), "due_date": dates["due_date"].isoformat(),
            "total_amount": str(total), "currency": currency, "po_number": _get(row, mapping, "po_number") or None,
            "description": _get(row, mapping, "description") or None, "external_id": _get(row, mapping, "external_id") or None}))
    return out


def validate_payments(rows: list[dict[str, str]], mapping: dict[str, str], fmt: str, lk: Lookups) -> list[Result]:
    out: list[Result] = []
    seen_fp: set[str] = set()
    seen_ext: set[str] = set()
    for row in rows:
        errors: list[str] = []
        warns: list[str] = []
        d: date | None = None
        try:
            d = parse_date(_get(row, mapping, "date"), fmt)
        except ValueError as e:
            errors.append(f"Date: {e}" if _get(row, mapping, "date") else "Date is missing.")
        raw_amount = _get(row, mapping, "amount")
        if raw_amount.startswith("-") or raw_amount.startswith("("):
            errors.append("Negative amounts are outgoing money and are not imported. Remove them or send only incoming payments.")
            amount = None
        else:
            amount = _amount(raw_amount, "Amount", warns, errors)
        currency = (_get(row, mapping, "currency") or lk.default_currency).upper()
        if not re.fullmatch(r"[A-Z]{3}", currency):
            errors.append(f"{currency} is not a currency code.")
        if errors or d is None or amount is None:
            out.append(Result("error", errors))
            continue
        ref, payer, ext = _get(row, mapping, "reference") or None, _get(row, mapping, "payer_name") or None, _get(row, mapping, "external_id") or None
        fp = fingerprint(d, amount, currency, ref, payer)
        if (ext and (ext in lk.external_ids or ext in seen_ext)) or fp in lk.fingerprints or fp in seen_fp:
            out.append(Result("duplicate", ["This payment is already in venn or appears more than once in this file."]))
            continue
        seen_fp.add(fp)
        if ext:
            seen_ext.add(ext)
        if not _get(row, mapping, "currency"):
            warns.append(f"No currency given; using {lk.default_currency}.")
        cid = lk.customers.get((payer or "").lower())
        if payer and not cid:
            warns.append(f"{payer} does not match a customer or payer alias; the payment will be unmatched.")
        out.append(Result("warning" if warns else "valid", warns, {
            "payment_date": d.isoformat(), "amount": str(amount), "currency": currency, "reference": ref, "payer_name_raw": payer,
            "method": _get(row, mapping, "method") or None, "external_id": ext, "memo": _get(row, mapping, "memo") or None,
            "fingerprint": fp, "customer_id": cid}))
    return out


def problems_csv(rows: list[dict[str, Any]], headers: list[str]) -> str:
    """Rows that were not imported, with the reason, ready to fix in a spreadsheet. Cells that could run a formula are neutralised."""
    def safe(v: Any) -> str:
        s = "" if v is None else str(v)
        return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s

    buf = io.StringIO()
    cols = headers  # jsonb does not keep key order, so the original header order comes from the job
    w = csv.writer(buf)
    w.writerow(["row", "result", "reason", *cols])
    for r in rows:
        w.writerow([r["row_number"], r["class"], "; ".join(r["messages"]), *(safe(r["raw"].get(c)) for c in cols)])
    return buf.getvalue()


def today_iso() -> str:
    return datetime.now().date().isoformat()
