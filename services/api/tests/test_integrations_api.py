import time

import pytest
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.core import secrets
from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.mailer import LogMailer
from app.services import integrations as svc
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401
from tests.test_ledger_api import Org, fixed_today, org  # noqa: F401
from tests.test_team import join_as_ar, mail  # noqa: F401

KEY = "rk_test_" + "x" * 40


@pytest.fixture(autouse=True)
def configured(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("VENN_SECRETS_KEY", Fernet.generate_key().decode())
    monkeypatch.setenv("VENN_GOOGLE_CLIENT_ID", "gid")
    monkeypatch.setenv("VENN_GOOGLE_CLIENT_SECRET", "gsecret")
    monkeypatch.setenv("VENN_QBO_CLIENT_SECRET", "")  # QuickBooks is unavailable here whatever the developer machine has configured
    get_settings.cache_clear()
    yield  # type: ignore[misc]
    get_settings.cache_clear()


def charge(i: int, amount: int = 5000, **kw: object) -> dict:  # type: ignore[type-arg]
    return {"id": f"ch_{i}", "amount": amount, "amount_refunded": 0, "currency": "usd", "status": "succeeded", "paid": True, "created": 1_762_000_000 + i, "description": f"INV-100{i}",
            "billing_details": {"name": "Northwind Labs"}, "receipt_email": None, "metadata": {}, **kw}


def fake_stripe(charges: list[dict]):  # type: ignore[no-untyped-def,type-arg]
    def _stripe(key: str, path: str, params: dict | None = None) -> dict:  # type: ignore[type-arg]
        if key != KEY:
            raise ApiError(422, "validation_error", "Stripe did not accept this key")
        return {"data": charges, "has_more": False}
    return _stripe


def test_secrets_are_encrypted_and_the_oauth_state_cannot_be_forged() -> None:
    assert secrets.unseal(secrets.seal("hello")) == "hello" and secrets.seal("hello") != "hello"
    s = secrets.sign_state("org:user")
    assert secrets.read_state(s) == "org:user"
    with pytest.raises(ApiError):
        secrets.read_state(s[:-4] + "AAAA")
    with pytest.raises(ApiError):
        secrets.read_state(secrets.sign_state("org:user", ttl=-1))
    time.sleep(0)


def test_stripe_key_rules_encryption_and_status(org: Org, monkeypatch: pytest.MonkeyPatch, migrated: str) -> None:
    monkeypatch.setattr(svc, "_stripe", fake_stripe([]))
    assert org.post("/integrations/stripe/connect", {"key": "sk_live_" + "y" * 30}).status_code == 422  # a full secret key is refused
    assert org.post("/integrations/stripe/connect", {"key": "rk_test_" + "z" * 40}).status_code == 422  # Stripe rejects it
    assert org.post("/integrations/stripe/connect", {"key": KEY}).status_code == 200
    s = {i["provider"]: i for i in org.get("/integrations").json()["data"]}
    assert s["stripe"]["connected"] is True and s["stripe"]["account"] == "test mode" and s["stripe"]["status"] == "connected" and s["quickbooks"]["available"] is False
    assert KEY not in str(org.get("/integrations").json())  # never sent back
    with create_engine(migrated).connect() as c:
        stored = c.execute(text("select secret_enc from integrations")).scalar_one()
    assert KEY not in stored and len(stored) > 50  # encrypted at rest


def test_sync_makes_source_verified_payments_once_and_skips_failed_and_refunded(org: Org, monkeypatch: pytest.MonkeyPatch) -> None:
    org.customer("Northwind Labs")
    monkeypatch.setattr(svc, "_stripe", fake_stripe([charge(1), charge(2, 2500, amount_refunded=500), charge(3, status="failed", paid=False), charge(4, 1000, amount_refunded=1000), charge(5, 1234, currency="jpy")]))
    org.post("/integrations/stripe/connect", {"key": KEY})
    r = org.post("/integrations/stripe/sync").json()
    assert r == {"seen": 5, "new": 3, "skipped": 2, "already_here": 0}
    pays = {p["reference"]: p for p in org.get("/payments?limit=50").json()["data"]}
    assert pays["INV-1001"]["amount"] == "50.00" and pays["INV-1002"]["amount"] == "20.00" and pays["INV-1005"]["amount"] == "1234.00" and pays["INV-1005"]["currency"] == "JPY"  # cents, refunds and zero-decimal currencies
    assert pays["INV-1001"]["verification_level"] == "source_verified" and pays["INV-1001"]["customer_name"] == "Northwind Labs" and pays["INV-1001"]["method"] == "card"
    again = org.post("/integrations/stripe/sync").json()
    assert again["new"] == 0 and again["already_here"] == 3 and org.get("/payments").json()["total"] == 3  # safe to run twice
    assert org.get("/integrations").json()["data"][0]["last_sync_at"] is not None


def test_a_connection_belongs_to_one_organization_and_only_owners_manage_it(org: Org, client: TestClient, auth: Token, mail: LogMailer, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: F811
    monkeypatch.setattr(svc, "_stripe", fake_stripe([charge(1)]))
    org.post("/integrations/stripe/connect", {"key": KEY})
    other = Org(client, auth, "Other Co")
    assert {i["provider"]: i["connected"] for i in other.get("/integrations").json()["data"]}["stripe"] is False
    assert other.post("/integrations/stripe/sync").status_code == 409
    ar = auth(join_as_ar(client, auth, mail, org.owner, org.id), org=org.id)
    assert client.get("/api/v1/integrations", headers=ar).status_code == 200
    assert client.post("/api/v1/integrations/stripe/sync", headers=ar).status_code == 403 and client.delete("/api/v1/integrations/stripe", headers=ar).status_code == 403
    assert org.c.delete("/api/v1/integrations/stripe", headers=org.h).status_code == 204 and org.c.delete("/api/v1/integrations/stripe", headers=org.h).status_code == 404


def test_gmail_connect_flow_and_case_search(org: Org, client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:  # noqa: F811
    url = org.get("/integrations/gmail/start").json()["url"]
    assert url.startswith("https://accounts.google.com/") and "client_id=gid" in url and "gmail.readonly" in url and "state=" in url and "access_type=offline" in url
    bad = client.get("/api/v1/integrations/gmail/callback?code=abc&state=tampered", follow_redirects=False)
    assert bad.status_code == 303 and "error=gmail_failed" in bad.headers["location"]
    assert "error=gmail_denied" in client.get("/api/v1/integrations/gmail/callback?error=access_denied", follow_redirects=False).headers["location"]
    state = secrets.sign_state(f"gmail:{org.id}:{org.owner}")
    monkeypatch.setattr(svc, "_token", lambda grant: {"refresh_token": "r1", "access_token": "a1"})
    monkeypatch.setattr(svc.httpx, "get", lambda *a, **k: type("R", (), {"status_code": 200, "json": lambda self: {"emailAddress": "ap@acme.example"}})())
    ok = client.get(f"/api/v1/integrations/gmail/callback?code=abc&state={state}", follow_redirects=False)
    assert ok.status_code == 303 and "connected=gmail" in ok.headers["location"]
    g = next(i for i in org.get("/integrations").json()["data"] if i["provider"] == "gmail")
    assert g["connected"] and g["account"] == "ap@acme.example"
    inv = org.invoice(org.customer("Northwind Labs", contact_email="ap@northwind.example"), "5000.00", number="INV-1042")
    org.payment("4000.00", reference="INV-1042", payment_date="2026-11-01")
    org.post("/reconciliation/runs")
    case = org.get("/investigations").json()["data"][0]["id"]
    seen: list[str] = []
    monkeypatch.setattr(svc, "gmail_search", lambda db, q, limit=8: seen.append(q) or [{"id": "m1", "subject": "Re: INV-1042", "from": "ap@northwind.example", "date": "Mon", "snippet": "we sent the rest"}])
    assert org.get(f"/investigations/{case}/emails").json()["data"][0]["subject"] == "Re: INV-1042"
    assert seen == ['"INV-1042" OR from:ap@northwind.example'] and inv["id"]
