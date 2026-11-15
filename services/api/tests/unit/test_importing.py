from datetime import date

import pytest

from app.services import importing as imp
from app.services.importing import Lookups


def lk(**kw: object) -> Lookups:
    return Lookups(default_currency="USD", **kw)  # type: ignore[arg-type]


def test_headers_are_matched_by_name_variants_and_used_once() -> None:
    m = imp.detect_mapping("invoices", ["Invoice No", "Client Name", "Invoice Date", "Due", "Total", "CCY", "Notes"])
    assert m == {"invoice_number": "Invoice No", "customer": "Client Name", "issue_date": "Invoice Date", "due_date": "Due",
                 "total_amount": "Total", "currency": "CCY", "description": "Notes"}
    assert imp.missing_required("invoices", {"customer": "x"}) == ["invoice_number", "issue_date", "due_date", "total_amount"]
    p = imp.detect_mapping("payments", ["Value Date", "Credit", "Remittance Reference", "Sender", "Transaction ID"])
    assert p == {"date": "Value Date", "amount": "Credit", "reference": "Remittance Reference", "payer_name": "Sender", "external_id": "Transaction ID"}


def test_csv_reading_handles_bom_delimiters_blank_rows_and_junk() -> None:
    parsed = imp.read_csv("﻿a;b\n1;2\n\n3;4\n".encode())
    assert parsed.headers == ["a", "b"] and parsed.rows == [{"a": "1", "b": "2"}, {"a": "3", "b": "4"}]
    for bad, why in ((b"", "empty"), (b"a,a\n1,2", "distinct"), (b"\x00\x01\x02binary", "CSV"), (b"a,b\n" + b"1,2\n" * (imp.MAX_ROWS + 1), "rows")):
        with pytest.raises(imp.CsvProblem, match=why):
            imp.read_csv(bad)


def test_date_format_detection_and_parsing() -> None:
    assert imp.detect_date_format(["2026-03-04", "2026-12-31"]) == "iso"
    assert imp.detect_date_format(["13/04/2026", "03/04/2026"]) == "dmy"
    assert imp.detect_date_format(["04/13/2026", "03/04/2026"]) == "mdy"
    assert imp.detect_date_format(["03/04/2026", "05/06/2026"]) is None  # 3 April or 4 March: the user must say
    assert imp.parse_date("03/04/2026", "dmy") == date(2026, 4, 3) and imp.parse_date("03/04/2026", "mdy") == date(2026, 3, 4)
    for bad in ("2026-02-30", "31/02/2026", "yesterday", "03/04/2026"):
        with pytest.raises(ValueError, match="date|Confirm"):
            imp.parse_date(bad, "none" if bad == "03/04/2026" else "dmy")


M = {"invoice_number": "n", "customer": "c", "issue_date": "i", "due_date": "d", "total_amount": "t", "currency": "cur"}


def row(**kw: str) -> dict[str, str]:
    return {"n": "INV-1", "c": "Northwind", "i": "2026-10-01", "d": "2026-11-01", "t": "1,200.50", "cur": "USD", **kw}


def test_invoice_rows_are_classified() -> None:
    known = lk(customers={"northwind": "id1"})
    r = imp.validate_invoices([row(), row(n="INV-2", c="Brand New"), row(n="INV-3", t="0"), row(n="INV-4", d="2026-09-01"), row(n=""), row(n="INV-5", i="nonsense")], M, "iso", known)
    assert [x.cls for x in r] == ["valid", "warning", "error", "error", "error", "error"]
    assert "will be created" in r[1].messages[0]
    assert r[0].data and r[0].data["total_amount"] == "1200.50"


def test_invoice_duplicates_in_database_and_in_file() -> None:
    known = lk(customers={"northwind": "id1"}, invoice_keys={("northwind", "inv-9")})
    r = imp.validate_invoices([row(n="INV-9"), row(n="INV-1"), row(n="inv-1")], M, "iso", known)
    assert [x.cls for x in r] == ["duplicate", "valid", "duplicate"]


P = {"date": "d", "amount": "a", "reference": "r", "payer_name": "p", "currency": "cur"}


def test_payment_rows_are_classified_and_negatives_refused() -> None:
    known = lk(customers={"northwind labs": "c1"})
    rows = [{"d": "2026-11-10", "a": "1000.00", "r": "INV-1", "p": "Northwind Labs", "cur": "USD"}, {"d": "2026-11-10", "a": "50", "r": "", "p": "Unknown Ltd", "cur": "USD"},
            {"d": "2026-11-10", "a": "-5", "r": "", "p": ""}, {"d": "", "a": "10", "r": "", "p": ""}, {"d": "2026-11-10", "a": "abc", "r": "", "p": ""}]
    r = imp.validate_payments(rows, P, "iso", known)
    assert [x.cls for x in r] == ["valid", "warning", "error", "error", "error"]
    assert r[0].data and r[0].data["customer_id"] == "c1" and "negative" in r[2].messages[0].lower()


def test_payment_duplicates_use_the_fingerprint_and_external_id() -> None:
    base = {"d": "2026-11-10", "a": "1000.00", "r": "INV-1", "p": "Northwind", "cur": "USD"}
    fp = imp.fingerprint(date(2026, 11, 10), imp.parse_money("1000.00"), "USD", "INV-1", "Northwind")
    r = imp.validate_payments([base, base, {**base, "a": "999"}], P, "iso", lk(fingerprints={fp}))
    assert [x.cls for x in r] == ["duplicate", "duplicate", "warning"]  # new payment, payer unknown
    ext = imp.validate_payments([{**base, "x": "T1"}, {**base, "a": "2", "x": "T1"}], {**P, "external_id": "x"}, "iso", lk())
    assert [x.cls for x in ext] == ["warning", "duplicate"]  # saved with a note: payer unknown


def test_problem_rows_csv_neutralises_formulas() -> None:
    out = imp.problems_csv([{"row_number": 2, "class": "error", "messages": ["Bad total", "Bad date"], "raw": {"total": "x", "customer": "=cmd|' /C calc'!A0"}}], ["customer", "total"])
    lines = out.strip().splitlines()
    assert lines[0] == "row,result,reason,customer,total" and "'=cmd" in lines[1] and "Bad total; Bad date" in lines[1]
