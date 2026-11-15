import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.core.mailer import LogMailer, get_mailer
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401


@pytest.fixture
def mail(client: TestClient) -> LogMailer:  # noqa: F811
    m = LogMailer()
    client.app.dependency_overrides[get_mailer] = lambda: m  # type: ignore[attr-defined]
    return m


def token_from(mail: LogMailer, to: str) -> str:
    body = next(m.body for m in reversed(mail.sent) if m.to == to)
    return body.split("/invite/")[1].split()[0].strip()


def join_as_ar(client: TestClient, auth: Token, mail: LogMailer, owner: uuid.UUID, org: uuid.UUID) -> uuid.UUID:  # noqa: F811
    ar = uuid.uuid4()
    email = f"{ar}@example.test"
    r = client.post("/api/v1/members/invitations", json={"email": email, "role_key": "ar_specialist"}, headers=auth(owner, org=org))
    assert r.status_code == 201, r.text
    ok = client.post(f"/api/v1/invitations/{token_from(mail, email)}/accept", headers=auth(ar, email=email))
    assert ok.status_code == 200, ok.text
    return ar


def test_invitation_flow_end_to_end(client: TestClient, auth: Token, mail: LogMailer, migrated: str) -> None:  # noqa: F811
    owner, org = new_org(client, auth)
    h = auth(owner, org=org)
    ar = join_as_ar(client, auth, mail, owner, org)
    members = client.get("/api/v1/members", headers=h).json()["data"]
    assert sorted(m["role_key"] for m in members) == ["ar_specialist", "owner"]
    # The token is stored only as a hash and the link was emailed, not returned.
    with create_engine(migrated).connect() as c:
        stored = c.execute(text("select token_hash from invitations where organization_id = :o"), {"o": org}).scalar_one()
    assert len(bytes(stored)) == 32
    assert client.get("/api/v1/invitations", headers=h).status_code == 404
    # The accepted invitation is single-use and the new member can sign in to the organization.
    assert client.get("/api/v1/me/context", headers=auth(ar, org=org)).json()["role_key"] == "ar_specialist"
    actions = [e["action"] for e in client.get("/api/v1/audit-events?limit=50", headers=h).json()["data"]]
    assert {"invitation.created", "invitation.accepted"} <= set(actions)


