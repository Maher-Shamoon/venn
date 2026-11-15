"""Tenant isolation at the database level (G-3, G-6). Runs as the migration user, then drops to venn_app."""

import uuid
from collections.abc import Iterator
from contextlib import contextmanager

import pytest
from sqlalchemy import Connection, create_engine, text
from sqlalchemy.exc import DBAPIError, IntegrityError


@pytest.fixture(scope="module")
def engine(migrated: str):  # type: ignore[no-untyped-def]
    return create_engine(migrated)


@contextmanager
def tenant(conn: Connection, org: uuid.UUID | None = None, user: uuid.UUID | None = None) -> Iterator[None]:
    """One transaction as venn_app with the tenancy settings the API would set."""
    with conn.begin():
        conn.execute(text("set local role venn_app"))
        if org:
            conn.execute(text("select set_config('app.org_id', :v, true)"), {"v": str(org)})
        if user:
            conn.execute(text("select set_config('app.user_id', :v, true)"), {"v": str(user)})
        yield


def seed_org(conn: Connection, name: str) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID]:
    """Creates an organization with an owner role and one owner. Returns (org, user, role)."""
    org, user, role = uuid.uuid4(), uuid.uuid4(), uuid.uuid4()
    conn.execute(text("insert into profiles (id, email, full_name) values (:u, :e, :n)"),
                 {"u": user, "e": f"{user}@x.test", "n": name})
    conn.execute(text("insert into organizations (id, name) values (:o, :n)"), {"o": org, "n": name})
    conn.execute(text("insert into roles (id, organization_id, key, name) values (:r, :o, 'owner', 'Owner')"),
                 {"r": role, "o": org})
    conn.execute(text("insert into memberships (organization_id, user_id, role_id) values (:o, :u, :r)"),
                 {"o": org, "u": user, "r": role})
    return org, user, role


@pytest.fixture
def two_orgs(engine):  # type: ignore[no-untyped-def]
    with engine.begin() as c:
        a, b = seed_org(c, "Org A"), seed_org(c, "Org B")
    return a, b


def test_no_organization_set_returns_nothing(engine, two_orgs) -> None:  # type: ignore[no-untyped-def]
    with engine.connect() as c, tenant(c):
        assert c.execute(text("select count(*) from roles")).scalar() == 0
        assert c.execute(text("select count(*) from organizations")).scalar() == 0


def test_organization_sees_only_its_own_rows(engine, two_orgs) -> None:  # type: ignore[no-untyped-def]
    (org_a, _, role_a), (org_b, _, role_b) = two_orgs
    with engine.connect() as c, tenant(c, org_a):
        ids = {r[0] for r in c.execute(text("select id from roles"))}
        assert role_a in ids and role_b not in ids
        assert c.execute(text("select count(*) from organizations where id = :o"), {"o": org_b}).scalar() == 0


def test_cannot_write_into_another_organization(engine, two_orgs) -> None:  # type: ignore[no-untyped-def]
    (org_a, _, _), (org_b, _, _) = two_orgs
    with engine.connect() as c, pytest.raises(DBAPIError), tenant(c, org_a):
        c.execute(text("insert into roles (organization_id, key, name) values (:o, 'ghost', 'Ghost')"),
                  {"o": org_b})


def test_user_can_list_own_memberships_across_organizations(engine) -> None:  # type: ignore[no-untyped-def]
    with engine.begin() as c:
        (org1, user, _), (org2, _, role2) = seed_org(c, "First"), seed_org(c, "Second")
        c.execute(text("insert into memberships (organization_id, user_id, role_id) values (:o, :u, :r)"),
                  {"o": org2, "u": user, "r": role2})
    with engine.connect() as c, tenant(c, user=user):
        orgs = {r[0] for r in c.execute(text("select organization_id from memberships"))}
    assert orgs == {org1, org2}


def test_profiles_are_visible_to_colleagues_only(engine) -> None:  # type: ignore[no-untyped-def]
    with engine.begin() as c:
        (org_a, user_a, _), (_, user_b, _) = seed_org(c, "Mine"), seed_org(c, "Theirs")
    with engine.connect() as c, tenant(c, org_a, user_a):
        ids = {r[0] for r in c.execute(text("select id from profiles"))}
    assert user_a in ids and user_b not in ids


def test_last_owner_cannot_be_removed(engine) -> None:  # type: ignore[no-untyped-def]
    with engine.begin() as c:
        org, user, _ = seed_org(c, "Solo")
    with engine.connect() as c, pytest.raises((IntegrityError, DBAPIError)), tenant(c, org, user):
        c.execute(text("update memberships set status = 'suspended' where user_id = :u"), {"u": user})


def test_every_tenant_table_has_forced_rls_and_a_policy(engine) -> None:  # type: ignore[no-untyped-def]
    """G-3: any table with an organization_id column must force RLS and carry a policy."""
    with engine.connect() as c:
        rows = c.execute(text("""
            select c.relname, c.relrowsecurity, c.relforcerowsecurity,
                   (select count(*) from pg_policy p where p.polrelid = c.oid)
            from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind = 'r'
              and (exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'organization_id')
                   or c.relname = 'organizations')
        """)).all()
    assert rows, "no tenant tables found"
    assert [r[0] for r in rows if not (r[1] and r[2] and r[3] > 0)] == []
