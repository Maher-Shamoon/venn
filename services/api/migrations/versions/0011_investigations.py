"""Investigations: cases, versioned analyses, a timeline and linked evidence

Revision ID: 0011
Revises: 0010
Create Date: 2026-11-15
"""
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None

ORG = "nullif(current_setting('app.org_id', true), '')::uuid"


def upgrade() -> None:
    op.execute("""
        create table investigations (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          number text not null,
          type text not null check (type in ('short_payment', 'overpayment', 'duplicate_payment', 'currency_mismatch', 'manual')),
          title text not null,
          status text not null default 'new' check (status in ('new', 'in_progress', 'ready_for_review', 'awaiting_approval', 'monitoring', 'resolved', 'dismissed')),
          priority text not null default 'low' check (priority in ('critical', 'high', 'medium', 'low')),
          priority_overridden boolean not null default false,
          exposure numeric(19,4) not null default 0,
          currency char(3) not null,
          customer_id uuid,
          invoice_id uuid,
          payment_id uuid,
          discrepancy_id uuid,
          approval_id uuid,
          assignee_id uuid references profiles (id),
          analysis_version integer not null default 0,
          analysis_status text not null default 'none' check (analysis_status in ('none', 'completed', 'insufficient_evidence', 'failed')),
          analyzed_at timestamptz,
          resolution text,
          resolved_at timestamptz,
          dismiss_reason text,
          created_by uuid references profiles (id),
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          version integer not null default 1,
          unique (id, organization_id),
          unique (organization_id, number),
          foreign key (customer_id, organization_id) references customers (id, organization_id),
          foreign key (invoice_id, organization_id) references invoices (id, organization_id),
          foreign key (payment_id, organization_id) references payments (id, organization_id)
        )
    """)
    op.execute("create unique index investigations_one_per_discrepancy on investigations (discrepancy_id) where discrepancy_id is not null")
    op.execute("create index investigations_board on investigations (organization_id, status, created_at desc)")
    op.execute("""
        create table investigation_analyses (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null,
          investigation_id uuid not null,
          version integer not null,
          status text not null check (status in ('completed', 'insufficient_evidence', 'failed')),
          summary text not null,
          findings jsonb not null default '[]',
          recommendation jsonb,
          snapshot jsonb not null default '{}',
          engine text not null default 'rules-1',
          created_by uuid references profiles (id),
          created_at timestamptz not null default now(),
          unique (investigation_id, version),
          foreign key (investigation_id, organization_id) references investigations (id, organization_id) on delete cascade
        )
    """)
    op.execute("""
        create table investigation_events (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null,
          investigation_id uuid not null,
          kind text not null check (kind in ('opened', 'note', 'status', 'assign', 'priority', 'evidence', 'analysis', 'action', 'resolved', 'dismissed')),
          text text not null,
          actor_id uuid references profiles (id),
          created_at timestamptz not null default now(),
          foreign key (investigation_id, organization_id) references investigations (id, organization_id) on delete cascade
        )
    """)
    op.execute("""
        create table investigation_evidence (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null,
          investigation_id uuid not null,
          type text not null check (type in ('invoice', 'payment', 'document', 'email', 'manual')),
          ref_id uuid,
          label text not null check (length(btrim(label)) > 0),
          tier text not null check (tier in ('accounting', 'bank', 'manual', 'claim')),
          added_by uuid references profiles (id),
          created_at timestamptz not null default now(),
          removed_at timestamptz,
          foreign key (investigation_id, organization_id) references investigations (id, organization_id) on delete cascade
        )
    """)
    op.execute("create index investigation_events_case on investigation_events (investigation_id, created_at)")
    op.execute("create index investigation_evidence_case on investigation_evidence (investigation_id) where removed_at is null")
    for t in ("investigations", "investigation_analyses", "investigation_events", "investigation_evidence"):
        op.execute(f"alter table {t} enable row level security")
        op.execute(f"alter table {t} force row level security")
        op.execute(f"create policy tenant_isolation on {t} using (organization_id = {ORG}) with check (organization_id = {ORG})")
    op.execute("grant select, insert, update on investigations, investigation_evidence to venn_app")
    op.execute("grant select, insert on investigation_analyses, investigation_events to venn_app")
    # Earlier analyses and the timeline are history.
    for t in ("investigation_analyses", "investigation_events"):
        op.execute(f"create trigger {t}_append_only before update or delete on {t} for each row execute function refuse_change()")


def downgrade() -> None:
    for t in ("investigation_evidence", "investigation_events", "investigation_analyses", "investigations"):
        op.execute(f"drop table if exists {t} cascade")
