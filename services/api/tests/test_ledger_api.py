import uuid
from collections.abc import Iterator
from datetime import UTC, datetime
from decimal import Decimal as D  # noqa: N817

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError

from app.core import clock
from app.core.mailer import LogMailer
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401, F811
from tests.test_team import join_as_ar, mail  # noqa: F401


@pytest.fixture(autouse=True)
def fixed_today() -> Iterator[None]:
    clock._override = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)
    yield
    clock._override = None


class Org:
    def __init__(self, client: TestClient, auth: Token, name: str = "Acme") -> None:  # noqa: F811
        self.c, self.owner, self.id = client, *new_org(client, auth, name)
        self.h = auth(self.owner, org=self.id)

    def post(self, path: str, body: dict | None = None):  # type: ignore[no-untyped-def]
        return self.c.post(f"/api/v1{path}", json=body or {}, headers=self.h)

    def get(self, path: str):  # type: ignore[no-untyped-def]
        return self.c.get(f"/api/v1{path}", headers=self.h)

    def customer(self, name: str = "Northwind Labs", **kw: object) -> str:
        r = self.post("/customers", {"name": name, **kw})
        assert r.status_code == 201, r.text
        return str(r.json()["id"])

    def invoice(self, customer: str, amount: str = "1000.00", due: str = "2026-11-01", number: str | None = None, **kw: object) -> dict:  # type: ignore[type-arg]
        body = {"customer_id": customer, "issue_date": "2026-10-01", "due_date": due, "lines": [{"description": "Work", "quantity": "1", "unit_price": amount}], **kw}
        if number:
            body["invoice_number"] = number
        r = self.post("/invoices", body)
        assert r.status_code == 201, r.text
        return r.json()  # type: ignore[no-any-return]

    def payment(self, amount: str = "1000.00", **kw: object) -> dict:  # type: ignore[type-arg]
        r = self.post("/payments", {"payment_date": "2026-11-10", "amount": amount, "payer_name_raw": "NORTHWIND", **kw})
        assert r.status_code == 201, r.text
        return r.json()  # type: ignore[no-any-return]

    def allocate(self, payment: str, invoice: str, amount: str):  # type: ignore[no-untyped-def]
        return self.post(f"/payments/{payment}/allocations", {"invoice_id": invoice, "amount": amount})


@pytest.fixture
def org(client: TestClient, auth: Token) -> Org:  # noqa: F811
    return Org(client, auth)


# ---------------------------------------------------------------------------------------------- customers
def test_customer_crud_validation_and_duplicates(org: Org) -> None:
    assert org.post("/customers", {"name": "  "}).status_code == 422
    assert org.post("/customers", {"name": "X", "contact_email": "nope"}).status_code == 422
    cid = org.customer("Northwind Labs", payer_aliases=["N. Labs LLC", "n. labs llc", " "], payment_terms_days=30)
    c = org.get(f"/customers/{cid}").json()
    assert c["payer_aliases"] == ["N. Labs LLC"] and c["open_balance"] == "0.00" and c["version"] == 1
    dup = org.post("/customers", {"name": "northwind labs"})
    assert dup.status_code == 409 and dup.json()["code"] == "duplicate"
    p = org.c.patch(f"/api/v1/customers/{cid}", json={"city": "Austin"}, headers={**org.h, "If-Match": "1"})
    assert p.status_code == 200 and p.json()["city"] == "Austin" and p.json()["version"] == 2
    stale = org.c.patch(f"/api/v1/customers/{cid}", json={"city": "Dallas"}, headers={**org.h, "If-Match": "1"})
    assert stale.status_code == 409 and stale.json()["code"] == "version_conflict"
    assert org.get(f"/customers/{uuid.uuid4()}").status_code == 404


