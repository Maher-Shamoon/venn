"""Reconciliation: runs, match suggestions and discrepancies

Revision ID: 0009
Revises: 0008
Create Date: 2026-11-15
"""
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None

ORG = "nullif(current_setting('app.org_id', true), '')::uuid"


def upgrade() -> None:
    op.execute("""
        create table recon_runs (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          started_by uuid references profiles (id),
          started_at timestamptz not null default now(),
          counts jsonb not null default '{}'
        )
    """)
    op.execute("""
        create table recon_suggestions (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          run_id uuid references recon_runs (id) on delete set null,
          payment_id uuid not null,
          rule text not null,
          confidence text not null check (confidence in ('exact', 'high', 'medium')),
          allocations jsonb not null,
          reason text not null,
          status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'stale')),
          decided_by uuid references profiles (id),
          decided_at timestamptz,
          decision_note text,
          created_at timestamptz not null default now(),
          foreign key (payment_id, organization_id) references payments (id, organization_id) on delete cascade
        )
    """)
    op.execute("create unique index recon_one_pending on recon_suggestions (payment_id) where status = 'pending'")
    op.execute("""
        create table discrepancies (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          run_id uuid references recon_runs (id) on delete set null,
          type text not null check (type in ('short_payment', 'overpayment', 'duplicate_payment', 'currency_mismatch')),
          payment_id uuid,
          invoice_id uuid,
          exposure numeric(18, 4) not null default 0,
          detail text not null,
          status text not null default 'open' check (status in ('open', 'resolved')),
          resolved_by uuid references profiles (id),
          resolved_at timestamptz,
          resolution_note text,
          created_at timestamptz not null default now()
        )
    """)
    op.execute("create unique index discrepancy_one_open on discrepancies (type, coalesce(payment_id, '00000000-0000-0000-0000-000000000000'), "
               "coalesce(invoice_id, '00000000-0000-0000-0000-000000000000')) where status = 'open'")
    for t in ("recon_runs", "recon_suggestions", "discrepancies"):
        op.execute(f"alter table {t} enable row level security")
        op.execute(f"alter table {t} force row level security")
        op.execute(f"create policy tenant_isolation on {t} using (organization_id = {ORG}) with check (organization_id = {ORG})")
        op.execute(f"grant select, insert, update, delete on {t} to venn_app")


def downgrade() -> None:
    for t in ("discrepancies", "recon_suggestions", "recon_runs"):
        op.execute(f"drop table if exists {t} cascade")
