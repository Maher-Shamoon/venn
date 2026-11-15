"""Tidies data left behind by end-to-end runs in the development project: cancels open invoices and reverses
unallocated payments that belong to customers named 'QA ...'. Refuses to run in production."""

from sqlalchemy import create_engine, text

from app.core.config import get_settings

s = get_settings()
if s.env == "production":
    raise SystemExit("refusing to run against production")

with create_engine(s.database_url).begin() as c:
    apr = c.execute(text(
        "with w as (update approval_requests set status = 'withdrawn', decided_at = now() where status in ('pending', 'info_requested') and invoice_id in "
        "(select i.id from invoices i join customers c on c.id = i.customer_id where c.name like 'QA %') returning id, organization_id) "
        "insert into approval_decisions (organization_id, request_id, decision, comment) select organization_id, id, 'withdraw', 'Test data cleanup' from w")).rowcount
    inv = c.execute(text(
        "update invoices set lifecycle_status = 'cancelled', cancelled_at = now(), cancel_reason = 'Test data cleanup', version = version + 1 "
        "where lifecycle_status = 'issued' and amount_paid = 0 and customer_id in (select id from customers where name like 'QA %')")).rowcount
    pay = c.execute(text(
        "update payments set reversed_at = now(), reversal_reason = 'Test data cleanup', version = version + 1 "
        "where reversed_at is null and allocated_amount = 0 and customer_id in (select id from customers where name like 'QA %')")).rowcount
    cus = c.execute(text("update customers set status = 'archived' where name like 'QA %' and status = 'active' "
                         "and not exists (select 1 from invoices i where i.customer_id = customers.id and i.lifecycle_status = 'issued' and i.balance_due > 0)")).rowcount
print(f"withdrew {apr} approval requests, cancelled {inv} invoices, reversed {pay} payments, archived {cus} customers")
