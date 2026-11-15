from fastapi.testclient import TestClient

from app.core.mailer import LogMailer
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401
from tests.test_ledger_api import Org, fixed_today, org  # noqa: F401
from tests.test_team import join_as_ar, mail  # noqa: F401


def reconcile(o: Org) -> dict:  # type: ignore[type-arg]
    r = o.post("/reconciliation/runs")
    assert r.status_code == 201, r.text
    return r.json()  # type: ignore[no-any-return]


def cases(o: Org, flt: str = "all") -> list[dict]:  # type: ignore[type-arg]
    return o.get(f"/investigations?filter={flt}").json()["data"]  # type: ignore[no-any-return]


def short_payment_case(o: Org, total: str = "5000.00", paid: str = "4900.00") -> tuple[dict, dict, dict]:  # type: ignore[type-arg]
    inv = o.invoice(o.customer("Northwind Labs"), total, number="INV-1042")
    pay = o.payment(paid, reference="INV-1042", payment_date="2026-11-01")  # eight days ago: past the 7 day grace period
    reconcile(o)
    return inv, pay, cases(o)[0]


def test_a_discrepancy_opens_one_case_with_cited_findings_and_a_recommendation(org: Org) -> None:
    inv, pay, case = short_payment_case(org)
    assert case["type"] == "short_payment" and case["number"] == "INVG-0001" and case["invoice_number"] == "INV-1042"
    d = org.get(f"/investigations/{case['id']}").json()
    assert d["analysis"]["version"] == 1 and d["analysis"]["status"] == "completed" and d["status"] == "ready_for_review"
    kinds = [f["kind"] for f in d["analysis"]["findings"]]
    assert kinds[:3] == ["confirmed", "calculated", "possible"] and d["analysis"]["recommendation"]["action"] == "request_write_off"
    assert d["analysis"]["recommendation"]["gate"] == "approval" and d["analysis"]["recommendation"]["amount"] == "100.0000"
    assert all(f["cites"] for f in d["analysis"]["findings"] if f["kind"] in ("confirmed", "calculated"))
    assert {e["type"] for e in d["evidence"]} == {"invoice", "payment"}
    assert len(cases(org)) == 1
    reconcile(org)
    assert len(cases(org)) == 1  # running again does not open a second case for the same discrepancy


def test_rerun_keeps_every_version_and_goes_stale_when_records_change(org: Org) -> None:
    inv, pay, case = short_payment_case(org)
    assert org.get(f"/investigations/{case['id']}").json()["analysis"]["stale"] is False
    assert org.allocate(pay["id"], inv["id"], "4900.00").status_code == 201  # the books move after the analysis
    d = org.get(f"/investigations/{case['id']}").json()
    assert d["analysis"]["stale"] is True
    assert org.post(f"/investigations/{case['id']}/analysis").status_code == 200
    assert org.post(f"/investigations/{case['id']}/analysis").status_code == 200
    d = org.get(f"/investigations/{case['id']}").json()
    assert [v["version"] for v in d["versions"]] == [3, 2, 1] and d["analysis"]["stale"] is False


def test_large_shortfall_needs_evidence_before_a_recommendation(org: Org) -> None:
    _, _, case = short_payment_case(org, "5000.00", "4000.00")
    d = org.get(f"/investigations/{case['id']}").json()
    assert d["analysis"]["status"] == "insufficient_evidence" and d["analysis"]["recommendation"] is None and d["status"] == "new"
    again = org.post(f"/investigations/{case['id']}/analysis")
    assert again.status_code == 409 and again.json()["code"] == "insufficient_evidence"  # nothing changed, so no new version
    assert org.post(f"/investigations/{case['id']}/evidence", {"type": "document", "label": "Remittance advice.pdf", "tier": "bank"}).status_code == 201
    assert org.get(f"/investigations/{case['id']}").json()["analysis"]["stale"] is True
    d = org.post(f"/investigations/{case['id']}/analysis").json()
    assert d["analysis"]["status"] == "completed" and d["analysis"]["recommendation"]["action"] == "monitor" and d["analysis"]["version"] == 2


def test_status_assignee_priority_notes_and_versions(org: Org) -> None:
    _, _, case = short_payment_case(org)
    cid = case["id"]
    v = org.get(f"/investigations/{cid}").json()["version"]
    r = org.c.patch(f"/api/v1/investigations/{cid}", json={"status": "in_progress", "priority": "critical"}, headers={**org.h, "If-Match": str(v)})
    assert r.status_code == 200 and r.json()["status"] == "in_progress" and r.json()["priority_overridden"] is True
    stale = org.c.patch(f"/api/v1/investigations/{cid}", json={"status": "monitoring"}, headers={**org.h, "If-Match": str(v)})
    assert stale.status_code == 409 and stale.json()["code"] == "version_conflict"
    me = org.get("/me").json()["id"]
    assert org.c.patch(f"/api/v1/investigations/{cid}", json={"assignee_id": me}, headers=org.h).json()["assignee_id"] == me
    assert len(cases(org, "mine")) == 1
    assert org.post(f"/investigations/{cid}/notes", {"text": "Called the customer"}).status_code == 201
    assert org.c.patch(f"/api/v1/investigations/{cid}", json={"assignee_id": "00000000-0000-0000-0000-000000000001"}, headers=org.h).status_code == 422
    kinds = [e["kind"] for e in org.get(f"/investigations/{cid}").json()["events"]]
    assert kinds[0] == "opened" and {"status", "priority", "assign", "note"} <= set(kinds)


