"""Connected sources per organization. Secrets are stored encrypted, never returned.

Revision ID: 0015
Revises: 0014
Create Date: 2026-11-16
"""
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None

ORG = "nullif(current_setting('app.org_id', true), '')::uuid"


def upgrade() -> None:
    op.execute("""
        create table integrations (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          provider text not null check (provider in ('stripe', 'gmail', 'quickbooks')),
          status text not null default 'connected' check (status in ('connected', 'error')),
          secret_enc text not null,
          account_label text,
          connected_by uuid references profiles (id),
          connected_at timestamptz not null default now(),
          last_sync_at timestamptz,
          last_error text,
          unique (organization_id, provider)
        )
    """)
    op.execute("alter table integrations enable row level security")
    op.execute("alter table integrations force row level security")
    op.execute(f"create policy tenant_isolation on integrations using (organization_id = {ORG}) with check (organization_id = {ORG})")
    op.execute("grant select, insert, update, delete on integrations to venn_app")


def downgrade() -> None:
    op.execute("drop table if exists integrations cascade")
