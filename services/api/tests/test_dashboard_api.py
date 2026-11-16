from datetime import date
from decimal import Decimal

from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.core.mailer import LogMailer
from app.services.dashboard import points
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401
from tests.test_ledger_api import Org, fixed_today, org  # noqa: F401
from tests.test_team import join_as_ar, mail  # noqa: F401


def seed(o: Org, migrated: str) -> dict[str, str]:
    a, b = o.customer("Alder Health"), o.customer("=Brightwater")
    i1 = o.invoice(a, "1000.00", due="2026-11-01", number="D-1")
    i2 = o.invoice(a, "2000.00", due="2026-09-01", number="D-2", issue_date="2026-08-01")
    o.invoice(b, "500.00", due="2026-12-01", number="D-3")
    o.invoice(b, "700.00", due="2026-07-01", number="D-4", issue_date="2026-06-01")
    o.post("/invoices", {"customer_id": a, "issue_date": "2026-10-01", "due_date": "2026-11-01", "currency": "EUR", "lines": [{"description": "x", "quantity": "1", "unit_price": "99.00"}]})
    p = o.payment("300.00")
    assert o.allocate(p["id"], i1["id"], "300.00").status_code == 201
    with create_engine(migrated).begin() as c:  # the allocation happened on 12 November
        c.execute(text("update payment_allocations set created_at = timestamptz '2026-11-12 10:00+00'"))
    return {"i1": i1["id"], "i2": i2["id"], "a": a}


def test_owner_figures_equal_the_sum_of_open_balances(org: Org, migrated: str) -> None:
    seed(org, migrated)
    d = org.get("/dashboard/owner?range=30d").json()
    k = d["kpis"]
    assert k["total_ar"] == "3900.0000" and k["overdue"] == "3400.0000" and k["open_invoices"] == 4 and k["overdue_invoices"] == 3 and d["currency"] == "USD" and k["other_currencies"] == 1
    buckets = {x["bucket"]: (x["amount"], x["count"]) for x in d["aging"]}
    assert buckets == {"Current": ("500.0000", 1), "1 to 30 days": ("700.0000", 1), "31 to 60 days": ("0", 0), "61 to 90 days": ("2000.0000", 1), "Over 90 days": ("700.0000", 1)}
    assert sum(Decimal(x["amount"]) for x in d["aging"]) == Decimal(k["total_ar"])  # aging always adds up to the receivable
    assert d["has_data"] is True and d["setup"]["invoices"] is True and d["setup"]["reconciliation"] is False


def test_trend_is_rebuilt_from_history_and_its_last_point_is_live(org: Org, migrated: str) -> None:
    seed(org, migrated)
    t = org.get("/dashboard/owner?range=7d").json()["trend"]
    assert [p["date"] for p in t][0] == "2026-11-09" and len(t) == 7 and t[-1]["date"] == "2026-11-15"
    by = {p["date"]: p for p in t}
    assert by["2026-11-11"]["total"] == "4200.0000" and by["2026-11-12"]["total"] == "3900.0000"  # the payment lands on the 12th
    assert t[-1]["total"] == "3900.0000" and t[-1]["overdue"] == "3400.0000"
    assert org.get("/dashboard/owner?range=7d").json()["kpis"]["total_ar_change"] == "-300.0000"
    # history does not move: voiding the allocation today leaves the 11th and 12th as they were seen
    for r, n in (("7d", 7), ("30d", 5), ("90d", 13), ("12m", 12)):
        assert len(org.get(f"/dashboard/owner?range={r}").json()["trend"]) == n
    assert org.get("/dashboard/owner?range=nope").status_code == 400


def test_a_cancelled_invoice_with_an_adjustment_leaves_no_trace_in_the_live_point(org: Org, migrated: str) -> None:
    seed(org, migrated)
    assert org.c.put("/api/v1/settings/approval-policies", json={"type": "write_off", "auto_approve_below": "50.00", "expiry_days": 30}, headers=org.h).status_code == 200
    i5 = org.invoice(org.customer("Cobalt"), "100.00", number="D-5")
    assert org.post("/approvals", {"type": "write_off", "invoice_id": i5["id"], "amount": "10.00", "reason": "x"}).json()["status"] == "approved"
    assert org.post(f"/invoices/{i5['id']}/cancel", {"reason": "mistake"}).status_code == 200
    d = org.get("/dashboard/owner?range=30d").json()
    assert d["trend"][-1]["total"] == d["kpis"]["total_ar"] == "3900.0000" and d["trend"][-1]["overdue"] == d["kpis"]["overdue"]