def test_describe_is_public_but_only_for_the_token_holder(client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    owner, org = new_org(client, auth, "Globex")
    client.post("/api/v1/members/invitations", json={"email": "new.hire@example.test"}, headers=auth(owner, org=org))
    tok = token_from(mail, "new.hire@example.test")
    info = client.get(f"/api/v1/invitations/{tok}").json()
    assert info == {"organization_name": "Globex", "role_key": "ar_specialist", "role_name": "AR specialist", "email": "new.hire@example.test"}
    assert client.get("/api/v1/invitations/not-a-real-token").status_code == 404


def test_wrong_person_cannot_accept_and_reuse_fails(client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    owner, org = new_org(client, auth)
    client.post("/api/v1/members/invitations", json={"email": "invited@example.test"}, headers=auth(owner, org=org))
    tok = token_from(mail, "invited@example.test")
    other = client.post(f"/api/v1/invitations/{tok}/accept", headers=auth(email="someone.else@example.test"))
    assert other.status_code == 403 and other.json()["code"] == "permission_denied"
    me = uuid.uuid4()
    assert client.post(f"/api/v1/invitations/{tok}/accept", headers=auth(me, email="invited@example.test")).status_code == 200
    assert client.post(f"/api/v1/invitations/{tok}/accept", headers=auth(uuid.uuid4(), email="invited@example.test")).status_code == 404


def test_duplicates_validation_resend_and_revoke(client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    owner, org = new_org(client, auth)
    h = auth(owner, org=org)
    assert client.post("/api/v1/members/invitations", json={"email": "bad"}, headers=h).status_code == 422
    assert client.post("/api/v1/members/invitations", json={"email": "x@example.test", "role_key": "god"}, headers=h).status_code == 422
    first = client.post("/api/v1/members/invitations", json={"email": "Dup@Example.test"}, headers=h).json()
    dup = client.post("/api/v1/members/invitations", json={"email": "dup@example.test"}, headers=h)
    assert dup.status_code == 409 and dup.json()["code"] == "duplicate"
    old = token_from(mail, "dup@example.test")
    assert client.post(f"/api/v1/members/invitations/{first['id']}/resend", headers=h).status_code == 204
    assert client.get(f"/api/v1/invitations/{old}").status_code == 404  # old link no longer works
    new = token_from(mail, "dup@example.test")
    assert new != old and client.get(f"/api/v1/invitations/{new}").status_code == 200
    assert client.delete(f"/api/v1/members/invitations/{first['id']}", headers=h).status_code == 204
    assert client.get(f"/api/v1/invitations/{new}").status_code == 404
    assert client.get("/api/v1/members/invitations", headers=h).json()["data"] == []


def test_cannot_invite_an_existing_member(client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    owner, org = new_org(client, auth)
    me = client.get("/api/v1/me", headers=auth(owner)).json()["email"]
    r = client.post("/api/v1/members/invitations", json={"email": me}, headers=auth(owner, org=org))
    assert r.status_code == 409


def test_ar_cannot_manage_the_team(client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    owner, org = new_org(client, auth)
    ar = join_as_ar(client, auth, mail, owner, org)
    h = auth(ar, org=org)
    assert client.get("/api/v1/members", headers=h).status_code == 200  # team.view is on by default
    assert client.post("/api/v1/members/invitations", json={"email": "z@example.test"}, headers=h).status_code == 403
    assert client.get("/api/v1/members/invitations", headers=h).status_code == 403
    assert client.put("/api/v1/roles/ar/permissions", json={"permissions": []}, headers=h).status_code == 403


def test_role_changes_suspension_and_the_last_owner_rule(client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    owner, org = new_org(client, auth)
    h = auth(owner, org=org)
    ar = join_as_ar(client, auth, mail, owner, org)
    members = {m["user_id"]: m for m in client.get("/api/v1/members", headers=h).json()["data"]}
    own_id, ar_id = members[str(owner)]["id"], members[str(ar)]["id"]
    # The only owner can neither demote nor suspend themselves.
    assert client.patch(f"/api/v1/members/{own_id}", json={"role_key": "ar_specialist"}, headers=h).json()["code"] == "business_rule_violation"
    assert client.patch(f"/api/v1/members/{own_id}", json={"status": "suspended"}, headers=h).status_code == 422
    # Suspending an AR takes effect on their very next request.
    assert client.patch(f"/api/v1/members/{ar_id}", json={"status": "suspended"}, headers=h).status_code == 200
    assert client.get("/api/v1/me/context", headers=auth(ar, org=org)).json()["code"] == "membership_suspended"
    client.patch(f"/api/v1/members/{ar_id}", json={"status": "active"}, headers=h)
    # Promote the AR; now the original owner may step down.
    client.patch(f"/api/v1/members/{ar_id}", json={"role_key": "owner"}, headers=h)
    assert client.patch(f"/api/v1/members/{own_id}", json={"role_key": "ar_specialist"}, headers=h).status_code == 200
    assert client.get("/api/v1/me/context", headers=auth(ar, org=org)).json()["role_key"] == "owner"
    assert client.patch(f"/api/v1/members/{uuid.uuid4()}", json={"status": "active"}, headers=auth(ar, org=org)).status_code == 404


def test_ar_permission_editor_respects_locks_and_applies_immediately(client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    from app.services.permissions import AR_DEFAULT, NON_GRANTABLE

    owner, org = new_org(client, auth)
    h = auth(owner, org=org)
    ar = join_as_ar(client, auth, mail, owner, org)
    rows = {r["key"]: r for r in client.get("/api/v1/roles/ar/permissions", headers=h).json()["data"]}
    assert rows["approvals.decide"]["locked"] and not rows["approvals.decide"]["granted"]
    assert rows["invoices.manage"]["granted"] and not rows["invoices.manage"]["locked"]
    assert "settings.manage" in NON_GRANTABLE
    # Cannot grant owner-only, cannot remove always-on, cannot invent keys.
    assert client.put("/api/v1/roles/ar/permissions", json={"permissions": [*AR_DEFAULT, "approvals.decide"]}, headers=h).status_code == 422
    assert client.put("/api/v1/roles/ar/permissions", json={"permissions": ["invoices.manage"]}, headers=h).status_code == 422
    assert client.put("/api/v1/roles/ar/permissions", json={"permissions": [*AR_DEFAULT, "nope"]}, headers=h).status_code == 422
    # Remove invoices.manage and add collections.send: the AR sees it on the next request.
    new = (set(AR_DEFAULT) - {"invoices.manage"}) | {"collections.send"}
    assert client.put("/api/v1/roles/ar/permissions", json={"permissions": sorted(new)}, headers=h).status_code == 204
    perms = client.get("/api/v1/me/context", headers=auth(ar, org=org)).json()["permissions"]
    assert "invoices.manage" not in perms and "collections.send" in perms
    last = client.get("/api/v1/audit-events?group=role", headers=h).json()["data"][0]
    assert last["action"] == "role.permissions_changed"


def test_invitations_never_cross_organizations(client: TestClient, auth: Token, mail: LogMailer) -> None:  # noqa: F811
    owner_a, org_a = new_org(client, auth, "A")
    owner_b, org_b = new_org(client, auth, "B")
    r = client.post("/api/v1/members/invitations", json={"email": "p@example.test"}, headers=auth(owner_a, org=org_a)).json()
    assert client.delete(f"/api/v1/members/invitations/{r['id']}", headers=auth(owner_b, org=org_b)).status_code == 404
    assert client.get("/api/v1/members/invitations", headers=auth(owner_b, org=org_b)).json()["data"] == []
