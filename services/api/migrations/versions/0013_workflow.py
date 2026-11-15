"""Notifications, tasks, disputes and collections, and the final-notice approval type

Revision ID: 0013
Revises: 0012
Create Date: 2026-11-15
"""
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None

ORG = "nullif(current_setting('app.org_id', true), '')::uuid"
TABLES = ("notifications", "tasks", "disputes", "dispute_events", "collection_cases", "collection_events")


def upgrade() -> None:
    op.execute("""
        create table notifications (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          user_id uuid not null references profiles (id) on delete cascade,
          kind text not null,
          title text not null,
          body text,
          link text,
          dedupe_key text,
          read_at timestamptz,
          created_at timestamptz not null default now()
        )
    """)
    op.execute("create unique index notifications_once on notifications (organization_id, user_id, dedupe_key) where dedupe_key is not null")
    op.execute("create index notifications_inbox on notifications (organization_id, user_id, created_at desc)")
    op.execute("""
        create table tasks (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          title text not null check (length(btrim(title)) > 0),
          due_date date,
          assignee_id uuid references profiles (id),
          link text,
          system boolean not null default false,
          created_by uuid references profiles (id),
          created_at timestamptz not null default now(),
          done_at timestamptz
        )
    """)
    op.execute("""
        create table disputes (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          number text not null,
          invoice_id uuid not null,
          customer_id uuid not null,
          category text not null check (category in ('pricing', 'quantity', 'quality', 'duplicate_billing', 'missing_po', 'not_received', 'tax', 'already_paid', 'other')),
          amount numeric(19,4) not null check (amount > 0),
          currency char(3) not null,
          explanation text not null check (length(btrim(explanation)) > 0),
          status text not null default 'open' check (status in ('open', 'awaiting_customer', 'awaiting_approval', 'resolved')),
          outcome text check (outcome in ('upheld', 'partially_upheld', 'rejected')),
          outcome_note text,
          approval_id uuid,
          due_date date,
          created_by uuid references profiles (id),
          created_at timestamptz not null default now(),
          resolved_at timestamptz,
          version integer not null default 1,
          unique (id, organization_id),
          unique (organization_id, number),
          foreign key (invoice_id, organization_id) references invoices (id, organization_id),
          foreign key (customer_id, organization_id) references customers (id, organization_id)
        )
    """)
    op.execute("create index disputes_open on disputes (organization_id, status, created_at desc)")
    op.execute("create index disputes_invoice on disputes (invoice_id) where status <> 'resolved'")
    op.execute("""
        create table dispute_events (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null,
          dispute_id uuid not null,
          kind text not null check (kind in ('opened', 'note', 'status', 'resolved', 'approval')),
          text text not null,
          actor_id uuid references profiles (id),
          created_at timestamptz not null default clock_timestamp(),
          foreign key (dispute_id, organization_id) references disputes (id, organization_id) on delete cascade
        )
    """)
    op.execute("""
        create table collection_cases (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          number text not null,
          customer_id uuid not null,
          status text not null default 'active' check (status in ('active', 'closed')),
          stage text not null default 'reminder_1' check (stage in ('reminder_1', 'reminder_2', 'final_notice', 'promise')),
          next_action_date date,
          promise_date date,
          promise_amount numeric(19,4),
          broken_promise boolean not null default false,
          paused_reason text,
          final_approval_id uuid,
          final_approved boolean not null default false,
          last_sent_at timestamptz,
          created_at timestamptz not null default now(),
          version integer not null default 1,
          unique (id, organization_id),
          unique (organization_id, number),
          unique (organization_id, customer_id),
          foreign key (customer_id, organization_id) references customers (id, organization_id)
        )
    """)
    op.execute("""
        create table collection_events (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null,
          case_id uuid not null,
          kind text not null check (kind in ('opened', 'closed', 'reopened', 'draft', 'sent', 'marked_sent', 'stage', 'promise', 'promise_broken', 'note', 'paused', 'resumed', 'approval')),
          text text not null,
          actor_id uuid references profiles (id),
          created_at timestamptz not null default clock_timestamp(),
          foreign key (case_id, organization_id) references collection_cases (id, organization_id) on delete cascade
        )
    """)
    for t in TABLES:
        op.execute(f"alter table {t} enable row level security")
        op.execute(f"alter table {t} force row level security")
        op.execute(f"create policy tenant_isolation on {t} using (organization_id = {ORG}) with check (organization_id = {ORG})")
    op.execute("grant select, insert, update on notifications, tasks, disputes, collection_cases to venn_app")
    op.execute("grant select, insert on dispute_events, collection_events to venn_app")
    for t in ("dispute_events", "collection_events"):
        op.execute(f"create trigger {t}_append_only before update or delete on {t} for each row execute function refuse_change()")
    # A final notice is requested like any other adjustment, but changes no balance.
    op.execute("alter table approval_requests drop constraint approval_requests_type_check")
    op.execute("alter table approval_requests add constraint approval_requests_type_check check (type in ('write_off', 'credit', 'refund_due', 'final_notice'))")


def downgrade() -> None:
    op.execute("alter table approval_requests drop constraint approval_requests_type_check")
    op.execute("alter table approval_requests add constraint approval_requests_type_check check (type in ('write_off', 'credit', 'refund_due'))")
    for t in ("collection_events", "collection_cases", "dispute_events", "disputes", "tasks", "notifications"):
        op.execute(f"drop table if exists {t} cascade")
