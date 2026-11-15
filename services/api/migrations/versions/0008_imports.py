"""CSV imports: a validated job with every row classified before anything is saved

Revision ID: 0008
Revises: 0007
Create Date: 2026-11-15
"""
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None

ORG = "nullif(current_setting('app.org_id', true), '')::uuid"


def upgrade() -> None:
    op.execute("""
        create table import_jobs (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          kind text not null check (kind in ('invoices', 'payments')),
          filename text not null,
          status text not null default 'validated' check (status in ('validated', 'committed', 'discarded')),
          headers jsonb not null default '[]',
          mapping jsonb not null default '{}',
          date_format text not null default 'iso' check (date_format in ('iso', 'dmy', 'mdy')),
          counts jsonb not null default '{}',
          created_by uuid references profiles (id),
          created_at timestamptz not null default now(),
          committed_at timestamptz,
          unique (id, organization_id)
        )
    """)
    op.execute("""
        create table import_rows (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null,
          job_id uuid not null,
          row_number integer not null,
          raw jsonb not null,
          class text not null default 'valid' check (class in ('valid', 'warning', 'error', 'duplicate')),
          messages jsonb not null default '[]',
          data jsonb,
          foreign key (job_id, organization_id) references import_jobs (id, organization_id) on delete cascade,
          unique (job_id, row_number)
        )
    """)
    op.execute("create index import_rows_class on import_rows (job_id, class, row_number)")
    for t in ("import_jobs", "import_rows"):
        op.execute(f"alter table {t} enable row level security")
        op.execute(f"alter table {t} force row level security")
        op.execute(f"create policy tenant_isolation on {t} using (organization_id = {ORG}) with check (organization_id = {ORG})")
        op.execute(f"grant select, insert, update, delete on {t} to venn_app")


def downgrade() -> None:
    op.execute("drop table if exists import_rows cascade")
    op.execute("drop table if exists import_jobs cascade")
