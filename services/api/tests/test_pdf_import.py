import json

import pytest

from app.core.config import get_settings
from app.services import pdf_import
from tests.test_documents_api import make_pdf
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401
from tests.test_ledger_api import Org, fixed_today, org  # noqa: F401

DOC = "Invoice INV-7001 Northwind Labs total 1,250.00 USD issued 2026-11-01 due 2026-12-01"


@pytest.fixture
def llm_on(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VENN_LLM_API_KEY", "k")
    monkeypatch.setenv("VENN_LLM_MODEL", "m")
    get_settings.cache_clear()
    yield  # type: ignore[misc]
    get_settings.cache_clear()


def upload(o: Org, data: bytes, kind: str = "invoices"):  # type: ignore[no-untyped-def]
    return o.c.post("/api/v1/imports/pdf", data={"kind": kind}, files={"file": ("doc.pdf", data, "application/pdf")}, headers=o.h)


def rows(*r: dict) -> str:  # type: ignore[type-arg]
    return json.dumps({"rows": list(r)})


GOOD = {"invoice_number": "INV-7001", "customer": "Northwind Labs", "issue_date": "2026-11-01", "due_date": "2026-12-01", "total_amount": "1250.00", "currency": "USD", "po_number": ""}


def test_rows_not_written_in_the_document_are_removed() -> None:
    kept, dropped = pdf_import.grounded([GOOD, {**GOOD, "invoice_number": "INV-9999"}, {**GOOD, "total_amount": "777.00"}], "invoices", DOC)
    assert [r["invoice_number"] for r in kept] == ["INV-7001"] and dropped == 2
    paid, none = pdf_import.grounded([{"date": "2026-11-02", "amount": "1,250.00", "currency": "USD", "reference": "", "payer_name": "Northwind"}], "payments", DOC)
    assert len(paid) == 1 and none == 0  # a payment without a reference is kept when its amount is in the text


def test_pdf_is_read_reviewed_and_only_saved_after_confirmation(org: Org, llm_on: None, monkeypatch: pytest.MonkeyPatch) -> None:
    pdf = make_pdf(DOC)
    assert upload(org, pdf).status_code == 409 and upload(org, pdf).json()["code"] == "ai_disabled"
    assert org.c.patch("/api/v1/settings/financial", json={"ai_enabled": True}, headers=org.h).status_code == 200
    monkeypatch.setattr(pdf_import, "_ask", lambda kind, text: rows(GOOD, {**GOOD, "invoice_number": "INV-9999", "total_amount": "5.00"}))
    r = upload(org, pdf)
    assert r.status_code == 201 and r.json()["pdf"] == {"rows_found": 1, "rows_removed": 1} and r.json()["counts"]["total"] == 1 and r.json()["filename"].endswith("(read from PDF)")
    assert org.get("/invoices").json()["total"] == 0  # nothing is saved yet
    done = org.post(f"/imports/{r.json()['id']}/commit")
    assert done.status_code == 200 and done.json()["created"] == 1
    inv = org.get("/invoices").json()["data"][0]
    assert inv["invoice_number"] == "INV-7001" and inv["total_amount"] == "1250.00" and inv["customer_name"] == "Northwind Labs"


def test_bad_inputs_and_provider_failures_change_nothing(org: Org, llm_on: None, monkeypatch: pytest.MonkeyPatch) -> None:
    org.c.patch("/api/v1/settings/financial", json={"ai_enabled": True}, headers=org.h)
    assert upload(org, b"MZ not a pdf").status_code == 415
    assert upload(org, make_pdf("")).status_code == 422  # no text: a scanned page
    monkeypatch.setattr(pdf_import, "_ask", lambda kind, text: "not json")
    assert upload(org, make_pdf(DOC)).status_code == 424
    monkeypatch.setattr(pdf_import, "_ask", lambda kind, text: rows({**GOOD, "invoice_number": "INV-0000", "total_amount": "1.00"}))
    assert upload(org, make_pdf(DOC)).status_code == 422  # every proposed row was removed
    assert org.get("/invoices").json()["total"] == 0
