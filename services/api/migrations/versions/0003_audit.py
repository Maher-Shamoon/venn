"""audit log: append-only, hash-chained per organization

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-15
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None

ORG = "nullif(current_setting('app.org_id', true), '')::uuid"


def upgrade() -> None:
    op.execute("""
        create table audit_events (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          seq bigint not null,
          occurred_at timestamptz not null default now(),
          actor_type text not null check (actor_type in ('user', 'system')),
          actor_id uuid,
          action text not null,
          record_type text,
          record_id text,
          before jsonb,
          after jsonb,
          request_id text,
          ip text,
          user_agent text,
          prev_hash bytea,
          hash bytea not null,
          unique (organization_id, seq)
        )
    """)
    op.execute("create index audit_events_org_time on audit_events (organization_id, seq desc)")
    op.execute("create index audit_events_record on audit_events (organization_id, record_type, record_id)")

    # Append-only for everyone, including the table owner: rows can never change or disappear.
    op.execute("""
        create function audit_events_immutable() returns trigger language plpgsql as $$
        begin
          raise exception 'audit_events is append-only' using errcode = '42501';
        end $$
    """)
    op.execute(
        "create trigger audit_events_no_update before update or delete on audit_events "
        "for each row execute function audit_events_immutable()"
    )
    op.execute("create trigger audit_events_no_truncate before truncate on audit_events "
               "for each statement execute function audit_events_immutable()")

    op.execute("alter table audit_events enable row level security")
    op.execute("alter table audit_events force row level security")
    op.execute(
        f"create policy tenant_isolation on audit_events using (organization_id = {ORG}) "
        f"with check (organization_id = {ORG})"
    )
    op.execute("grant select, insert on audit_events to venn_app")


def downgrade() -> None:
    op.execute("drop table if exists audit_events cascade")
    op.execute("drop function if exists audit_events_immutable()")
