"""Approvals and adjustments: requests, immutable decisions, executed adjustments and per-type policies

Revision ID: 0010
Revises: 0009
Create Date: 2026-11-15
"""
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

ORG = "nullif(current_setting('app.org_id', true), '')::uuid"
TYPES = "('write_off', 'credit', 'refund_due')"


def upgrade() -> None:
    op.execute(f"""
        create table approval_requests (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          number text not null,
          type text not null check (type in {TYPES}),
          invoice_id uuid not null,
          amount numeric(19,4) not null check (amount > 0),
          currency char(3) not null,
          reason text not null check (length(btrim(reason)) > 0),
          status text not null default 'pending' check (status in ('pending', 'info_requested', 'approved', 'rejected', 'withdrawn', 'expired')),
          requested_by uuid not null references profiles (id),
          requested_at timestamptz not null default now(),
          balance_at_request numeric(19,4) not null,
          expires_at timestamptz not null,
          decided_at timestamptz,
          version integer not null default 1,
          unique (id, organization_id),
          unique (organization_id, number),
          foreign key (invoice_id, organization_id) references invoices (id, organization_id)
        )
    """)
    op.execute("create index approval_requests_status on approval_requests (organization_id, status, requested_at desc)")
    op.execute("""
        create table approval_decisions (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null,
          request_id uuid not null,
          decision text not null check (decision in ('approve', 'reject', 'request_info', 'reply', 'withdraw', 'expire', 'auto_approve')),
          comment text,
          decided_by uuid references profiles (id),
          created_at timestamptz not null default now(),
          foreign key (request_id, organization_id) references approval_requests (id, organization_id) on delete cascade
        )
    """)
    op.execute(f"""
        create table adjustments (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null,
          invoice_id uuid not null,
          approval_id uuid not null,
          type text not null check (type in {TYPES}),
          amount numeric(19,4) not null check (amount > 0),
          currency char(3) not null,
          reason text not null,
          affects_balance boolean not null,
          created_by uuid references profiles (id),
          created_at timestamptz not null default now(),
          foreign key (invoice_id, organization_id) references invoices (id, organization_id),
          foreign key (approval_id, organization_id) references approval_requests (id, organization_id)
        )
    """)
    op.execute(f"""
        create table approval_policies (
          organization_id uuid not null references organizations (id) on delete cascade,
          type text not null check (type in {TYPES}),
          auto_approve_below numeric(19,4) not null default 0 check (auto_approve_below >= 0),
          expiry_days integer not null default 30 check (expiry_days between 1 and 365),
          primary key (organization_id, type)
        )
    """)
    for t in ("approval_requests", "approval_decisions", "adjustments", "approval_policies"):
        op.execute(f"alter table {t} enable row level security")
        op.execute(f"alter table {t} force row level security")
        op.execute(f"create policy tenant_isolation on {t} using (organization_id = {ORG}) with check (organization_id = {ORG})")
    op.execute("grant select, insert, update on approval_requests to venn_app")
    op.execute("grant select, insert on approval_decisions, adjustments to venn_app")
    op.execute("grant select, insert, update on approval_policies to venn_app")
    # Decisions and executed adjustments are history: the database refuses edits and deletes, whoever asks.
    op.execute("""
        create function refuse_change() returns trigger language plpgsql as $$
        begin
          raise exception '% is append-only', tg_table_name using errcode = '42501';
        end $$
    """)
    for t in ("approval_decisions", "adjustments"):
        op.execute(f"create trigger {t}_append_only before update or delete on {t} for each row execute function refuse_change()")
    # The stored adjusted amount on an invoice must equal the adjustments that reduce it.
    op.execute("""
        create function check_invoice_adjusted() returns trigger language plpgsql as $$
        begin
          if exists (select 1 from invoices i where i.id = new.id and i.amount_adjusted <>
               (select coalesce(sum(a.amount), 0) from adjustments a where a.invoice_id = i.id and a.affects_balance)) then
            raise exception 'invoice amount_adjusted does not match its adjustments' using errcode = '23514';
          end if;
          return null;
        end $$
    """)
    op.execute("create constraint trigger invoices_adjusted_matches after insert or update of amount_adjusted on invoices "
               "deferrable initially deferred for each row execute function check_invoice_adjusted()")


def downgrade() -> None:
    op.execute("drop trigger if exists invoices_adjusted_matches on invoices")
    op.execute("drop function if exists check_invoice_adjusted()")
    for t in ("approval_policies", "adjustments", "approval_decisions", "approval_requests"):
        op.execute(f"drop table if exists {t} cascade")
    op.execute("drop function if exists refuse_change()")