def test_customer_list_search_filter_sort_and_paging(org: Org) -> None:
    a, b, c = org.customer("Alder Health"), org.customer("Brightwater", payer_aliases=["BW Holdings"]), org.customer("Cobalt Energy")
    org.invoice(a, "500.00", due="2026-11-01", number="A-1")  # overdue
    org.invoice(b, "9000.00", due="2026-12-20", number="B-1")  # not yet due
    assert [x["name"] for x in org.get("/customers?sort=open_balance&desc=true").json()["data"]] == ["Brightwater", "Alder Health", "Cobalt Energy"]
    od = org.get("/customers?filter=overdue").json()
    assert [x["name"] for x in od["data"]] == ["Alder Health"] and od["total"] == 1 and od["data"][0]["overdue"] == "500.00"
    assert [x["name"] for x in org.get("/customers?q=bw hold").json()["data"]] == ["Brightwater"]  # finds by payer alias
    p2 = org.get("/customers?limit=2&page=2").json()
    assert [x["name"] for x in p2["data"]] == ["Cobalt Energy"] and p2["total"] == 3
    assert org.get("/customers?sort=dropdb").status_code == 400
    assert c


# ----------------------------------------------------------------------------------------------- invoices
def test_create_invoice_totals_numbers_and_validation(org: Org) -> None:
    cid = org.customer()
    inv = org.post("/invoices", {"customer_id": cid, "issue_date": "2026-10-01", "due_date": "2026-11-20", "po_number": "PO-9",
                                 "lines": [{"description": "Design", "quantity": "2", "unit_price": "1500.50"}, {"description": "Support", "quantity": "1", "unit_price": "0.01"}]})
    assert inv.status_code == 201
    j = inv.json()
    assert j["total_amount"] == "3001.01" and j["balance_due"] == "3001.01" and j["invoice_number"] == "INV-0001" and j["status"] == "issued"
    assert [ln["amount"] for ln in j["lines"]] == ["3001.00", "0.01"]
    assert org.invoice(cid)["invoice_number"] == "INV-0002"  # numbers are sequential per organization
    base = {"customer_id": cid, "issue_date": "2026-10-01", "due_date": "2026-11-20", "lines": [{"description": "x", "quantity": "1", "unit_price": "5"}]}
    for bad, field in (({"due_date": "2026-09-01"}, "due"), ({"lines": []}, "lines"), ({"customer_id": str(uuid.uuid4())}, "customer"),
                       ({"lines": [{"description": "x", "quantity": "0", "unit_price": "5"}]}, "qty"), ({"lines": [{"description": "x", "quantity": "1", "unit_price": 5.5}]}, "float")):
        assert org.post("/invoices", {**base, **bad}).status_code == 422, field
    dup = org.post("/invoices", {**base, "invoice_number": "INV-0001"})
    assert dup.status_code == 409 and dup.json()["code"] == "duplicate"


def test_invoice_status_overdue_uses_the_organization_timezone(org: Org) -> None:
    cid = org.customer()
    org.c.patch("/api/v1/settings/financial", json={"timezone": "Pacific/Auckland"}, headers=org.h)  # UTC+13: already 16 Nov there
    inv = org.invoice(cid, due="2026-11-15")
    assert inv["status"] == "overdue" and inv["days_late"] == 1
    org.c.patch("/api/v1/settings/financial", json={"timezone": "Pacific/Honolulu"}, headers=org.h)  # UTC-10: still 15 Nov
    assert org.get(f"/invoices/{inv['id']}").json()["status"] == "issued"


