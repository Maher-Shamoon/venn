"""invitations: single-use hashed tokens, one pending invitation per email per organization

Revision ID: 0005
Revises: 0004
Create Date: 2026-11-15
"""
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None

ORG = "nullif(current_setting('app.org_id', true), '')::uuid"
HASH = "nullif(current_setting('app.invite_hash', true), '')"


def upgrade() -> None:
    op.execute("""
        create table invitations (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          email text not null,
          role_id uuid not null,
          token_hash bytea not null unique,
          status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
          expires_at timestamptz not null,
          invited_by uuid not null references profiles (id),
          accepted_by uuid references profiles (id),
          accepted_at timestamptz,
          last_sent_at timestamptz not null default now(),
          send_count integer not null default 1,
          created_at timestamptz not null default now(),
          foreign key (role_id, organization_id) references roles (id, organization_id)
        )
    """)
    op.execute("create unique index invitations_one_pending on invitations (organization_id, lower(email)) "
               "where status = 'pending'")
    op.execute("alter table invitations enable row level security")
    op.execute("alter table invitations force row level security")
    op.execute(f"create policy tenant_isolation on invitations using (organization_id = {ORG}) "
               f"with check (organization_id = {ORG})")
    # Someone holding a token can read and accept exactly that invitation, with no organization context yet.
    # The endpoint sets app.invite_hash to the SHA-256 of the presented token; there is no way to enumerate.
    op.execute(f"create policy by_token on invitations using (encode(token_hash, 'hex') = {HASH}) "
               f"with check (encode(token_hash, 'hex') = {HASH})")
    op.execute("grant select, insert, update on invitations to venn_app")


def downgrade() -> None:
    op.execute("drop table if exists invitations cascade")