def test_recommended_action_goes_through_approvals_and_cannot_be_self_approved(org: Org) -> None:
    inv, _, case = short_payment_case(org)
    r = org.post(f"/investigations/{case['id']}/actions", {"action": "request_write_off"})
    assert r.status_code == 200 and r.json()["status"] == "awaiting_approval" and r.json()["approval_status"] == "pending"
    apr = org.get("/approvals?tab=pending").json()["data"]
    assert len(apr) == 1 and apr[0]["type"] == "write_off" and apr[0]["amount"] == "100.0000"
    assert org.post(f"/approvals/{apr[0]['id']}/decision", {"decision": "approve"}).status_code == 403
    assert org.get(f"/invoices/{inv['id']}").json()["balance_due"] == "5000.00"  # nothing moved
    assert org.post(f"/investigations/{case['id']}/actions", {"action": "delete_everything"}).status_code == 422  # not in the catalog


def test_resolve_records_verified_balance_and_dismiss_needs_a_reason_and_closes(org: Org) -> None:
    inv, pay, case = short_payment_case(org)
    cid = case["id"]
    org.allocate(pay["id"], inv["id"], "4900.00")
    assert org.post(f"/investigations/{cid}/dismiss", {"reason": " "}).status_code == 422
    done = org.post(f"/investigations/{cid}/resolve", {"outcome": "Customer paid the rest"})
    assert done.status_code == 200 and done.json()["status"] == "resolved" and "Verified from records: INV-1042 balance is 100.00 USD" in done.json()["resolution"]
    assert org.post(f"/investigations/{cid}/notes", {"text": "late"}).status_code == 201  # notes stay possible
    assert org.post(f"/investigations/{cid}/dismiss", {"reason": "x"}).status_code == 409  # closed cases are read-only
    assert org.c.patch(f"/api/v1/investigations/{cid}", json={"status": "new"}, headers=org.h).status_code == 409


def test_dismissing_resolves_the_discrepancy_and_manual_cases_work(org: Org) -> None:
    inv, _, case = short_payment_case(org)
    assert org.post(f"/investigations/{case['id']}/dismiss", {"reason": "Known fee"}).status_code == 200
    assert org.get("/reconciliation/discrepancies?status=open").json()["total"] == 0
    other = org.invoice(org.customer("Meridian"), "300.00", number="INV-2000")
    made = org.post("/investigations", {"invoice_id": other["id"], "title": "Customer says they paid"})
    assert made.status_code == 201 and made.json()["type"] == "manual" and made.json()["title"] == "Customer says they paid" and made.json()["analysis"]["version"] == 1
    assert org.post("/investigations", {}).status_code == 422


def test_duplicate_payment_case_and_permissions(org: Org, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    c = org.customer("Northwind Labs")
    org.payment("900.00", reference="ACH 7788", payer_name_raw="Northwind Labs", customer_id=c)
    org.payment("900.00", reference="ACH 7788", payer_name_raw="Northwind Labs", customer_id=c)
    reconcile(org)
    dup = next(x for x in cases(org) if x["type"] == "duplicate_payment")
    d = org.get(f"/investigations/{dup['id']}").json()
    assert sum(f["kind"] == "confirmed" for f in d["analysis"]["findings"]) == 2
    ar = auth(join_as_ar(client, auth, mail, org.owner, org.id), org=org.id)
    assert client.get("/api/v1/investigations", headers=ar).status_code == 200
    assert client.get(f"/api/v1/investigations/{dup['id']}", headers=ar).status_code == 200
    me = org.get("/me").json()["id"]
    assert client.patch(f"/api/v1/investigations/{dup['id']}", json={"assignee_id": me}, headers=ar).status_code == 200  # on by default
    perms = {r["key"] for r in org.get("/roles/ar/permissions").json()["data"] if r["granted"]} - {"investigations.assign"}
    assert org.c.put("/api/v1/roles/ar/permissions", json={"permissions": sorted(perms)}, headers=org.h).status_code == 204
    assert client.patch(f"/api/v1/investigations/{dup['id']}", json={"assignee_id": me}, headers=ar).status_code == 403
    assert client.patch(f"/api/v1/investigations/{dup['id']}", json={"priority": "high"}, headers=ar).status_code == 200  # other changes stay allowed
