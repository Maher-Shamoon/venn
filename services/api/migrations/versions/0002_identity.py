"""identity and tenancy: profiles, organizations, roles, permissions, memberships, forced RLS

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-15
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

# Snapshot of the permission catalog at this revision (docs/planning/ROLE_PERMISSION_MATRIX.md).
PERMISSIONS = [
    ("dashboard.executive", "dashboard", True), ("dashboard.operational", "dashboard", True),
    ("customers.view", "customers", True), ("customers.manage", "customers", True),
    ("invoices.view", "invoices", True), ("invoices.manage", "invoices", True),
    ("invoices.import", "invoices", True),
    ("payments.view", "payments", True), ("payments.manage", "payments", True),
    ("payments.import", "payments", True),
    ("reconciliation.run", "reconciliation", True), ("reconciliation.allocate", "reconciliation", True),
    ("investigations.view", "investigations", True), ("investigations.manage", "investigations", True),
    ("investigations.assign", "investigations", True),
    ("collections.view", "collections", True), ("collections.draft", "collections", True),
    ("collections.send", "collections", True),
    ("disputes.view", "disputes", True), ("disputes.manage", "disputes", True),
    ("documents.view", "documents", True), ("documents.upload", "documents", True),
    ("adjustments.request", "approvals", True),
    ("approvals.view_own", "approvals", True), ("approvals.decide", "approvals", False),
    ("analytics.view", "analytics", True),
    ("reports.operational", "analytics", True), ("reports.financial", "analytics", True),
    ("reports.export", "analytics", True),
    ("integrations.view", "integrations", True), ("integrations.manage", "integrations", False),
    ("team.view", "team", True), ("team.manage", "team", False),
    ("audit.view", "audit", True),
    ("settings.view", "settings", True), ("settings.manage", "settings", False),
    ("remittance.manage", "settings", False),
]

TENANT_TABLES = ["roles", "role_permissions", "memberships"]
ORG = "nullif(current_setting('app.org_id', true), '')::uuid"
USER = "nullif(current_setting('app.user_id', true), '')::uuid"


def upgrade() -> None:
    # The API sets this role for every transaction (SET LOCAL ROLE), so tenancy is enforced even when
    # the connection user owns the tables. It is not the owner and has no BYPASSRLS.
    op.execute(
        "do $$ begin if not exists (select from pg_roles where rolname = 'venn_app') "
        "then create role venn_app nologin; end if; end $$"
    )
    op.execute("grant venn_app to current_user")

    op.execute("""
        create table profiles (
          id uuid primary key,
          email text not null,
          full_name text not null,
          last_active_org_id uuid,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
    """)
    op.execute("create unique index profiles_email_key on profiles (lower(email))")
    # In Supabase the profile id is the auth user id; tie them together when the auth schema exists.
    op.execute(
        "do $$ begin if to_regclass('auth.users') is not null then "
        "alter table profiles add constraint profiles_auth_fk "
        "foreign key (id) references auth.users (id) on delete restrict; end if; end $$"
    )

    op.execute("""
        create table organizations (
          id uuid primary key,
          name text not null check (length(btrim(name)) > 0),
          legal_name text,
          website text,
          industry text not null default 'other',
          company_size text not null default '11-50',
          country char(2) not null default 'US',
          default_currency char(3) not null default 'USD',
          timezone text not null default 'UTC',
          settings jsonb not null default '{}'::jsonb,
          onboarding_state jsonb not null default '{}'::jsonb,
          status text not null default 'active'
            check (status in ('active', 'suspended', 'deletion_requested')),
          created_by uuid references profiles (id),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          version integer not null default 1
        )
    """)
    op.execute(
        "alter table profiles add foreign key (last_active_org_id) "
        "references organizations (id) on delete set null"
    )

    op.execute("""
        create table permissions (
          key text primary key,
          grp text not null,
          grantable_to_non_owner boolean not null
        )
    """)
    values = ", ".join(f"('{k}', '{g}', {str(t).lower()})" for k, g, t in PERMISSIONS)
    op.execute(f"insert into permissions (key, grp, grantable_to_non_owner) values {values}")

    op.execute("""
        create table roles (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          key text not null,
          name text not null,
          is_system boolean not null default true,
          is_locked boolean not null default false,
          unique (organization_id, key),
          unique (id, organization_id)
        )
    """)
    op.execute("""
        create table role_permissions (
          role_id uuid not null,
          organization_id uuid not null,
          permission_key text not null references permissions (key),
          primary key (role_id, permission_key),
          foreign key (role_id, organization_id)
            references roles (id, organization_id) on delete cascade
        )
    """)
    op.execute("""
        create table memberships (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          user_id uuid not null references profiles (id),
          role_id uuid not null,
          status text not null default 'active'
            check (status in ('active', 'suspended', 'removed')),
          invited_by uuid references profiles (id),
          joined_at timestamptz not null default now(),
          suspended_at timestamptz,
          unique (organization_id, user_id),
          foreign key (role_id, organization_id) references roles (id, organization_id)
        )
    """)
    op.execute("create index memberships_user_status on memberships (user_id, status)")

    # An organization can never be left without an active owner. Checked at commit, so a role swap
    # inside one transaction is allowed.
    op.execute("""
        create function check_has_owner() returns trigger language plpgsql as $$
        declare org uuid := coalesce(new.organization_id, old.organization_id);
        begin
          if exists (select 1 from organizations o where o.id = org)
             and not exists (
               select 1 from memberships m
               join roles r on r.id = m.role_id and r.organization_id = m.organization_id
               where m.organization_id = org and m.status = 'active' and r.key = 'owner') then
            raise exception 'organization must keep at least one active owner' using errcode = '23514';
          end if;
          return null;
        end $$
    """)
    op.execute(
        "create constraint trigger memberships_keep_owner after update or delete on memberships "
        "deferrable initially deferred for each row execute function check_has_owner()"
    )

    # Tenant isolation: with no organization set, no rows match (fails closed).
    for t in TENANT_TABLES:
        op.execute(f"alter table {t} enable row level security")
        op.execute(f"alter table {t} force row level security")
        op.execute(
            f"create policy tenant_isolation on {t} "
            f"using (organization_id = {ORG}) with check (organization_id = {ORG})"
        )
    op.execute("alter table organizations enable row level security")
    op.execute("alter table organizations force row level security")
    op.execute(
        f"create policy tenant_isolation on organizations using (id = {ORG}) with check (id = {ORG})"
    )
    op.execute("alter table profiles enable row level security")
    op.execute("alter table profiles force row level security")
    op.execute(
        f"create policy self_or_colleague on profiles "
        f"using (id = {USER} or exists (select 1 from memberships m where m.user_id = profiles.id)) "
        f"with check (id = {USER})"
    )

    # A signed-in user can always read their own memberships and those organizations and roles, so
    # "which organizations am I in?" needs no organization context and no SECURITY DEFINER function.
    op.execute(f"create policy own_memberships on memberships for select using (user_id = {USER})")
    op.execute(
        f"create policy member_organizations on organizations for select using (exists "
        f"(select 1 from memberships m where m.organization_id = organizations.id and m.user_id = {USER}))"
    )
    op.execute(
        f"create policy member_roles on roles for select using (exists "
        f"(select 1 from memberships m where m.organization_id = roles.organization_id and m.user_id = {USER}))"
    )

    op.execute("grant usage on schema public to venn_app")
    op.execute("grant select on permissions to venn_app")
    op.execute("grant select, insert, update on profiles, organizations, roles, memberships to venn_app")
    op.execute("grant select, insert, delete on role_permissions to venn_app")


def downgrade() -> None:
    for t in ["memberships", "role_permissions", "roles", "permissions", "organizations", "profiles"]:
        op.execute(f"drop table if exists {t} cascade")
    op.execute("drop function if exists check_has_owner()")
