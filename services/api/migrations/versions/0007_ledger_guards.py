"""stored totals must equal the allocations even when changed directly on invoices or payments

The checks re-read the row at commit time instead of trusting NEW: a deferred trigger fires once per
change, and an earlier change in the same transaction would otherwise be compared with a stale value.

Revision ID: 0007
Revises: 0006
Create Date: 2026-11-15
"""
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        create function check_invoice_paid() returns trigger language plpgsql as $$
        begin
          if exists (select 1 from invoices i where i.id = new.id and i.amount_paid <>
               (select coalesce(sum(a.amount), 0) from payment_allocations a where a.invoice_id = i.id and a.voided_at is null)) then
            raise exception 'invoice amount_paid does not match its allocations' using errcode = '23514';
          end if;
          return null;
        end $$
    """)
    op.execute("create constraint trigger invoices_paid_matches after insert or update of amount_paid on invoices "
               "deferrable initially deferred for each row execute function check_invoice_paid()")
    op.execute("""
        create function check_payment_allocated() returns trigger language plpgsql as $$
        begin
          if exists (select 1 from payments p where p.id = new.id and p.allocated_amount <>
               (select coalesce(sum(a.amount), 0) from payment_allocations a where a.payment_id = p.id and a.voided_at is null)) then
            raise exception 'payment allocated_amount does not match its allocations' using errcode = '23514';
          end if;
          return null;
        end $$
    """)
    op.execute("create constraint trigger payments_allocated_matches after insert or update of allocated_amount on payments "
               "deferrable initially deferred for each row execute function check_payment_allocated()")


def downgrade() -> None:
    op.execute("drop trigger if exists invoices_paid_matches on invoices")
    op.execute("drop trigger if exists payments_allocated_matches on payments")
    op.execute("drop function if exists check_invoice_paid()")
    op.execute("drop function if exists check_payment_allocated()")