def test_invoice_tabs_search_and_sort(org: Org) -> None:
    cid = org.customer("Meridian Retail")
    late = org.invoice(cid, "100.00", due="2026-10-20", number="M-1")
    ok = org.invoice(cid, "200.00", due="2026-12-01", number="M-2")
    pay = org.payment("200.00")
    assert org.allocate(pay["id"], ok["id"], "200.00").status_code == 201
    ids = lambda q: [x["invoice_number"] for x in org.get(f"/invoices?{q}").json()["data"]]  # noqa: E731
    assert ids("tab=all&sort=invoice&desc=false") == ["M-1", "M-2"]
    assert ids("tab=open") == ["M-1"] and ids("tab=overdue") == ["M-1"] and ids("tab=paid") == ["M-2"]
    assert ids("q=meridian&sort=invoice&desc=false") == ["M-1", "M-2"] and ids("q=zzz") == []
    assert org.get("/invoices?tab=bogus").status_code == 400
    assert late["status"] == "overdue"


# ------------------------------------------------------------------------------------------ allocations
def test_allocation_updates_both_sides_and_is_audited(org: Org) -> None:
    cid = org.customer()
    inv, pay = org.invoice(cid, "1000.00"), org.payment("1000.00")
    r = org.allocate(pay["id"], inv["id"], "400.00")
    assert r.status_code == 201
    p = r.json()
    assert p["allocated_amount"] == "400.00" and p["unallocated_amount"] == "600.00" and p["status"] == "partially_allocated"
    i = org.get(f"/invoices/{inv['id']}").json()
    assert i["amount_paid"] == "400.00" and i["balance_due"] == "600.00" and i["status"] == "overdue" and len(i["allocations"]) == 1
    audit = org.get("/audit-events?group=allocation").json()["data"][0]
    assert audit["action"] == "allocation.created" and audit["after"]["invoice_balance"] == "600.0000"
    full = org.allocate(pay["id"], inv["id"], "600.00")  # a second allocation to the same pair is refused: void and redo instead
    assert full.status_code == 409 and full.json()["code"] == "duplicate"


def test_allocation_rules_are_enforced(org: Org) -> None:
    cid = org.customer()
    inv, pay = org.invoice(cid, "1000.00"), org.payment("1500.00")
    over_invoice = org.allocate(pay["id"], inv["id"], "1000.01")
    assert over_invoice.status_code == 422 and over_invoice.json()["errors"][0]["code"] == "allocation_exceeds_balance"
    small = org.payment("100.00")
    assert org.allocate(small["id"], inv["id"], "100.01").status_code == 422  # more than the payment holds
    assert org.allocate(pay["id"], inv["id"], "0").status_code == 422
    eur = org.post("/payments", {"payment_date": "2026-11-10", "amount": "50.00", "currency": "EUR"}).json()
    mismatch = org.allocate(eur["id"], inv["id"], "50.00")
    assert mismatch.status_code == 422 and mismatch.json()["errors"][0]["code"] == "currency_mismatch"
    assert org.allocate(pay["id"], str(uuid.uuid4()), "10.00").status_code == 422
    assert org.allocate(str(uuid.uuid4()), inv["id"], "10.00").status_code == 404
    org.post(f"/invoices/{inv['id']}/cancel", {"reason": "Raised in error"})
    assert org.allocate(pay["id"], inv["id"], "10.00").json()["code"] == "invalid_state"


def test_void_restores_balances_and_cannot_repeat(org: Org) -> None:
    cid = org.customer()
    inv, pay = org.invoice(cid, "1000.00"), org.payment("1000.00")
    aid = org.allocate(pay["id"], inv["id"], "1000.00").json()["allocations"][0]["id"]
    assert org.get(f"/invoices/{inv['id']}").json()["status"] == "paid"
    v = org.post(f"/allocations/{aid}/void", {"reason": "Wrong invoice"})
    assert v.status_code == 200 and v.json()["allocated_amount"] == "0.00" and v.json()["status"] == "unmatched"
    assert v.json()["allocations"][0]["voided_at"] and v.json()["allocations"][0]["void_reason"] == "Wrong invoice"
    i = org.get(f"/invoices/{inv['id']}").json()
    assert i["balance_due"] == "1000.00" and i["status"] == "overdue"
    assert org.post(f"/allocations/{aid}/void", {"reason": "again"}).status_code == 409
    assert org.allocate(pay["id"], inv["id"], "1000.00").status_code == 201  # history kept; a fresh allocation is allowed


