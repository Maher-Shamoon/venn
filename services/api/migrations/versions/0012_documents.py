"""Documents: uploaded files with their extracted text, stored in the database

Revision ID: 0012
Revises: 0011
Create Date: 2026-11-15
"""
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None

ORG = "nullif(current_setting('app.org_id', true), '')::uuid"


def upgrade() -> None:
    op.execute("""
        create table documents (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          filename text not null,
          content_type text not null,
          size_bytes integer not null check (size_bytes > 0),
          sha256 text not null,
          extraction text not null check (extraction in ('done', 'none', 'failed')),
          extraction_note text,
          text_content text,
          page_count integer,
          uploaded_by uuid references profiles (id),
          created_at timestamptz not null default now(),
          deleted_at timestamptz,
          unique (id, organization_id)
        )
    """)
    op.execute("create unique index documents_one_per_content on documents (organization_id, sha256) where deleted_at is null")
    op.execute("""
        create table document_blobs (
          document_id uuid primary key,
          organization_id uuid not null,
          content bytea not null,
          foreign key (document_id, organization_id) references documents (id, organization_id) on delete cascade
        )
    """)
    for t in ("documents", "document_blobs"):
        op.execute(f"alter table {t} enable row level security")
        op.execute(f"alter table {t} force row level security")
        op.execute(f"create policy tenant_isolation on {t} using (organization_id = {ORG}) with check (organization_id = {ORG})")
    op.execute("grant select, insert, update on documents to venn_app")
    op.execute("grant select, insert on document_blobs to venn_app")


def downgrade() -> None:
    op.execute("drop table if exists document_blobs cascade")
    op.execute("drop table if exists documents cascade")
