"""AI explanations stored beside each analysis version

Revision ID: 0014
Revises: 0013
Create Date: 2026-11-16
"""
from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("alter table investigation_analyses add column ai jsonb")


def downgrade() -> None:
    op.execute("alter table investigation_analyses drop column ai")
