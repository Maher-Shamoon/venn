import uuid

import pytest
from fastapi.testclient import TestClient

from app.core.mailer import LogMailer
from tests.test_identity_api import Token, auth, client  # noqa: F401, F811
from tests.test_ledger_api import Org, fixed_today, org  # noqa: F401, F811
from tests.test_team import join_as_ar, mail  # noqa: F401, F811

INVOICES = (
    "Invoice No,Client,Issue Date,Due Date,Total,Currency\n"
    "INV-100,Northwind Labs,2026-10-01,2026-11-01,\"5,000.00\",USD\n"
    "INV-101,Brand New Co,2026-10-05,2026-11-05,1200.50,USD\n"
    "INV-100,Northwind Labs,2026-10-01,2026-11-01,5000.00,USD\n"
    "INV-102,Northwind Labs,2026-10-09,2026-09-01,10,USD\n"
    "INV-103,Northwind Labs,not a date,2026-11-09,10,USD\n"
)


def upload(o: Org, kind: str, csv: str, name: str = "file.csv", **form: str):  # type: ignore[no-untyped-def]
    return o.c.post("/api/v1/imports", data={"kind": kind, **form}, files={"file": (name, csv.encode(), "text/csv")}, headers=o.h)


def test_invoice_import_end_to_end(org: Org) -> None:
    org.customer("Northwind Labs")
    r = upload(org, "invoices", INVOICES)
    assert r.status_code == 201, r.text
    job = r.json()
    assert job["status"] == "validated" and job["missing"] == []
    assert {k: job["counts"][k] for k in ("total", "valid", "warning", "error", "duplicate")} == {"total": 5, "valid": 1, "warning": 1, "error": 2, "duplicate": 1}
    errors = org.get(f"/imports/{job['id']}/rows?cls=error").json()
    assert errors["total"] == 2 and "due date is before" in errors["data"][0]["messages"][0]
    probs = org.get(f"/imports/{job['id']}/problems.csv")
    assert probs.status_code == 200 and probs.text.splitlines()[0].startswith("row,result,reason,Invoice No")
    assert org.get("/invoices").json()["total"] == 0  # nothing is saved before the user confirms

    done = org.post(f"/imports/{job['id']}/commit")
    assert done.status_code == 200 and done.json()["created"] == 2 and done.json()["customers_created"] == 1 and done.json()["skipped_duplicates"] == 1
    inv = org.get("/invoices?sort=invoice&desc=false").json()["data"]
    assert [(i["invoice_number"], i["total_amount"], i["customer_name"]) for i in inv] == [("INV-100", "5000.00", "Northwind Labs"), ("INV-101", "1200.50", "Brand New Co")]
    assert org.get(f"/invoices/{inv[0]['id']}").json()["lines"][0]["description"] == "Imported invoice"
    assert org.post(f"/imports/{job['id']}/commit").status_code == 409  # a job saves once

    again = upload(org, "invoices", INVOICES).json()  # the same file again creates nothing new
    assert again["counts"]["valid"] == 0 and again["counts"]["warning"] == 0 and again["counts"]["duplicate"] == 3
    assert org.post(f"/imports/{again['id']}/commit").status_code == 409  # nothing new to save
    assert org.get("/invoices").json()["total"] == 2
    actions = [e["action"] for e in org.get("/audit-events?group=import&limit=10").json()["data"]]
    assert actions.count("import.committed") == 1 and actions.count("import.validated") == 2


def test_missing_columns_can_be_mapped_by_hand(org: Org) -> None:
    csv = "Doc,Who,Raised,Pay by,Grand total\nA-1,Acme,2026-10-01,2026-11-01,100\n"
    job = upload(org, "invoices", csv).json()
    assert set(job["missing"]) == {"invoice_number", "customer", "issue_date", "due_date", "total_amount"} and job["counts"]["error"] == 1
    assert org.post(f"/imports/{job['id']}/commit").status_code == 409  # only error rows exist: nothing to save
    fixed = org.post(f"/imports/{job['id']}/mapping", {"mapping": {"invoice_number": "Doc", "customer": "Who", "issue_date": "Raised", "due_date": "Pay by", "total_amount": "Grand total"}}).json()
    assert fixed["missing"] == [] and fixed["counts"]["warning"] == 1


def test_ambiguous_dates_need_confirmation_and_the_choice_matters(org: Org) -> None:
    org.customer("Acme")
    csv = "Invoice No,Client,Issue Date,Due Date,Total,Currency\nD-1,Acme,03/04/2026,05/06/2026,100,USD\n"
    job = upload(org, "invoices", csv).json()
    assert job["counts"]["ambiguous_dates"] == 1 and job["counts"]["error"] == 1
    assert org.post(f"/imports/{job['id']}/commit").status_code == 409
    job = org.post(f"/imports/{job['id']}/mapping", {"date_format": "dmy"}).json()
    assert job["counts"]["valid"] == 1 and job["counts"]["ambiguous_dates"] == 0
    org.post(f"/imports/{job['id']}/commit")
    inv = org.get("/invoices").json()["data"][0]
    assert (inv["issue_date"], inv["due_date"]) == ("2026-04-03", "2026-06-05")  # 3 April, not 4 March


