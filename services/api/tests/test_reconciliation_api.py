
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401
from tests.test_ledger_api import Org, fixed_today, org  # noqa: F401


def run(o: Org) -> dict:  # type: ignore[type-arg]
    r = o.post("/reconciliation/runs")
    assert r.status_code == 201, r.text
    return r.json()  # type: ignore[no-any-return]


def test_exact_match_is_applied_automatically_and_can_be_undone(org: Org) -> None:
    c = org.customer("Northwind Labs")
    i = org.invoice(c, "1000.00", number="INV-9001")
    p = org.payment("1000.00", reference="ACH INV-9001")
    assert run(org)["auto_applied"] == 1
    assert org.get(f"/invoices/{i['id']}").json()["balance_due"] == "0.00"
    auto = org.get("/reconciliation/auto-applied").json()
    assert auto["total"] == 1 and auto["data"][0]["invoice_number"] == "INV-9001"
    assert org.post(f"/allocations/{auto['data'][0]['id']}/void", {"reason": "Wrong invoice"}).status_code == 200
    assert org.get(f"/invoices/{i['id']}").json()["balance_due"] == "1000.00"
    assert org.get(f"/payments/{p['id']}").json()["unallocated_amount"] == "1000.00"
    assert org.get("/reconciliation/auto-applied").json()["total"] == 0


def test_auto_apply_off_leaves_a_suggestion_to_accept(org: Org) -> None:
    assert org.c.patch("/api/v1/settings/financial", json={"auto_apply_exact": False}, headers=org.h).status_code == 200
    c = org.customer("Northwind Labs")
    i = org.invoice(c, "1000.00", number="INV-9002")
    org.payment("1000.00", reference="INV-9002")
    out = run(org)
    assert out["auto_applied"] == 0 and out["suggested"] == 1
    s = org.get("/reconciliation/suggestions").json()["data"][0]
    assert s["rule"] == "R1" and s["allocations"][0]["invoice_number"] == "INV-9002"
    assert org.post(f"/reconciliation/suggestions/{s['id']}/accept").status_code == 200
    assert org.get(f"/invoices/{i['id']}").json()["balance_due"] == "0.00"
    assert org.post(f"/reconciliation/suggestions/{s['id']}/accept").status_code == 409  # cannot decide twice
    assert [a["method"] for a in org.get(f"/invoices/{i['id']}").json()["allocations"]] == ["suggestion_confirmed"]


def test_rejected_suggestion_does_not_come_back_and_reason_is_required(org: Org) -> None:
    c = org.customer("Northwind Labs", payer_aliases=["NW HOLDINGS"])
    org.invoice(c, "500.00", number="INV-9003")
    org.payment("500.00", payer_name_raw="NW Holdings")
    run(org)
    s = org.get("/reconciliation/suggestions").json()["data"][0]
    assert s["rule"] == "R5"
    assert org.post(f"/reconciliation/suggestions/{s['id']}/reject", {"reason": ""}).status_code == 422
    assert org.post(f"/reconciliation/suggestions/{s['id']}/reject", {"reason": "Different job"}).status_code == 200
    assert run(org)["suggested"] == 0 and org.get("/reconciliation/suggestions").json()["total"] == 0


def test_suggestion_goes_stale_when_balances_move(org: Org) -> None:
    c = org.customer("Northwind Labs")
    i = org.invoice(c, "1000.00", number="INV-9004")
    org.payment("400.00", reference="INV-9004")
    other = org.payment("700.00", reference="elsewhere")
    run(org)
    s = org.get("/reconciliation/suggestions").json()["data"][0]
    assert s["rule"] == "R2"
    assert org.allocate(other["id"], i["id"], "700.00").status_code == 201  # someone pays it off first
    r = org.post(f"/reconciliation/suggestions/{s['id']}/accept")
    assert r.status_code == 409 and r.json()["code"] == "stale"
    assert org.get("/reconciliation/suggestions").json()["total"] == 0


def test_discrepancies_duplicate_overpayment_and_resolution(org: Org) -> None:
    c = org.customer("Northwind Labs")
    org.invoice(c, "1000.00", number="INV-9005")
    org.payment("1200.00", reference="INV-9005")
    org.payment("1200.00", reference="INV-9005")
    out = run(org)
    assert out["auto_applied"] == 0
    d = org.get("/reconciliation/discrepancies").json()
    kinds = {x["type"] for x in d["data"]}
    assert {"overpayment", "duplicate_payment"} <= kinds
    assert org.get("/payments?tab=duplicate").json()["total"] >= 1
    first = d["data"][0]
    assert org.post(f"/reconciliation/discrepancies/{first['id']}/resolve", {"reason": ""}).status_code == 422
    assert org.post(f"/reconciliation/discrepancies/{first['id']}/resolve", {"reason": "Checked with the customer"}).status_code == 200
    assert org.get("/reconciliation/discrepancies?status=resolved").json()["total"] == 1


def test_rerunning_is_idempotent_and_permissions_apply(org: Org, client, auth) -> None:  # type: ignore[no-untyped-def]  # noqa: F811
    c = org.customer("Northwind Labs")
    org.invoice(c, "300.00", number="INV-9006")
    org.payment("100.00", reference="INV-9006")
    run(org)
    run(org)
    assert org.get("/reconciliation/suggestions").json()["total"] == 1
    assert len(org.get("/reconciliation/runs").json()["data"]) == 2
    assert client.post("/api/v1/reconciliation/runs", headers={**org.h, "Authorization": "Bearer nope"}).status_code == 401
