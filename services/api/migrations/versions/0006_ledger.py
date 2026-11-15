"""core ledger: customers, invoices, line items, payments, allocations, sequences, integrity triggers

Revision ID: 0006
Revises: 0005
Create Date: 2026-11-15
"""
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None

ORG = "nullif(current_setting('app.org_id', true), '')::uuid"
TENANT_TABLES = ["customers", "invoices", "invoice_line_items", "payments", "payment_allocations", "org_sequences"]


def upgrade() -> None:
    op.execute("""
        create table org_sequences (
          organization_id uuid not null references organizations (id) on delete cascade,
          kind text not null,
          next_value bigint not null default 1,
          primary key (organization_id, kind)
        )
    """)
    # Human-readable numbers (INV-0001, PAY-0001) taken inside the creating transaction.
    op.execute("""
        create function next_number(org uuid, k text, prefix text, width int default 4) returns text language sql as $$
          with n as (
            insert into org_sequences (organization_id, kind, next_value) values (org, k, 2)
            on conflict (organization_id, kind) do update set next_value = org_sequences.next_value + 1
            returning next_value - 1 as v
          ) select prefix || '-' || lpad(v::text, width, '0') from n
        $$
    """)

    op.execute("""
        create table customers (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          name text not null check (length(btrim(name)) > 0),
          legal_name text,
          tax_id text,
          contact_name text,
          contact_email text,
          city text,
          external_id text,
          source text,
          default_currency char(3),
          payment_terms_days integer check (payment_terms_days is null or payment_terms_days >= 0),
          payer_aliases text[] not null default '{}',
          notes text,
          status text not null default 'active' check (status in ('active', 'archived')),
          version integer not null default 1,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (id, organization_id)
        )
    """)
    op.execute("create unique index customers_name_key on customers (organization_id, lower(name)) where status = 'active'")
    op.execute("create unique index customers_external_key on customers (organization_id, source, external_id) where external_id is not null")
    op.execute("create index customers_aliases on customers using gin (payer_aliases)")

    op.execute("""
        create table invoices (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          customer_id uuid not null,
          invoice_number text not null check (length(btrim(invoice_number)) > 0),
          po_number text,
          issue_date date not null,
          due_date date not null,
          currency char(3) not null,
          subtotal_amount numeric(19,4),
          tax_amount numeric(19,4),
          total_amount numeric(19,4) not null check (total_amount > 0),
          amount_paid numeric(19,4) not null default 0 check (amount_paid >= 0),
          amount_adjusted numeric(19,4) not null default 0 check (amount_adjusted >= 0),
          balance_due numeric(19,4) not null,
          lifecycle_status text not null default 'issued' check (lifecycle_status in ('draft', 'issued', 'cancelled')),
          cancelled_at timestamptz,
          cancel_reason text,
          description text,
          source text,
          external_id text,
          import_batch_id uuid,
          version integer not null default 1,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (id, organization_id),
          foreign key (customer_id, organization_id) references customers (id, organization_id),
          check (due_date >= issue_date),
          check (balance_due >= 0 and balance_due = total_amount - amount_paid - amount_adjusted)
        )
    """)
    op.execute("create unique index invoices_number_key on invoices (organization_id, customer_id, invoice_number) "
               "where lifecycle_status <> 'cancelled'")
    op.execute("create unique index invoices_external_key on invoices (organization_id, source, external_id) where external_id is not null")
    op.execute("create index invoices_overdue on invoices (organization_id, due_date) where balance_due > 0 and lifecycle_status = 'issued'")
    op.execute("create index invoices_customer on invoices (organization_id, customer_id)")
    op.execute("create index invoices_number on invoices (organization_id, invoice_number)")

    op.execute("""
        create table invoice_line_items (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null,
          invoice_id uuid not null,
          position integer not null,
          description text not null,
          quantity numeric(19,4) not null check (quantity > 0),
          unit_price numeric(19,4) not null check (unit_price >= 0),
          amount numeric(19,4) not null,
          tax_amount numeric(19,4),
          foreign key (invoice_id, organization_id) references invoices (id, organization_id) on delete cascade,
          unique (invoice_id, position)
        )
    """)

    op.execute("""
        create table payments (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null references organizations (id) on delete cascade,
          number text not null,
          customer_id uuid,
          direction text not null default 'in' check (direction in ('in', 'out')),
          payment_date date not null,
          amount numeric(19,4) not null check (amount > 0),
          currency char(3) not null,
          allocated_amount numeric(19,4) not null default 0,
          method text,
          reference text,
          memo text,
          payer_name_raw text,
          verification_level text not null default 'manual' check (verification_level in ('source_verified', 'manual')),
          under_review boolean not null default false,
          reversed_at timestamptz,
          reversal_reason text,
          source text,
          external_id text,
          import_batch_id uuid,
          fingerprint text,
          version integer not null default 1,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          unique (id, organization_id),
          unique (organization_id, number),
          foreign key (customer_id, organization_id) references customers (id, organization_id),
          check (allocated_amount >= 0 and allocated_amount <= amount)
        )
    """)
    op.execute("create unique index payments_external_key on payments (organization_id, source, external_id) where external_id is not null")
    op.execute("create unique index payments_fingerprint_key on payments (organization_id, fingerprint) where fingerprint is not null")
    op.execute("create index payments_date on payments (organization_id, payment_date)")
    op.execute("create index payments_unallocated on payments (organization_id) where allocated_amount < amount and reversed_at is null")

    op.execute("""
        create table payment_allocations (
          id uuid primary key default gen_random_uuid(),
          organization_id uuid not null,
          payment_id uuid not null,
          invoice_id uuid not null,
          amount numeric(19,4) not null check (amount > 0),
          currency char(3) not null,
          method text not null default 'manual' check (method in ('auto_rule', 'suggestion_confirmed', 'manual')),
          reconciliation_match_id uuid,
          created_by uuid,
          created_at timestamptz not null default now(),
          voided_at timestamptz,
          voided_by uuid,
          void_reason text,
          foreign key (payment_id, organization_id) references payments (id, organization_id),
          foreign key (invoice_id, organization_id) references invoices (id, organization_id)
        )
    """)
    op.execute("create unique index allocations_active on payment_allocations (payment_id, invoice_id) where voided_at is null")
    op.execute("create index allocations_invoice on payment_allocations (organization_id, invoice_id)")

    # Defence in depth: whatever the application does, the stored totals must equal the active allocations.
    op.execute("""
        create function check_allocation_integrity() returns trigger language plpgsql as $$
        declare pid uuid := coalesce(new.payment_id, old.payment_id); iid uuid := coalesce(new.invoice_id, old.invoice_id);
        begin
          if exists (select 1 from payments p where p.id = pid and p.allocated_amount <>
               (select coalesce(sum(a.amount), 0) from payment_allocations a where a.payment_id = pid and a.voided_at is null)) then
            raise exception 'payment allocated_amount does not match its allocations' using errcode = '23514';
          end if;
          if exists (select 1 from invoices i where i.id = iid and i.amount_paid <>
               (select coalesce(sum(a.amount), 0) from payment_allocations a where a.invoice_id = iid and a.voided_at is null)) then
            raise exception 'invoice amount_paid does not match its allocations' using errcode = '23514';
          end if;
          if tg_op = 'INSERT' and exists (
               select 1 from payments p join invoices i on i.id = iid and i.organization_id = p.organization_id
               where p.id = pid and (p.currency <> i.currency or i.lifecycle_status = 'cancelled' or p.reversed_at is not null)) then
            raise exception 'allocation needs the same currency and an open invoice and payment' using errcode = '23514';
          end if;
          return null;
        end $$
    """)
    op.execute("create constraint trigger allocations_integrity after insert or update on payment_allocations "
               "deferrable initially deferred for each row execute function check_allocation_integrity()")

    for t in TENANT_TABLES:
        op.execute(f"alter table {t} enable row level security")
        op.execute(f"alter table {t} force row level security")
        op.execute(f"create policy tenant_isolation on {t} using (organization_id = {ORG}) with check (organization_id = {ORG})")
        op.execute(f"grant select, insert, update on {t} to venn_app")


def downgrade() -> None:
    for t in ["payment_allocations", "payments", "invoice_line_items", "invoices", "customers", "org_sequences"]:
        op.execute(f"drop table if exists {t} cascade")
    op.execute("drop function if exists check_allocation_integrity()")
    op.execute("drop function if exists next_number(uuid, text, text, int)")
