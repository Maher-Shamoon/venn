"""Authentication, organization membership, permissions and tenant isolation through the real HTTP API."""

import time
import uuid
from collections.abc import Callable

import jwt
import pytest
from fastapi.testclient import TestClient

SECRET = "test-secret-test-secret-test-secret-123"
Token = Callable[..., dict[str, str]]


@pytest.fixture
def client(migrated: str, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("VENN_JWT_SECRET", SECRET)
    monkeypatch.setenv("VENN_JWKS_URL", "")  # a developer .env may point at a real project; tests use the shared secret
    monkeypatch.setenv("VENN_JWT_ISSUER", "")
    from app.core import db
    from app.core.config import get_settings
    from app.main import create_app

    get_settings.cache_clear()
    db._engine = None
    return TestClient(create_app(), raise_server_exceptions=False)


@pytest.fixture
def auth() -> Token:
    def make(user: uuid.UUID | None = None, email: str | None = None, verified: bool = True,
             exp: int = 3600, org: uuid.UUID | str | None = None) -> dict[str, str]:
        uid = user or uuid.uuid4()
        email = email or f"{uid}@example.test"
        token = jwt.encode(
            {"sub": str(uid), "email": email, "aud": "authenticated", "exp": int(time.time()) + exp,
             "user_metadata": {"email_verified": verified, "full_name": "Test User"}},
            SECRET, algorithm="HS256")
        h = {"Authorization": f"Bearer {token}"}
        if org:
            h["X-Organization-Id"] = str(org)
        return h

    return make


def new_org(client: TestClient, auth: Token, name: str = "Acme") -> tuple[uuid.UUID, uuid.UUID]:
    user = uuid.uuid4()
    r = client.post("/api/v1/organizations", json={"name": name}, headers=auth(user))
    assert r.status_code == 201, r.text
    return user, uuid.UUID(r.json()["id"])


def test_missing_and_bad_tokens_are_401(client: TestClient, auth: Token) -> None:
    assert client.get("/api/v1/me").json()["code"] == "unauthenticated"
    assert client.get("/api/v1/me", headers={"Authorization": "Bearer nonsense"}).status_code == 401
    expired = client.get("/api/v1/me", headers=auth(exp=-10))
    assert expired.status_code == 401 and expired.json()["code"] == "token_expired"


def test_wrong_signature_is_rejected(client: TestClient) -> None:
    forged = jwt.encode({"sub": str(uuid.uuid4()), "aud": "authenticated", "exp": int(time.time()) + 60},
                        "another-secret-another-secret-another-1", algorithm="HS256")
    assert client.get("/api/v1/me", headers={"Authorization": f"Bearer {forged}"}).status_code == 401


def test_unverified_email_cannot_use_organization_data(client: TestClient, auth: Token) -> None:
    user, org = new_org(client, auth)
    r = client.get("/api/v1/organization", headers=auth(user, verified=False, org=org))
    assert r.status_code == 403 and r.json()["code"] == "email_not_verified"
    assert client.post("/api/v1/organizations", json={"name": "X"}, headers=auth(verified=False)).status_code == 403


def test_creating_an_organization_makes_the_creator_owner_with_all_permissions(client: TestClient, auth: Token) -> None:
    user, org = new_org(client, auth)
    me = client.get("/api/v1/me", headers=auth(user)).json()
    assert [(m["organization_name"], m["role_key"], m["status"]) for m in me["memberships"]] == [("Acme", "owner", "active")]
    ctx = client.get("/api/v1/me/context", headers=auth(user, org=org)).json()
    from app.services.permissions import ALL_KEYS
    assert ctx["role_key"] == "owner" and set(ctx["permissions"]) == ALL_KEYS


def test_blank_organization_name_is_a_validation_error(client: TestClient, auth: Token) -> None:
    r = client.post("/api/v1/organizations", json={"name": "   "}, headers=auth())
    assert r.status_code == 422 and r.json()["code"] == "validation_error"


def test_organization_header_is_required_and_checked(client: TestClient, auth: Token) -> None:
    user, org = new_org(client, auth)
    assert client.get("/api/v1/organization", headers=auth(user)).status_code == 400
    assert client.get("/api/v1/organization", headers=auth(user, org="not-a-uuid")).status_code == 400
    r = client.get("/api/v1/organization", headers=auth(user, org=uuid.uuid4()))
    assert r.status_code == 403 and r.json()["code"] == "not_a_member"


def test_cross_tenant_access_is_denied(client: TestClient, auth: Token) -> None:
    user_a, org_a = new_org(client, auth, "Org A")
    user_b, org_b = new_org(client, auth, "Org B")
    # A reads their own organization.
    assert client.get("/api/v1/organization", headers=auth(user_a, org=org_a)).json()["name"] == "Org A"
    # A names B's organization: not a member, so nothing is revealed.
    r = client.get("/api/v1/organization", headers=auth(user_a, org=org_b))
    assert r.status_code == 403 and r.json()["code"] == "not_a_member"
    # B's membership list never mentions A.
    assert [m["organization_name"] for m in client.get("/api/v1/me", headers=auth(user_b)).json()["memberships"]] == ["Org B"]


def test_member_without_permission_is_denied_and_suspension_applies_immediately(client: TestClient, auth: Token, migrated: str) -> None:
    from sqlalchemy import create_engine, text

    owner, org = new_org(client, auth)
    ar = uuid.uuid4()
    eng = create_engine(migrated)
    with eng.begin() as c:
        c.execute(text("insert into profiles (id, email, full_name) values (:u, :e, 'AR')"), {"u": ar, "e": f"{ar}@x.test"})
        rid = c.execute(text("select id from roles where organization_id = :o and key = 'ar_specialist'"), {"o": org}).scalar_one()
        c.execute(text("insert into memberships (organization_id, user_id, role_id) values (:o, :u, :r)"), {"o": org, "u": ar, "r": rid})
    # AR defaults exclude settings.view.
    r = client.get("/api/v1/organization", headers=auth(ar, org=org))
    assert r.status_code == 403 and r.json()["code"] == "permission_denied"
    assert "invoices.view" in client.get("/api/v1/me/context", headers=auth(ar, org=org)).json()["permissions"]
    with eng.begin() as c:
        c.execute(text("update memberships set status = 'suspended' where user_id = :u"), {"u": ar})
    r = client.get("/api/v1/me/context", headers=auth(ar, org=org))
    assert r.status_code == 403 and r.json()["code"] == "membership_suspended"
