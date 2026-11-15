from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.core import clock
from app.core.mailer import LogMailer
from app.services.collections import check_text
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401
from tests.test_ledger_api import Org, fixed_today, org  # noqa: F401
from tests.test_team import join_as_ar, mail  # noqa: F401


def ar_headers(client: TestClient, auth: Token, mail: LogMailer, o: Org) -> dict[str, str]:  # noqa: F811
    return auth(join_as_ar(client, auth, mail, o.owner, o.id), org=o.id)


def overdue(o: Org, name: str = "Northwind Labs", number: str = "C-1", amount: str = "4300.00", **cust: object) -> tuple[str, dict]:  # type: ignore[type-arg]
    c = o.customer(name, **cust)
    return c, o.invoice(c, amount, due="2026-11-01", number=number)


def cases(o: Org, flt: str = "all") -> list[dict]:  # type: ignore[type-arg]
    return o.get(f"/collections?filter={flt}").json()["data"]  # type: ignore[no-any-return]


# ----------------------------------------------------------------------------------------- notifications and tasks
def test_requesting_an_approval_notifies_deciders_once_and_the_decision_notifies_the_requester(org: Org, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    _, inv = overdue(org)
    ar = ar_headers(client, auth, mail, org)
    made = client.post("/api/v1/approvals", json={"type": "write_off", "invoice_id": inv["id"], "amount": "10.00", "reason": "x"}, headers=ar).json()
    n = org.get("/notifications").json()
    assert n["unread"] == 1 and n["data"][0]["title"].startswith("Approval requested") and n["data"][0]["link"] == f"/app/approvals/{made['id']}"
    assert client.get("/api/v1/notifications", headers=ar).json()["total"] == 0  # the requester is not told about their own request
    assert org.post(f"/approvals/{made['id']}/decision", {"decision": "approve"}).status_code == 200
    mine = client.get("/api/v1/notifications", headers=ar).json()
    assert mine["unread"] == 1 and "was approved" in mine["data"][0]["title"]
    assert org.post("/notifications/read", {}).json()["marked"] == 1
    assert org.get("/notifications?unread=true").json()["total"] == 0 and org.get("/notifications").json()["total"] == 1
    assert client.post("/api/v1/notifications/read", json={"ids": [mine["data"][0]["id"]]}, headers=ar).json()["marked"] == 1


def test_tasks_can_be_added_and_ticked_and_need_a_title(org: Org) -> None:
    assert org.post("/tasks", {"title": " "}).status_code == 422
    t = org.post("/tasks", {"title": "Call Northwind", "due_date": "2026-11-16"})
    assert t.status_code == 201 and t.json()["done"] is False
    assert org.post(f"/tasks/{t.json()['id']}/toggle").json()["done"] is True
    assert org.post(f"/tasks/{t.json()['id']}/toggle").json()["done"] is False
    assert [x["title"] for x in org.get("/tasks").json()["data"]] == ["Call Northwind"]


# ----------------------------------------------------------------------------------------------------- collections
def test_queue_opens_one_case_per_customer_with_overdue_invoices_and_explains_priority(org: Org) -> None:
    c, i1 = overdue(org, number="C-1", amount="4300.00")
    org.invoice(c, "700.00", due="2026-10-20", number="C-2")
    org.invoice(org.customer("Meridian"), "9000.00", due="2026-12-30", number="C-3")  # not overdue: no case
    q = cases(org)
    assert len(q) == 1 and q[0]["customer"] == "Northwind Labs" and q[0]["overdue_invoices"] == 2 and q[0]["balance"] == "5000.0000" and q[0]["days_late"] == 26 and q[0]["number"] == "COL-0001"
    d = org.get(f"/collections/{q[0]['id']}").json()
    assert "weighted by 26 days" in d["priority_note"] and [i["number"] for i in d["invoices"]] == ["C-2", "C-1"]
    assert len(cases(org, "due_today")) == 1 and cases(org, "final_notice") == []
    p = org.payment("4300.00")
    org.allocate(p["id"], i1["id"], "4300.00")
    assert cases(org)[0]["balance"] == "700.0000"


def test_a_message_may_only_state_facts_from_the_case(org: Org) -> None:
    overdue(org)
    cid = cases(org)[0]["id"]
    dr = org.post(f"/collections/{cid}/drafts", {"tone": "firm"}).json()
    assert "C-1" in dr["body"] and "4,300.00" in dr["body"] and "1 Nov 2026" in dr["body"] and dr["facts_checked"] is True
    ok = org.post(f"/collections/{cid}/send", {"subject": dr["subject"], "body": dr["body"], "mode": "mark_sent"})
    assert ok.status_code == 200
    for bad, value in (("You owe 4,999.00 in total.", "4,999.00"), ("About invoice C-99.", "C-99"), ("Due on 9 Sep 2026.", "9 Sep 2026")):
        r = org.post(f"/collections/{cid}/send", {"subject": "Hello", "body": bad, "mode": "mark_sent"})
        assert r.status_code == 422 and r.json()["code"] == "ungrounded_text" and value in r.json()["detail"]
    assert check_text("Pay 4,300.00 for C-1 due 1 Nov 2026", {"amounts": {"4,300.00"}, "numbers": {"C-1"}, "dates": {"1 Nov 2026"}}) is None


def test_send_moves_the_stage_sets_the_next_date_and_needs_a_recipient_for_email(org: Org, mail: LogMailer) -> None:
    overdue(org, contact_email="ap@northwind.example")
    overdue(org, "No Email Co", "C-9", "100.00")
    q = {c["customer"]: c for c in cases(org)}
    cid = q["Northwind Labs"]["id"]
    dr = org.post(f"/collections/{cid}/drafts", {"tone": "friendly"}).json()
    sent = org.post(f"/collections/{cid}/send", {"subject": dr["subject"], "body": dr["body"], "mode": "email"})
    assert sent.status_code == 200 and sent.json()["stage"] == "reminder_2" and sent.json()["next_action_date"] == "2026-11-22"
    assert [m.to for m in mail.sent if m.subject == dr["subject"]] == ["ap@northwind.example"]
    assert [e["kind"] for e in sent.json()["events"]][-2:] == ["sent", "stage"]
    other = q["No Email Co"]["id"]
    d2 = org.post(f"/collections/{other}/drafts", {"tone": "friendly"}).json()
    r = org.post(f"/collections/{other}/send", {"subject": d2["subject"], "body": d2["body"], "mode": "email"})
    assert r.status_code == 422 and r.json()["code"] == "no_recipient"
    assert org.post(f"/collections/{other}/send", {"subject": d2["subject"], "body": d2["body"], "mode": "mark_sent"}).json()["events"][-2]["kind"] == "marked_sent"


def test_ar_can_draft_but_not_send_by_default(org: Org, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    overdue(org)
    cid = cases(org)[0]["id"]
    ar = ar_headers(client, auth, mail, org)
    dr = client.post(f"/api/v1/collections/{cid}/drafts", json={"tone": "friendly"}, headers=ar)
    assert dr.status_code == 200
    assert client.post(f"/api/v1/collections/{cid}/send", json={"subject": "x", "body": dr.json()["body"], "mode": "mark_sent"}, headers=ar).status_code == 403


def test_promise_to_pay_pauses_until_the_date_and_a_broken_promise_returns_the_case(org: Org) -> None:
    overdue(org)
    cid = cases(org)[0]["id"]
    assert org.post(f"/collections/{cid}/promise", {"promise_date": "2026-11-10", "promise_amount": "4300.00"}).status_code == 422  # in the past
    p = org.post(f"/collections/{cid}/promise", {"promise_date": "2026-11-20", "promise_amount": "4300.00"}).json()
    assert p["stage"] == "promise" and p["promise_date"] == "2026-11-20" and cases(org, "due_today") == [] and len(cases(org, "promise")) == 1
    clock._override = datetime(2026, 11, 25, 12, 0, tzinfo=UTC)
    try:
        c = cases(org)[0]
        assert c["stage"] == "reminder_2" and c["broken_promise"] is True and len(cases(org, "due_today")) == 1
        assert any(e["kind"] == "promise_broken" for e in org.get(f"/collections/{c['id']}").json()["events"])
        assert org.get("/notifications").json()["unread"] >= 1
    finally:
        clock._override = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)


def test_final_notice_cannot_be_sent_until_it_is_approved(org: Org, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    overdue(org)
    cid = cases(org)[0]["id"]
    ar = ar_headers(client, auth, mail, org)
    for _ in range(2):  # reminder 1 then reminder 2 are sent
        d = org.post(f"/collections/{cid}/drafts", {"tone": "firm"}).json()
        assert org.post(f"/collections/{cid}/send", {"subject": d["subject"], "body": d["body"], "mode": "mark_sent"}).status_code == 200
    d = org.post(f"/collections/{cid}/drafts", {"tone": "final"}).json()
    assert org.get(f"/collections/{cid}").json()["stage"] == "final_notice" and d["subject"].startswith("Final notice")
    blocked = org.post(f"/collections/{cid}/send", {"subject": d["subject"], "body": d["body"], "mode": "mark_sent"})
    assert blocked.status_code == 409 and blocked.json()["code"] == "approval_required"
    req = client.post(f"/api/v1/collections/{cid}/final-notice", headers=ar)
    assert req.status_code == 200 and req.json()["final_approval_id"]
    assert client.post(f"/api/v1/collections/{cid}/final-notice", headers=ar).status_code == 409  # one request at a time
    apr = org.get("/approvals?tab=pending").json()["data"][0]
    assert apr["type"] == "final_notice" and apr["amount"] == "4300.0000"
    assert org.post(f"/approvals/{apr['id']}/decision", {"decision": "approve"}).status_code == 200
    assert org.get(f"/invoices/{org.get('/invoices').json()['data'][0]['id']}").json()["balance_due"] == "4300.00"  # a final notice moves no money
    assert org.get(f"/collections/{cid}").json()["final_approved"] is True
    assert org.post(f"/collections/{cid}/send", {"subject": d["subject"], "body": d["body"], "mode": "mark_sent"}).status_code == 200
    assert org.get(f"/collections/{cid}").json()["final_approved"] is False  # the approval covers one send


def test_rejected_final_notice_goes_back_to_reminder_two(org: Org, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    overdue(org)
    cid = cases(org)[0]["id"]
    ar = ar_headers(client, auth, mail, org)
    for _ in range(2):
        d = org.post(f"/collections/{cid}/drafts", {"tone": "firm"}).json()
        org.post(f"/collections/{cid}/send", {"subject": d["subject"], "body": d["body"], "mode": "mark_sent"})
    client.post(f"/api/v1/collections/{cid}/final-notice", headers=ar)
    apr = org.get("/approvals?tab=pending").json()["data"][0]
    assert org.post(f"/approvals/{apr['id']}/decision", {"decision": "reject", "comment": "Too soon"}).status_code == 200
    assert org.get(f"/collections/{cid}").json()["stage"] == "reminder_2"


# ------------------------------------------------------------------------------------------------------- disputes
def test_a_dispute_marks_the_invoice_pauses_collections_and_resumes_on_resolution(org: Org) -> None:
    _, inv = overdue(org)
    cid = cases(org)[0]["id"]
    assert org.post("/disputes", {"invoice_id": inv["id"], "category": "pricing", "amount": "4301.00", "explanation": "Wrong rate"}).status_code == 422
    r = org.post("/disputes", {"invoice_id": inv["id"], "category": "pricing", "amount": "300.00", "explanation": "We agreed 4,000, not 4,300", "due_date": "2026-11-10"})
    assert r.status_code == 201 and r.json()["number"] == "DSP-0001" and r.json()["overdue"] is True
    assert org.get(f"/invoices/{inv['id']}").json()["status"] == "disputed" and org.get("/invoices?tab=disputed").json()["total"] == 1
    c = org.get(f"/collections/{cid}").json()
    assert c["paused_reason"] == "dispute"
    d = org.post(f"/collections/{cid}/drafts", {"tone": "friendly"}).json()
    assert org.post(f"/collections/{cid}/send", {"subject": d["subject"], "body": d["body"], "mode": "mark_sent"}).status_code == 409
    assert org.post("/disputes", {"invoice_id": inv["id"], "category": "other", "amount": "1.00", "explanation": "again"}).status_code == 409  # one open dispute per invoice
    did = r.json()["id"]
    assert org.post(f"/disputes/{did}/notes", {"text": "Asked for the contract"}).status_code == 201
    assert org.post(f"/disputes/{did}/status", {"status": "awaiting_customer"}).json()["status"] == "awaiting_customer"
    done = org.post(f"/disputes/{did}/resolve", {"outcome": "rejected", "note": "Contract confirms 4,300"})
    assert done.status_code == 200 and done.json()["status"] == "resolved"
    assert org.get(f"/invoices/{inv['id']}").json()["status"] != "disputed" and org.get(f"/collections/{cid}").json()["paused_reason"] is None
    assert org.post(f"/disputes/{did}/notes", {"text": "late"}).status_code == 409  # read-only once resolved
    assert [e["kind"] for e in done.json()["events"]] == ["opened", "note", "status", "resolved"]


def test_a_credit_outcome_closes_the_dispute_only_after_the_approval(org: Org, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    _, inv = overdue(org)
    ar = ar_headers(client, auth, mail, org)
    did = client.post("/api/v1/disputes", json={"invoice_id": inv["id"], "category": "quality", "amount": "300.00", "explanation": "Damaged goods"}, headers=ar).json()["id"]
    assert client.post(f"/api/v1/disputes/{did}/resolve", json={"outcome": "upheld", "note": "Agree"}, headers=ar).status_code == 422  # a credit amount is required
    r = client.post(f"/api/v1/disputes/{did}/resolve", json={"outcome": "upheld", "note": "Agree to credit", "credit_amount": "300.00"}, headers=ar).json()
    assert r["status"] == "awaiting_approval" and r["approval_status"] == "pending"
    assert org.get(f"/invoices/{inv['id']}").json()["balance_due"] == "4300.00"
    apr = org.get("/approvals?tab=pending").json()["data"][0]
    assert org.post(f"/approvals/{apr['id']}/decision", {"decision": "approve"}).status_code == 200
    d = org.get(f"/disputes/{did}").json()
    assert d["status"] == "resolved" and d["outcome"] == "upheld" and org.get(f"/invoices/{inv['id']}").json()["balance_due"] == "4000.00"


def test_a_rejected_credit_reopens_the_dispute(org: Org, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    _, inv = overdue(org)
    ar = ar_headers(client, auth, mail, org)
    did = client.post("/api/v1/disputes", json={"invoice_id": inv["id"], "category": "quality", "amount": "300.00", "explanation": "Damaged"}, headers=ar).json()["id"]
    client.post(f"/api/v1/disputes/{did}/resolve", json={"outcome": "partially_upheld", "note": "Half", "credit_amount": "150.00"}, headers=ar)
    apr = org.get("/approvals?tab=pending").json()["data"][0]
    org.post(f"/approvals/{apr['id']}/decision", {"decision": "reject", "comment": "No evidence"})
    d = org.get(f"/disputes/{did}").json()
    assert d["status"] == "open" and d["outcome"] is None and org.get(f"/invoices/{inv['id']}").json()["balance_due"] == "4300.00"
    assert d["events"][-1]["text"].startswith("The credit was rejected")
    assert org.get("/disputes?filter=open").json()["data"][0]["id"] == did and org.get("/disputes?filter=resolved").json()["data"] == []


def test_a_mail_provider_failure_records_nothing_and_reports_it(org: Org, client: TestClient) -> None:  # noqa: F811
    from app.core.mailer import MailError, Message, get_mailer

    class Down:
        def send(self, message: Message) -> None:
            raise MailError("down")

    overdue(org, contact_email="ap@northwind.example")
    cid = cases(org)[0]["id"]
    d = org.post(f"/collections/{cid}/drafts", {"tone": "friendly"}).json()
    client.app.dependency_overrides[get_mailer] = lambda: Down()  # type: ignore[attr-defined]
    try:
        r = org.post(f"/collections/{cid}/send", {"subject": d["subject"], "body": d["body"], "mode": "email"})
    finally:
        client.app.dependency_overrides.pop(get_mailer, None)  # type: ignore[attr-defined]
    assert r.status_code == 502 and r.json()["code"] == "email_failed"
    c = org.get(f"/collections/{cid}").json()
    assert c["stage"] == "reminder_1" and not any(e["kind"] == "sent" for e in c["events"])