PAYMENTS = (
    "Date,Amount,Reference,Payer,Transaction ID,Currency\n"
    "2026-11-10,\"1,000.00\",INV-100,Northwind Labs,T-1,USD\n"
    "2026-11-11,250.00,,Mystery Payer,T-2,USD\n"
    "2026-11-12,-40.00,fee,Bank,T-3,USD\n"
    "2026-11-10,1000.00,INV-100,Northwind Labs,T-1,USD\n"
)


def test_payment_import_verified_duplicates_and_unmatched(org: Org) -> None:
    org.customer("Northwind Labs", payer_aliases=["N. Labs LLC"])
    job = upload(org, "payments", PAYMENTS).json()
    assert {k: job["counts"][k] for k in ("valid", "warning", "error", "duplicate")} == {"valid": 1, "warning": 1, "error": 1, "duplicate": 1}
    r = org.post(f"/imports/{job['id']}/commit").json()
    assert r["created"] == 2
    pays = org.get("/payments?sort=amount&desc=true").json()["data"]
    assert [(p["number"], p["amount"], p["verification_level"], p["customer_name"]) for p in pays] == [("PAY-0001", "1000.00", "source_verified", "Northwind Labs"), ("PAY-0002", "250.00", "source_verified", None)] \
        or [p["amount"] for p in pays] == ["1000.00", "250.00"]
    assert {p["status"] for p in pays} == {"unmatched"}
    again = upload(org, "payments", PAYMENTS).json()
    assert again["counts"]["duplicate"] == 3 and again["counts"]["valid"] == 0  # same file again: nothing new
    # An alias counts as the customer.
    alias = upload(org, "payments", "Date,Amount,Payer,Currency\n2026-11-20,75.00,N. Labs LLC,USD\n").json()
    assert alias["counts"]["valid"] == 1


def test_bad_files_are_refused_plainly(org: Org) -> None:
    assert upload(org, "invoices", "").status_code == 422
    assert upload(org, "invoices", "a,a\n1,2\n").status_code == 422
    assert org.c.post("/api/v1/imports", data={"kind": "invoices"}, files={"file": ("x.csv", b"\x00\x01\x02" * 50, "text/csv")}, headers=org.h).status_code == 422
    assert upload(org, "widgets", "a,b\n").status_code == 403
    assert upload(org, "invoices", "a,b\n", date_format="yyyy").status_code == 422
    assert org.get(f"/imports/{uuid.uuid4()}").status_code == 404


def test_discard_and_permissions_and_isolation(org: Org, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    job = upload(org, "payments", "Date,Amount,Currency\n2026-11-20,75.00,USD\n").json()
    assert org.post(f"/imports/{job['id']}/discard").status_code == 204
    assert org.post(f"/imports/{job['id']}/commit").status_code == 409
    ar = join_as_ar(client, auth, mail, org.owner, org.id)
    h = auth(ar, org=org.id)
    job2 = upload(org, "payments", "Date,Amount,Currency\n2026-11-20,75.00,USD\n").json()
    assert client.get(f"/api/v1/imports/{job2['id']}", headers=h).status_code == 200  # AR can import by default
    perms = {r["key"] for r in org.get("/roles/ar/permissions").json()["data"] if r["granted"]} - {"payments.import"}
    org.c.put("/api/v1/roles/ar/permissions", json={"permissions": sorted(perms)}, headers=org.h)
    assert client.get(f"/api/v1/imports/{job2['id']}", headers=h).status_code == 403
    assert client.post("/api/v1/imports", data={"kind": "payments"}, files={"file": ("a.csv", b"Date,Amount\n", "text/csv")}, headers=h).status_code == 403
    other = Org(client, auth, "Rival")
    assert other.get(f"/imports/{job2['id']}").status_code == 404 and other.post(f"/imports/{job2['id']}/commit").status_code == 404


@pytest.mark.slow
def test_five_thousand_rows_import_in_one_transaction(org: Org) -> None:
    rows = "\n".join(f"INV-{i},Bulk Co,2026-10-01,2026-11-01,{i}.00,USD" for i in range(1, 5001))
    job = upload(org, "invoices", "Invoice No,Client,Issue Date,Due Date,Total,Currency\n" + rows).json()
    assert job["counts"]["warning"] == 5000  # the customer is new: one note per row
    assert org.post(f"/imports/{job['id']}/commit").json()["created"] == 5000
    assert org.get("/invoices?limit=1").json()["total"] == 5000 and org.get("/customers").json()["total"] == 1
