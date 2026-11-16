from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.core import clock
from app.core.config import get_settings
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401
from tests.test_ledger_api import Org, fixed_today, org  # noqa: F401


@pytest.fixture
def cron(monkeypatch: pytest.MonkeyPatch) -> str:
    monkeypatch.setenv("VENN_CRON_SECRET", "s3cret")
    get_settings.cache_clear()
    yield "Bearer s3cret"  # type: ignore[misc]
    get_settings.cache_clear()


def test_the_endpoint_is_closed_without_the_platform_secret(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: F811
    monkeypatch.delenv("VENN_CRON_SECRET", raising=False)
    get_settings.cache_clear()
    assert client.post("/api/v1/internal/cron/daily").status_code == 401
    assert client.post("/api/v1/internal/cron/daily", headers={"Authorization": "Bearer "}).status_code == 401  # no secret configured: closed even to an empty one
    monkeypatch.setenv("VENN_CRON_SECRET", "s3cret")
    get_settings.cache_clear()
    assert client.get("/api/v1/internal/cron/daily", headers={"Authorization": "Bearer wrong"}).status_code == 401
    get_settings.cache_clear()


def test_daily_run_expires_requests_opens_cases_and_creates_one_task_a_day(org: Org, client: TestClient, cron: str) -> None:  # noqa: F811
    c = org.customer("Northwind Labs")
    inv = org.invoice(c, "700.00", due="2026-11-01", number="J-1")
    org.post("/approvals", {"type": "write_off", "invoice_id": inv["id"], "amount": "5.00", "reason": "x"})
    first = client.get("/api/v1/internal/cron/daily", headers={"Authorization": cron})
    assert first.status_code == 200 and first.json()["failed"] == 0 and first.json()["opened"] >= 1 and first.json()["tasks"] >= 1
    assert [x["title"] for x in org.get("/tasks").json()["data"]] == ["Follow up with Northwind Labs (COL-0001)"]
    assert org.get("/collections").json()["data"][0]["customer"] == "Northwind Labs"
    assert client.get("/api/v1/internal/cron/daily", headers={"Authorization": cron}).status_code == 200
    assert len(org.get("/tasks").json()["data"]) == 1 and len(org.get("/collections").json()["data"]) == 1  # safe to run twice: nothing doubled for this organization
    clock._override = datetime(2026, 12, 20, 12, 0, tzinfo=UTC)
    try:
        r = client.get("/api/v1/internal/cron/daily", headers={"Authorization": cron}).json()
        assert r["expired"] >= 1 and r["tasks"] >= 1  # the request lapsed, and a new day brings a new reminder task
        assert org.get("/approvals?tab=decided").json()["data"][0]["status"] == "expired"
    finally:
        clock._override = datetime(2026, 11, 15, 12, 0, tzinfo=UTC)
