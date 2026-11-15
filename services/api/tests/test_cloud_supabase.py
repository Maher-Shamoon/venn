"""Live checks against the configured Supabase project (real sign-in, real ES256 tokens, real hosted PostgreSQL).

Skipped unless apps/web/.env.local, services/api/.env and apps/web/e2e/.test-user.local exist
(create the user with scripts/create_test_user.py). Never runs in CI.
"""

import json
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[3]
WEB_ENV, USER_FILE = ROOT / "apps/web/.env.local", ROOT / "apps/web/e2e/.test-user.local"
pytestmark = pytest.mark.skipif(not (WEB_ENV.exists() and USER_FILE.exists() and (ROOT / "services/api/.env").exists()),
                                reason="Supabase project is not configured")


def _env() -> dict[str, str]:
    return dict(line.split("=", 1) for line in WEB_ENV.read_text().splitlines() if "=" in line and not line.startswith("#"))


@pytest.fixture(scope="module")
def token() -> str:
    env, user = _env(), json.loads(USER_FILE.read_text())
    r = httpx.post(f"{env['VITE_SUPABASE_URL']}/auth/v1/token?grant_type=password",
                   headers={"apikey": env["VITE_SUPABASE_ANON_KEY"]}, json=user, timeout=30)
    assert r.status_code == 200, r.text
    return str(r.json()["access_token"])


@pytest.fixture(scope="module")
def client() -> TestClient:
    from app.core import db
    from app.core.config import get_settings
    from app.main import create_app

    get_settings.cache_clear()
    db._engine = None
    assert get_settings().jwks_url, "services/api/.env must set VENN_JWKS_URL"
    return TestClient(create_app(), raise_server_exceptions=False)


def test_wrong_password_is_rejected_by_supabase() -> None:
    env, user = _env(), json.loads(USER_FILE.read_text())
    r = httpx.post(f"{env['VITE_SUPABASE_URL']}/auth/v1/token?grant_type=password",
                   headers={"apikey": env["VITE_SUPABASE_ANON_KEY"]}, json={"email": user["email"], "password": "Wrong-Password-1!"}, timeout=30)
    assert r.status_code == 400 and r.json()["error_code"] == "invalid_credentials"


def test_api_accepts_a_real_supabase_token_and_rejects_a_tampered_one(client: TestClient, token: str) -> None:
    ok = client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert ok.status_code == 200 and ok.json()["email"] == json.loads(USER_FILE.read_text())["email"]
    assert ok.json()["email_verified"] is True
    head, body, sig = token.split(".")
    bad = client.get("/api/v1/me", headers={"Authorization": f"Bearer {head}.{body}.{sig[:-4]}AAAA"})
    assert bad.status_code == 401


def test_organization_lifecycle_on_the_hosted_database(client: TestClient, token: str) -> None:
    h = {"Authorization": f"Bearer {token}"}
    me = client.get("/api/v1/me", headers=h).json()
    if not me["memberships"]:
        created = client.post("/api/v1/organizations", json={"name": "QA Organization"}, headers=h)
        assert created.status_code == 201, created.text
        me = client.get("/api/v1/me", headers=h).json()
    org = me["memberships"][0]["organization_id"]
    org_h = {**h, "X-Organization-Id": org}
    ctx = client.get("/api/v1/me/context", headers=org_h).json()
    assert ctx["role_key"] == "owner" and "audit.view" in ctx["permissions"]
    events = client.get("/api/v1/audit-events", headers=org_h).json()["data"]
    assert events and events[-1]["action"] == "organization.created"
    # A made-up organization is refused even with a valid token.
    other = client.get("/api/v1/organization", headers={**h, "X-Organization-Id": "00000000-0000-0000-0000-000000000001"})
    assert other.status_code == 403 and other.json()["code"] == "not_a_member"


def test_the_browser_key_cannot_read_application_tables() -> None:
    env = _env()
    for table in ("permissions", "profiles", "organizations", "memberships", "audit_events"):
        r = httpx.get(f"{env['VITE_SUPABASE_URL']}/rest/v1/{table}?select=*&limit=1",
                      headers={"apikey": env["VITE_SUPABASE_ANON_KEY"]}, timeout=30)
        assert r.status_code in (401, 403), f"{table}: {r.status_code} {r.text[:80]}"
