import json

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.core import secrets
from app.core.config import get_settings
from app.services import qbo
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401
from tests.test_ledger_api import Org, fixed_today, org  # noqa: F401


@pytest.fixture(autouse=True)
def configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VENN_SECRETS_KEY", Fernet.generate_key().decode())
    monkeypatch.setenv("VENN_QBO_CLIENT_ID", "qid")
    monkeypatch.setenv("VENN_QBO_CLIENT_SECRET", "qsecret")
    get_settings.cache_clear()
    yield  # type: ignore[misc]
    get_settings.cache_clear()


def q(i: int, balance: str, total: str | None = None, **kw: object) -> dict:  # type: ignore[type-arg]
    return {"Id": str(i), "DocNumber": f"Q-{i}", "TxnDate": "2026-10-01", "DueDate": "2026-11-01", "TotalAmt": float(total or balance), "Balance": float(balance), "CustomerRef": {"value": f"c{i % 2}", "name": f"Cust {i % 2}"},
            "CurrencyRef": {"value": "USD"}, "BillEmail": {"Address": f"ap{i % 2}@example.com"}, **kw}


def connect(client: TestClient, o: Org, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: F811
    state = secrets.sign_state(f"{o.id}:{o.owner}")
    monkeypatch.setattr(qbo, "_token", lambda grant: {"refresh_token": "r1", "access_token": "a1"})
    r = client.get(f"/api/v1/integrations/quickbooks/callback?code=c&state={state}&realmId=9341458710863639", follow_redirects=False)
    assert r.status_code == 303 and "connected=quickbooks" in r.headers["location"]


def test_start_url_and_forged_callbacks(org: Org, client: TestClient) -> None:  # noqa: F811
    url = org.get("/integrations/quickbooks/start").json()["url"]
    assert url.startswith("https://appcenter.intuit.com/connect/oauth2?") and "client_id=qid" in url and "com.intuit.quickbooks.accounting" in url and "state=" in url
    assert "error=quickbooks_failed" in client.get("/api/v1/integrations/quickbooks/callback?code=c&state=forged&realmId=1", follow_redirects=False).headers["location"]
    assert "error=quickbooks_denied" in client.get("/api/v1/integrations/quickbooks/callback?error=access_denied", follow_redirects=False).headers["location"]
    assert next(i for i in org.get("/integrations").json()["data"] if i["provider"] == "quickbooks")["available"] is True


def test_sync_reads_open_invoices_without_overwriting_venn_money(org: Org, client: TestClient, monkeypatch: pytest.MonkeyPatch, migrated: str) -> None:  # noqa: F811
    connect(client, org, monkeypatch)
    org.invoice(org.customer("Existing Co"), "10.00", number="Q-9")  # the same number already exists, so it is skipped
    data = [q(1, "1000.00"), q(2, "400.00", "1000.00"), q(3, "50.00", DueDate="2026-09-01"), q(9, "75.00")]
    monkeypatch.setattr(qbo, "_api", lambda db, realm, access, query: data if "startposition 1 " in query else [])
    r = org.post("/integrations/quickbooks/sync").json()
    assert r == {"seen": 4, "new": 2, "updated": 0, "skipped": 2}
    invs = {i["invoice_number"]: i for i in org.get("/invoices?limit=50").json()["data"]}
    assert invs["Q-1"]["total_amount"] == "1000.00" and invs["Q-2"]["total_amount"] == "400.00" and "600.00 already paid in QuickBooks" in org.get(f"/invoices/{invs['Q-2']['id']}").json()["description"]
    assert {c["name"] for c in org.get("/customers").json()["data"]} >= {"Cust 0", "Cust 1"} and org.get("/customers?q=Cust 1").json()["data"][0]["contact_email"] == "ap1@example.com"
    assert org.post("/integrations/quickbooks/sync").json()["new"] == 0  # safe to run twice
    # QuickBooks lowers a balance: an untouched invoice follows it; one that venn has applied money to does not
    pay = org.payment("100.00")
    assert org.allocate(pay["id"], invs["Q-1"]["id"], "100.00").status_code == 201
    data[:] = [q(1, "700.00", "1000.00"), q(2, "300.00", "1000.00")]
    again = org.post("/integrations/quickbooks/sync").json()
    assert again["updated"] == 1
    after = {i["invoice_number"]: i for i in org.get("/invoices?limit=50").json()["data"]}
    assert after["Q-2"]["total_amount"] == "300.00" and after["Q-1"]["total_amount"] == "1000.00" and after["Q-1"]["balance_due"] == "900.00"
    with create_engine(migrated).connect() as c:  # the rotated refresh token is stored, encrypted
        assert "refresh" not in c.execute(text("select secret_enc from integrations where provider = 'quickbooks'")).scalar_one()
    assert json.dumps(org.get("/integrations").json()).count("qsecret") == 0


def test_an_expired_login_is_flagged_for_reconnecting(org: Org, client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: F811
    connect(client, org, monkeypatch)

    def refuse(grant: dict) -> dict:  # type: ignore[type-arg]
        from app.core.errors import ApiError

        raise ApiError(409, "reconnect", "refused")

    monkeypatch.setattr(qbo, "_token", refuse)
    assert org.post("/integrations/quickbooks/sync").status_code == 409
    qb = next(i for i in org.get("/integrations").json()["data"] if i["provider"] == "quickbooks")
    assert qb["status"] == "error" and "Connect again" in qb["last_error"]
