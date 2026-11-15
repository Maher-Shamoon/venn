from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError

from app.core import clock
from app.core.mailer import LogMailer
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401
from tests.test_ledger_api import Org, fixed_today, org  # noqa: F401
from tests.test_team import join_as_ar, mail  # noqa: F401


def request(o: Org, invoice: str, kind: str = "write_off", amount: str = "50.00", **kw: object):  # type: ignore[no-untyped-def]
    return o.post("/approvals", {"type": kind, "invoice_id": invoice, "amount": amount, "reason": "Customer short-paid on purpose", **kw})


def balance(o: Org, invoice: str) -> str:
    return str(o.get(f"/invoices/{invoice}").json()["balance_due"])


def ar_headers(client: TestClient, auth: Token, mail: LogMailer, o: Org) -> dict[str, str]:  # noqa: F811
    return auth(join_as_ar(client, auth, mail, o.owner, o.id), org=o.id)


def test_approved_write_off_reduces_the_balance_and_is_audited(org: Org, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    i = org.invoice(org.customer(), "700.00")
    ar = ar_headers(client, auth, mail, org)
    made = client.post("/api/v1/approvals", json={"type": "write_off", "invoice_id": i["id"], "amount": "50.00", "reason": "Rounding"}, headers=ar)
    assert made.status_code == 201 and made.json()["status"] == "pending" and made.json()["number"] == "APR-0001"
    assert balance(org, i["id"]) == "700.00"  # nothing moves until someone approves
    rid = made.json()["id"]
    d = org.post(f"/approvals/{rid}/decision", {"decision": "approve", "comment": "ok"})
    assert d.status_code == 200 and d.json()["status"] == "approved" and d.json()["impact"]["balance_now"] == "650.0000"
    assert balance(org, i["id"]) == "650.00"
    assert org.get(f"/invoices/{i['id']}").json()["amount_adjusted"] == "50.00"
    assert {"approval.requested", "approval.approve", "adjustment.executed"} <= {e["action"] for e in org.get("/audit-events?limit=50").json()["data"]}


def test_nobody_approves_their_own_request_and_decisions_are_final(org: Org) -> None:
    i = org.invoice(org.customer(), "700.00")
    rid = request(org, i["id"]).json()["id"]
    own = org.post(f"/approvals/{rid}/decision", {"decision": "approve"})
    assert own.status_code == 403 and own.json()["code"] == "permission_denied"
    assert balance(org, i["id"]) == "700.00"


def test_reject_and_request_info_need_words_and_a_decision_cannot_change(org: Org, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    i = org.invoice(org.customer(), "700.00")
    ar = ar_headers(client, auth, mail, org)
    rid = client.post("/api/v1/approvals", json={"type": "credit", "invoice_id": i["id"], "amount": "20.00", "reason": "Damaged goods"}, headers=ar).json()["id"]
    assert org.post(f"/approvals/{rid}/decision", {"decision": "reject", "comment": " "}).status_code == 422
    assert org.post(f"/approvals/{rid}/decision", {"decision": "request_info"}).status_code == 422
    assert org.post(f"/approvals/{rid}/decision", {"decision": "request_info", "comment": "Which delivery?"}).json()["status"] == "info_requested"
    assert client.post(f"/api/v1/approvals/{rid}/reply", json={"comment": "Delivery 12"}, headers=ar).json()["status"] == "pending"
    assert org.post(f"/approvals/{rid}/decision", {"decision": "reject", "comment": "Not enough proof"}).json()["status"] == "rejected"
    again = org.post(f"/approvals/{rid}/decision", {"decision": "approve"})
    assert again.status_code == 409 and balance(org, i["id"]) == "700.00"
    steps = [d["decision"] for d in org.get(f"/approvals/{rid}").json()["decisions"]]
    assert steps == ["request_info", "reply", "reject"]


def test_approval_goes_stale_when_the_balance_moves_unless_reconfirmed(org: Org, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    c = org.customer()
    i = org.invoice(c, "700.00")
    ar = ar_headers(client, auth, mail, org)
    rid = client.post("/api/v1/approvals", json={"type": "write_off", "invoice_id": i["id"], "amount": "50.00", "reason": "Small"}, headers=ar).json()["id"]
    p = org.payment("100.00")
    assert org.allocate(p["id"], i["id"], "100.00").status_code == 201
    assert org.get(f"/approvals/{rid}").json()["impact"]["stale"] is True
    r = org.post(f"/approvals/{rid}/decision", {"decision": "approve"})
    assert r.status_code == 409 and r.json()["code"] == "approval_stale" and balance(org, i["id"]) == "600.00"
    assert org.post(f"/approvals/{rid}/decision", {"decision": "approve", "confirm_stale": True}).status_code == 200
    assert balance(org, i["id"]) == "550.00"


def test_amount_rules_and_duplicates(org: Org) -> None:
    i = org.invoice(org.customer(), "100.00")
    assert request(org, i["id"], amount="100.01").status_code == 422
    assert request(org, i["id"], amount="0").status_code == 422
    assert request(org, i["id"], "refund_due", "1.00").status_code == 422  # nothing has been paid
    assert request(org, i["id"]).status_code == 201
    assert request(org, i["id"]).status_code == 409  # one open request per kind


def test_refund_due_is_recorded_without_touching_the_balance(org: Org, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    i = org.invoice(org.customer(), "300.00")
    p = org.payment("300.00")
    org.allocate(p["id"], i["id"], "300.00")
    ar = ar_headers(client, auth, mail, org)
    rid = client.post("/api/v1/approvals", json={"type": "refund_due", "invoice_id": i["id"], "amount": "40.00", "reason": "Customer paid twice"}, headers=ar).json()["id"]
    d = org.post(f"/approvals/{rid}/decision", {"decision": "approve"})
    assert d.status_code == 200 and d.json()["impact"]["affects_balance"] is False
    assert balance(org, i["id"]) == "0.00" and org.get(f"/invoices/{i['id']}").json()["amount_adjusted"] == "0.00"


def test_withdraw_expiry_and_visibility(org: Org, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    c = org.customer()
    a, b = org.invoice(c, "100.00"), org.invoice(c, "200.00")
    ar = ar_headers(client, auth, mail, org)
    mine = client.post("/api/v1/approvals", json={"type": "write_off", "invoice_id": a["id"], "amount": "5.00", "reason": "x"}, headers=ar).json()["id"]
    theirs = request(org, b["id"], amount="5.00").json()["id"]
    assert client.get(f"/api/v1/approvals/{theirs}", headers=ar).status_code == 404  # a requester sees only their own
    assert client.post(f"/api/v1/approvals/{mine}/decision", json={"decision": "approve"}, headers=ar).status_code == 403  # AR has no approvals.decide
    assert [x["id"] for x in client.get("/api/v1/approvals?tab=mine", headers=ar).json()["data"]] == [mine]
    assert client.post(f"/api/v1/approvals/{mine}/withdraw", headers=ar).json()["status"] == "withdrawn"
    clock._override = datetime(2026, 12, 20, 12, 0, tzinfo=UTC)  # more than 30 days after the fixed "today"
    try:
        assert org.get(f"/approvals/{theirs}").json()["status"] == "expired"
        late = org.post(f"/approvals/{theirs}/decision", {"decision": "approve"})
        assert late.status_code == 409 and balance(org, b["id"]) == "200.00"
    finally:
        clock._override = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)
    assert org.get("/approvals?tab=decided").json()["total"] == 2


def test_policy_auto_approves_small_requests_but_never_refunds(org: Org) -> None:
    assert org.c.put("/api/v1/settings/approval-policies", json={"type": "write_off", "auto_approve_below": "25.00", "expiry_days": 14}, headers=org.h).status_code == 200
    assert org.c.put("/api/v1/settings/approval-policies", json={"type": "refund_due", "auto_approve_below": "25.00", "expiry_days": 14}, headers=org.h).status_code == 422
    i = org.invoice(org.customer(), "100.00")
    small = request(org, i["id"], amount="20.00").json()
    assert small["status"] == "approved" and balance(org, i["id"]) == "80.00"
    big = request(org, i["id"], "credit", "30.00").json()
    assert big["status"] == "pending"
    pol = {p["type"]: p for p in org.get("/settings/approval-policies").json()["data"]}
    assert pol["write_off"]["expiry_days"] == 14 and pol["credit"]["expiry_days"] == 30


def test_database_refuses_edits_to_history_and_inconsistent_adjustments(org: Org, client: TestClient, auth: Token, mail: LogMailer, migrated: str) -> None:  # noqa: F811
    i = org.invoice(org.customer(), "100.00")
    ar = ar_headers(client, auth, mail, org)
    rid = client.post("/api/v1/approvals", json={"type": "write_off", "invoice_id": i["id"], "amount": "10.00", "reason": "x"}, headers=ar).json()["id"]
    assert org.post(f"/approvals/{rid}/decision", {"decision": "approve"}).status_code == 200
    eng = create_engine(migrated)
    for sql in ("update approval_decisions set comment = 'edited'", "delete from approval_decisions", "update adjustments set amount = 1", "delete from adjustments"):
        with eng.connect() as c, pytest.raises(DBAPIError, match="append-only"):
            c.execute(text(sql))
            c.commit()
    with eng.connect() as c, pytest.raises(DBAPIError, match="amount_adjusted"):  # adjusted amount edited without an adjustment behind it
        c.execute(text("update invoices set amount_adjusted = amount_adjusted + 5, balance_due = balance_due - 5 where id = :i"), {"i": i["id"]})
        c.commit()
    assert balance(org, i["id"]) == "90.00"
