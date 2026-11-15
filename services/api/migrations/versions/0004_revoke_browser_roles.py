"""the browser never queries data directly: revoke Supabase's anon/authenticated grants

Supabase exposes every table in `public` through its REST API and grants the `anon` and `authenticated` roles
access by default. All venn data goes through the API (architecture decision A-1), so those roles get nothing.
No-op on databases without those roles (local and CI PostgreSQL).

Revision ID: 0004
Revises: 0003
Create Date: 2026-11-15
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None

ROLES = ("anon", "authenticated")


def upgrade() -> None:
    for role in ROLES:
        op.execute(f"""
            do $$ begin
              if exists (select from pg_roles where rolname = '{role}') then
                revoke all on all tables in schema public from {role};
                revoke all on all sequences in schema public from {role};
                revoke all on all functions in schema public from {role};
                alter default privileges in schema public revoke all on tables from {role};
                alter default privileges in schema public revoke all on sequences from {role};
                alter default privileges in schema public revoke all on functions from {role};
              end if;
            end $$
        """)


def downgrade() -> None:
    pass  # re-granting browser access would be a security regression; do it by hand if ever needed
