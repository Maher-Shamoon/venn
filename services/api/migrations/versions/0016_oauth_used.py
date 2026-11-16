"""Remembers which OAuth states were already used, so a leaked connect link cannot be replayed.

Revision ID: 0016
Revises: 0015
Create Date: 2026-11-16
"""
from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # No organization column: the nonce is random and says nothing about anyone.
    op.execute("create table oauth_used (nonce text primary key, used_at timestamptz not null default now())")
    op.execute("grant select, insert, delete on oauth_used to venn_app")


def downgrade() -> None:
    op.execute("drop table if exists oauth_used")
