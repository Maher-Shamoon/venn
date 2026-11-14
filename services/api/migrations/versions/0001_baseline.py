"""baseline: extensions

Revision ID: 0001
Revises:
Create Date: 2026-11-15
"""
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("create extension if not exists vector")


def downgrade() -> None:
    op.execute("drop extension if exists vector")