def test_reversal_voids_everything_and_reopens_invoices(org: Org) -> None:
    cid = org.customer()
    a, b = org.invoice(cid, "300.00", number="R-1"), org.invoice(cid, "700.00", number="R-2")
    pay = org.payment("1000.00")
    org.allocate(pay["id"], a["id"], "300.00")
    org.allocate(pay["id"], b["id"], "700.00")
    assert org.post(f"/payments/{pay['id']}/reverse", {"reason": ""}).status_code == 422
    r = org.post(f"/payments/{pay['id']}/reverse", {"reason": "Bounced"})
    assert r.status_code == 200 and r.json()["status"] == "reversed" and r.json()["unallocated_amount"] == "0.00"
    assert all(x["voided_at"] for x in r.json()["allocations"])
    assert [org.get(f"/invoices/{x['id']}").json()["balance_due"] for x in (a, b)] == ["300.00", "700.00"]
    assert org.post(f"/payments/{pay['id']}/reverse", {"reason": "again"}).status_code == 409
    assert org.allocate(pay["id"], a["id"], "1.00").status_code == 409


def test_cancel_is_blocked_while_payments_are_applied(org: Org) -> None:
    cid = org.customer()
    inv, pay = org.invoice(cid), org.payment()
    aid = org.allocate(pay["id"], inv["id"], "100.00").json()["allocations"][0]["id"]
    blocked = org.post(f"/invoices/{inv['id']}/cancel", {"reason": "Raised in error"})
    assert blocked.status_code == 409 and "Void the payments" in blocked.json()["detail"]
    org.post(f"/allocations/{aid}/void", {"reason": "undo"})
    done = org.post(f"/invoices/{inv['id']}/cancel", {"reason": "Raised in error"}).json()
    assert done["status"] == "cancelled" and done["balance_due"] == "0.00" and done["cancel_reason"] == "Raised in error"
    assert org.post(f"/invoices/{inv['id']}/cancel", {"reason": "x"}).status_code == 409
    assert org.post(f"/invoices/{inv['id']}/cancel", {"reason": ""}).status_code == 422
    assert org.invoice(cid, number="X-1") and org.post("/invoices", {"customer_id": cid, "invoice_number": inv["invoice_number"], "issue_date": "2026-10-01",
        "due_date": "2026-11-01", "lines": [{"description": "x", "quantity": "1", "unit_price": "1"}]}).status_code == 201  # number is free again after cancelling


def test_manual_payment_on_an_invoice_is_unverified_and_bounded(org: Org) -> None:
    cid = org.customer()
    inv = org.invoice(cid, "1200.00")
    assert org.post(f"/invoices/{inv['id']}/payments", {"amount": "999999.00"}).status_code == 422
    r = org.post(f"/invoices/{inv['id']}/payments", {"amount": "500.00", "method": "wire", "reference": "W-1"})
    assert r.status_code == 201 and r.json()["verification_level"] == "manual" and r.json()["status"] == "partially_allocated" or r.json()["status"] == "fully_allocated"
    assert org.get(f"/invoices/{inv['id']}").json()["amount_paid"] == "500.00"


def test_payment_list_tabs_review_and_search(org: Org) -> None:
    cid = org.customer()
    inv = org.invoice(cid, "100.00")
    p1, p2 = org.payment("100.00", reference="ACH 1"), org.payment("50.00", reference="ACH 2")
    org.allocate(p1["id"], inv["id"], "100.00")
    ids = lambda q: [x["number"] for x in org.get(f"/payments?{q}&sort=number&desc=false").json()["data"]]  # noqa: E731
    assert ids("tab=allocated") == [p1["number"]] and ids("tab=unallocated") == [p2["number"]] and ids("q=ach 2") == [p2["number"]]
    assert org.post(f"/payments/{p2['id']}/review", {"under_review": True}).json()["under_review"] is True
    assert ids("tab=review") == [p2["number"]]


