import uuid

from fastapi.testclient import TestClient

from app.core.mailer import LogMailer
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401
from tests.test_team import join_as_ar, mail  # noqa: F401


def test_read_defaults_and_update_company(client: TestClient, auth: Token) -> None:  # noqa: F811
    owner, org = new_org(client, auth, "Acme")
    h = auth(owner, org=org)
    s = client.get("/api/v1/settings", headers=h).json()
    assert s["company"]["name"] == "Acme" and s["financial"]["default_terms_days"] == 30 and s["version"] == 1
    r = client.patch("/api/v1/settings/company", json={"name": "Acme Studio", "legal_name": "Acme Studio LLC", "country": "GB"}, headers=h)
    assert r.status_code == 200 and r.json()["company"]["name"] == "Acme Studio" and r.json()["version"] == 2
    assert client.get("/api/v1/me", headers=auth(owner)).json()["memberships"][0]["organization_name"] == "Acme Studio"
    last = client.get("/api/v1/audit-events?group=settings", headers=h).json()["data"][0]
    assert last["before"]["name"] == "Acme" and last["after"]["name"] == "Acme Studio"


def test_validation(client: TestClient, auth: Token) -> None:  # noqa: F811
    owner, org = new_org(client, auth)
    h = auth(owner, org=org)
    assert client.patch("/api/v1/settings/company", json={"name": "  "}, headers=h).status_code == 422
    for bad in ({"default_terms_days": 0}, {"default_terms_days": 400}, {"default_currency": "usd"}, {"timezone": "Mars/Base"}, {"short_grace_days": -1}):
        r = client.patch("/api/v1/settings/financial", json=bad, headers=h)
        assert r.status_code == 422 and r.json()["code"] == "validation_error", bad


def test_financial_update_merges_and_persists(client: TestClient, auth: Token) -> None:  # noqa: F811
    owner, org = new_org(client, auth)
    h = auth(owner, org=org)
    client.patch("/api/v1/settings/financial", json={"default_currency": "EUR", "timezone": "Europe/London", "default_terms_days": 45}, headers=h)
    r = client.patch("/api/v1/settings/financial", json={"auto_apply_exact": False}, headers=h).json()["financial"]
    assert r == {"default_currency": "EUR", "timezone": "Europe/London", "default_terms_days": 45, "auto_apply_exact": False,
                 "short_grace_days": 7, "claim_grace_days": 5}


def test_stale_version_is_a_conflict(client: TestClient, auth: Token) -> None:  # noqa: F811
    owner, org = new_org(client, auth)
    h = auth(owner, org=org)
    v = client.get("/api/v1/settings", headers=h).json()["version"]
    assert client.patch("/api/v1/settings/company", json={"website": "https://a.example"}, headers={**h, "If-Match": str(v)}).status_code == 200
    r = client.patch("/api/v1/settings/company", json={"website": "https://b.example"}, headers={**h, "If-Match": str(v)})
    assert r.status_code == 409 and r.json()["code"] == "version_conflict"


def test_ar_cannot_read_or_change_settings_and_tenants_are_separate(client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    owner, org = new_org(client, auth, "A")
    other, other_org = new_org(client, auth, "B")
    ar = join_as_ar(client, auth, mail, owner, org)
    assert client.get("/api/v1/settings", headers=auth(ar, org=org)).status_code == 403
    assert client.patch("/api/v1/settings/company", json={"name": "Hacked"}, headers=auth(ar, org=org)).status_code == 403
    client.patch("/api/v1/settings/company", json={"name": "A2"}, headers=auth(owner, org=org))
    assert client.get("/api/v1/settings", headers=auth(other, org=other_org)).json()["company"]["name"] == "B"
    assert uuid.UUID(str(org)) != other_org
