"""Tidies data left behind by end-to-end runs in the development project: cancels open invoices and reverses
unallocated payments that belong to customers named 'QA Customer ...'. Refuses to run in production."""

from sqlalchemy import create_engine, text

from app.core.config import get_settings

s = get_settings()
if s.env == "production":
    raise SystemExit("refusing to run against production")

with create_engine(s.database_url).begin() as c:
    inv = c.execute(text(
        "update invoices set lifecycle_status = 'cancelled', cancelled_at = now(), cancel_reason = 'Test data cleanup', version = version + 1 "
        "where lifecycle_status = 'issued' and amount_paid = 0 and customer_id in (select id from customers where name like 'QA Customer%')")).rowcount
    pay = c.execute(text(
        "update payments set reversed_at = now(), reversal_reason = 'Test data cleanup', version = version + 1 "
        "where reversed_at is null and allocated_amount = 0 and customer_id in (select id from customers where name like 'QA Customer%')")).rowcount
    cus = c.execute(text("update customers set status = 'archived' where name like 'QA Customer%' and status = 'active' "
                         "and not exists (select 1 from invoices i where i.customer_id = customers.id and i.lifecycle_status = 'issued' and i.balance_due > 0)")).rowcount
print(f"cancelled {inv} invoices, reversed {pay} payments, archived {cus} customers")