def test_two_parallel_allocations_cannot_overspend_a_payment(org: Org) -> None:
    from concurrent.futures import ThreadPoolExecutor

    cid = org.customer()
    invs = [org.invoice(cid, "600.00", number=f"P-{i}") for i in range(2)]
    pay = org.payment("1000.00")
    with ThreadPoolExecutor(2) as pool:
        codes = sorted(f.result().status_code for f in [pool.submit(org.allocate, pay["id"], i["id"], "600.00") for i in invs])
    assert codes == [201, 422]  # exactly one wins
    p = org.get(f"/payments/{pay['id']}").json()
    assert D(p["allocated_amount"]) <= D("1000.00") and D(p["allocated_amount"]) == D("600.00")


# ------------------------------------------------------------------- permissions, tenancy and the database
def test_ar_defaults_and_removed_permission(org: Org, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    cid = org.customer()
    ar = join_as_ar(client, auth, mail, org.owner, org.id)
    h = auth(ar, org=org.id)
    assert client.get("/api/v1/customers", headers=h).status_code == 200
    assert client.post("/api/v1/customers", json={"name": "By AR"}, headers=h).status_code == 201
    perms = {r["key"] for r in org.get("/roles/ar/permissions").json()["data"] if r["granted"]} - {"invoices.manage"}
    assert org.c.put("/api/v1/roles/ar/permissions", json={"permissions": sorted(perms)}, headers=org.h).status_code == 204
    r = client.post("/api/v1/invoices", json={"customer_id": cid, "issue_date": "2026-10-01", "due_date": "2026-11-01", "lines": [{"description": "x", "quantity": "1", "unit_price": "5"}]}, headers=h)
    assert r.status_code == 403 and r.json()["code"] == "permission_denied"
    assert client.get("/api/v1/invoices", headers=h).status_code == 200  # viewing stays on


def test_other_organizations_see_nothing(org: Org, client: TestClient, auth: Token) -> None:  # noqa: F811
    cid = org.customer("Secret Customer")
    inv, pay = org.invoice(cid), org.payment()
    other = Org(client, auth, "Rival")
    assert other.get("/customers").json()["total"] == 0 and other.get("/invoices").json()["total"] == 0 and other.get("/payments").json()["total"] == 0
    for path in (f"/customers/{cid}", f"/invoices/{inv['id']}", f"/payments/{pay['id']}"):
        assert other.get(path).status_code == 404
    assert other.allocate(pay["id"], inv["id"], "10.00").status_code == 404
    assert other.post(f"/invoices/{inv['id']}/cancel", {"reason": "x"}).status_code == 404


def test_database_refuses_inconsistent_totals_even_if_the_app_is_wrong(org: Org, migrated: str) -> None:
    cid = org.customer()
    inv, pay = org.invoice(cid, "1000.00"), org.payment("1000.00")
    org.allocate(pay["id"], inv["id"], "400.00")
    eng = create_engine(migrated)
    with eng.connect() as c, pytest.raises(DBAPIError):  # amount_paid edited without an allocation behind it
        c.execute(text("update invoices set amount_paid = 999, balance_due = 1 where id = :i"), {"i": inv["id"]})
        c.commit()
    with eng.connect() as c, pytest.raises(DBAPIError):  # balance that does not follow the formula
        c.execute(text("update invoices set balance_due = 5 where id = :i"), {"i": inv["id"]})
        c.commit()
    with eng.connect() as c, pytest.raises(DBAPIError):  # more allocated than the payment holds
        c.execute(text("update payments set allocated_amount = 2000 where id = :p"), {"p": pay["id"]})
        c.commit()
    assert org.get(f"/invoices/{inv['id']}").json()["balance_due"] == "600.00"
