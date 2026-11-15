import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.services import audit
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401


def entries(migrated: str, org: uuid.UUID) -> list[str]:
    with create_engine(migrated).connect() as c:
        return [r[0] for r in c.execute(text("select action from audit_events where organization_id = :o order by seq"), {"o": org})]


def test_creating_an_organization_is_audited_in_the_same_transaction(client: TestClient, auth: Token, migrated: str) -> None:  # noqa: F811
    user, org = new_org(client, auth)
    assert entries(migrated, org) == ["organization.created"]
    with create_engine(migrated).connect() as c:
        row = c.execute(text("select actor_id, record_id, request_id, after from audit_events where organization_id = :o"), {"o": org}).one()
    assert row.actor_id == user and row.record_id == str(org) and row.request_id.startswith("req_")
    assert row.after["name"] == "Acme"


def test_audit_rows_cannot_be_changed_or_deleted_even_by_the_owner(client: TestClient, auth: Token, migrated: str) -> None:  # noqa: F811
    _, org = new_org(client, auth)
    eng = create_engine(migrated)
    for sql in ("update audit_events set action = 'x'", "delete from audit_events", "truncate audit_events"):
        with eng.connect() as c, pytest.raises(DBAPIError):
            c.execute(text(sql))
            c.commit()
    assert entries(migrated, org) == ["organization.created"]


def _session(migrated: str, org: uuid.UUID) -> Session:
    s = Session(create_engine(migrated))
    s.execute(text("set local role venn_app"))
    s.execute(text("select set_config('app.org_id', :o, true)"), {"o": str(org)})
    return s


def test_chain_links_every_entry_and_verifies(client: TestClient, auth: Token, migrated: str) -> None:  # noqa: F811
    _, org = new_org(client, auth)
    s = _session(migrated, org)
    for i in range(3):
        audit.record(s, org, "invoice.created", record_type="invoice", record_id=f"INV-{i}", after={"n": i})
    s.commit()
    with create_engine(migrated).connect() as c:
        rows = c.execute(text("select seq, prev_hash, hash from audit_events where organization_id = :o order by seq"), {"o": org}).all()
    assert [r.seq for r in rows] == [1, 2, 3, 4]
    assert rows[0].prev_hash is None and all(rows[i].prev_hash == rows[i - 1].hash for i in range(1, 4))
    v = Session(create_engine(migrated))
    assert audit.verify_chain(v, org) is None


def test_tampering_is_detected_at_the_first_bad_entry(client: TestClient, auth: Token, migrated: str) -> None:  # noqa: F811
    _, org = new_org(client, auth)
    s = _session(migrated, org)
    for i in range(3):
        audit.record(s, org, "payment.created", after={"amount": str(i)})
    s.commit()
    eng = create_engine(migrated)
    with eng.begin() as c:  # an attacker with superuser rights disables the guard and edits history
        c.execute(text("alter table audit_events disable trigger audit_events_no_update"))
        c.execute(text("update audit_events set after = '{\"amount\": \"999\"}' where organization_id = :o and seq = 3"), {"o": org})
        c.execute(text("alter table audit_events enable trigger audit_events_no_update"))
    assert audit.verify_chain(Session(eng), org) == 3


def test_sensitive_values_are_redacted() -> None:
    out = audit.redact({"bank": "Acme Bank", "account_number": "12345678", "nested": {"password": "x", "ok": 1},
                        "items": [{"api_key": "k"}]})
    assert out == {"bank": "Acme Bank", "account_number": "[redacted]", "nested": {"password": "[redacted]", "ok": 1},
                   "items": [{"api_key": "[redacted]"}]}


def test_concurrent_writers_keep_one_linear_chain(client: TestClient, auth: Token, migrated: str) -> None:  # noqa: F811
    from concurrent.futures import ThreadPoolExecutor

    _, org = new_org(client, auth)

    def write(i: int) -> None:
        s = _session(migrated, org)
        audit.record(s, org, "invoice.updated", record_id=str(i))
        s.commit()

    with ThreadPoolExecutor(8) as pool:
        list(pool.map(write, range(16)))
    assert audit.verify_chain(Session(create_engine(migrated)), org) is None
    assert len(entries(migrated, org)) == 17


def test_viewer_requires_permission_filters_and_pages(client: TestClient, auth: Token, migrated: str) -> None:  # noqa: F811
    owner, org = new_org(client, auth)
    s = _session(migrated, org)
    for i in range(5):
        audit.record(s, org, "invoice.created", actor_id=owner, record_type="invoice", record_id=f"I{i}")
    audit.record(s, org, "approval.decided", actor_id=owner, record_type="approval", record_id="A1")
    s.commit()
    h = auth(owner, org=org)
    page1 = client.get("/api/v1/audit-events?limit=4", headers=h).json()
    assert [e["seq"] for e in page1["data"]] == [7, 6, 5, 4] and page1["next_cursor"] == 4
    page2 = client.get(f"/api/v1/audit-events?limit=4&cursor={page1['next_cursor']}", headers=h).json()
    assert [e["seq"] for e in page2["data"]] == [3, 2, 1] and page2["next_cursor"] is None
    only = client.get("/api/v1/audit-events?group=approval", headers=h).json()["data"]
    assert [e["action"] for e in only] == ["approval.decided"] and only[0]["actor_name"] == "Test User"
    assert len(client.get("/api/v1/audit-events?record_type=invoice&record_id=I2", headers=h).json()["data"]) == 1

    # An AR specialist has no audit.view by default.
    ar = uuid.uuid4()
    with create_engine(migrated).begin() as c:
        c.execute(text("insert into profiles (id, email, full_name) values (:u, :e, 'AR')"), {"u": ar, "e": f"{ar}@x.test"})
        rid = c.execute(text("select id from roles where organization_id = :o and key = 'ar_specialist'"), {"o": org}).scalar_one()
        c.execute(text("insert into memberships (organization_id, user_id, role_id) values (:o, :u, :r)"), {"o": org, "u": ar, "r": rid})
    assert client.get("/api/v1/audit-events", headers=auth(ar, org=org)).status_code == 403


def test_viewer_never_shows_another_organizations_entries(client: TestClient, auth: Token) -> None:  # noqa: F811
    user_a, org_a = new_org(client, auth, "A")
    user_b, org_b = new_org(client, auth, "B")
    a = client.get("/api/v1/audit-events", headers=auth(user_a, org=org_a)).json()["data"]
    b = client.get("/api/v1/audit-events", headers=auth(user_b, org=org_b)).json()["data"]
    assert {e["record_id"] for e in a} == {str(org_a)} and {e["record_id"] for e in b} == {str(org_b)}