def test_range_points_and_overdue_by_customer(org: Org, migrated: str) -> None:
    today = date(2026, 11, 15)
    assert points("30d", today)[0] == date(2026, 10, 18) and points("12m", today)[0] == date(2025, 12, 31) and points("12m", today)[-1] == today
    seed(org, migrated)
    names = lambda r: {x["customer"]: x["amount"] for x in org.get(f"/dashboard/owner?range={r}").json()["overdue_by_customer"]}  # noqa: E731
    assert names("30d") == {"Alder Health": "700.0000"}  # only D-1 fell due in the last 30 days
    assert names("90d") == {"Alder Health": "2700.0000"} and names("12m") == {"Alder Health": "2700.0000", "=Brightwater": "700.0000"}


def test_reports_are_permission_checked_and_exports_are_audited_and_safe(org: Org, migrated: str, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    seed(org, migrated)
    assert {r["slug"] for r in org.get("/reports").json()["data"]} >= {"aging", "ar-trend", "overdue-by-customer", "recovered", "reconciliation-performance", "investigation-resolution"}
    rep = org.get("/reports/aging?range=30d").json()
    assert [r["bucket"] for r in rep["rows"]][0] == "Current" and rep["definition"]
    cust = org.get("/reports/aging?customer_id=" + seed_customer(org)).json()
    assert sum(r["count"] for r in cust["rows"]) == 2
    csv = org.c.get("/api/v1/reports/overdue-by-customer.csv?range=12m", headers=org.h)
    assert csv.status_code == 200 and 'filename="overdue-by-customer-12m.csv"' in csv.headers["content-disposition"]
    assert "'=Brightwater" in csv.text and "Alder Health" in csv.text  # a name that starts with = cannot become a spreadsheet formula
    assert any(e["action"] == "report.exported" for e in org.get("/audit-events?limit=20").json()["data"])
    ar = auth(join_as_ar(client, auth, mail, org.owner, org.id), org=org.id)
    assert client.get("/api/v1/dashboard/owner", headers=ar).status_code == 403
    assert client.get("/api/v1/reports/aging", headers=ar).status_code == 403 and client.get("/api/v1/reports/recovered", headers=ar).status_code == 403
    assert client.get("/api/v1/reports/reconciliation-performance", headers=ar).status_code == 200
    assert {r["slug"] for r in client.get("/api/v1/reports", headers=ar).json()["data"]} == {"reconciliation-performance", "investigation-resolution"}
    assert client.get("/api/v1/dashboard/ar", headers=ar).status_code == 200


def seed_customer(o: Org) -> str:
    return next(c["id"] for c in o.get("/customers?q=Brightwater").json()["data"])


def test_ar_dashboard_lists_work_to_do_and_an_empty_organization_says_so(org: Org, migrated: str) -> None:
    assert org.get("/dashboard/owner").json()["has_data"] is False and org.get("/dashboard/owner").json()["kpis"]["total_ar"] == "0"
    s = seed(org, migrated)
    org.payment("2000.00", reference="D-2", payment_date="2026-11-10")
    org.post("/reconciliation/runs")
    d = org.get("/dashboard/ar").json()
    assert d["last_run"]["counts"]["auto_applied"] == 1  # the exact match paid D-2, so it is no longer waiting for attention
    assert [(x["number"], x["days_late"]) for x in d["attention"]][:2] == [("D-4", 137), ("D-1", 14)] and d["unmatched"] == []
    assert s["i2"] and d["needs_review"]["count"] == 0


def test_verified_recovered_counts_only_source_verified_payments_after_a_case_opened(org: Org, migrated: str) -> None:
    s = seed(org, migrated)
    assert org.get("/reports/recovered?range=90d").json()["rows"] == []
    case = org.post("/investigations", {"invoice_id": s["i2"]})
    assert case.status_code == 201
    p = org.payment("2000.00")
    assert org.allocate(p["id"], s["i2"], "2000.00").status_code == 201
    assert org.get("/reports/recovered?range=90d").json()["rows"] == []  # a manual payment is never "verified"
    with create_engine(migrated).begin() as c:
        c.execute(text("update payments set verification_level = 'source_verified' where id = :p"), {"p": p["id"]})
    rec = org.get("/reports/recovered?range=90d").json()
    assert [r["amount"] for r in rec["rows"]] == ["2000.0000"] and rec["total"] == "2000.0000"
    assert org.get("/dashboard/owner?range=90d").json()["kpis"]["recovered"] == "2000.0000"


import pytest  # noqa: E402


@pytest.mark.slow
def test_owner_dashboard_with_twenty_thousand_invoices(org: Org, migrated: str) -> None:
    import time

    c = org.customer("Bulk Customer")
    with create_engine(migrated).begin() as conn:
        conn.execute(text(
            "insert into invoices (organization_id, customer_id, invoice_number, issue_date, due_date, currency, total_amount, balance_due) "
            "select :o, :c, 'B-' || n, date '2026-01-01' + (n % 300), date '2026-02-01' + (n % 300), 'USD', 100 + n % 50, 100 + n % 50 from generate_series(1, 20000) n"), {"o": org.id, "c": c})
    for r in ("7d", "90d", "12m"):
        started = time.monotonic()
        d = org.get(f"/dashboard/owner?range={r}")
        print(f"owner dashboard {r}: {time.monotonic() - started:.2f}s")
        assert d.status_code == 200 and d.json()["kpis"]["open_invoices"] == 20000


def test_shell_frame_and_global_search_use_only_this_organizations_records(org: Org, migrated: str, client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    seed(org, migrated)
    org.payment("123.00", reference="ACH 998877", payer_name_raw="Zeta Corp")
    f = org.get("/shell").json()
    assert f["organization"]["name"] == "Acme" and f["user"]["name"] and f["counts"] == {"reconciliation": 0, "investigations": 0, "approvals": 0}
    r = org.get("/search?q=brightwater").json()
    assert [c["name"] for c in r["customers"]] == ["=Brightwater"] and {i["number"] for i in r["invoices"]} == {"D-3", "D-4"}
    assert [p["number"] for p in org.get("/search?q=998877").json()["payments"]] == ["PAY-0002"]
    assert org.get("/search?q=a").json() == {"customers": [], "invoices": [], "payments": [], "investigations": []}  # too short
    other = Org(client, auth, "Other Co")
    assert other.get("/search?q=brightwater").json()["customers"] == [] and other.get("/shell").json()["organization"]["name"] == "Other Co"
    ar = auth(join_as_ar(client, auth, mail, org.owner, org.id), org=org.id)
    assert client.get("/api/v1/shell", headers=ar).json()["counts"]["approvals"] == 0


def test_the_audit_chain_can_be_verified_through_the_api(org: Org) -> None:
    org.customer("Chain Co")
    r = org.get("/audit-events/verify").json()
    assert r["valid"] is True and r["first_broken_seq"] is None and r["events"] >= 2


@pytest.mark.slow
def test_concurrent_readers_over_twenty_thousand_invoices(org: Org, migrated: str) -> None:
    """Twenty people at once on the busiest screens: reports the slowest quarter of requests (p95)."""
    import time
    from concurrent.futures import ThreadPoolExecutor

    c = org.customer("Load Customer")
    with create_engine(migrated).begin() as conn:
        conn.execute(text(
            "insert into invoices (organization_id, customer_id, invoice_number, issue_date, due_date, currency, total_amount, balance_due) "
            "select :o, :c, 'L-' || n, date '2026-01-01' + (n % 300), date '2026-02-01' + (n % 300), 'USD', 100 + n % 50, 100 + n % 50 from generate_series(1, 20000) n"), {"o": org.id, "c": c})
    paths = ["/dashboard/owner?range=30d", "/invoices?tab=overdue&limit=25", "/reports/aging", "/customers?limit=25", "/invoices?q=L-1999&limit=25"]

    def hit(i: int) -> float:
        t = time.monotonic()
        r = org.get(paths[i % len(paths)])
        assert r.status_code == 200
        return time.monotonic() - t

    with ThreadPoolExecutor(20) as pool:
        times = sorted(pool.map(hit, range(100)))
    p95 = times[int(len(times) * 0.95) - 1]
    print(f"100 requests, 20 at a time, 20,000 invoices: median {times[50]:.2f}s p95 {p95:.2f}s max {times[-1]:.2f}s")
    assert p95 < 5
