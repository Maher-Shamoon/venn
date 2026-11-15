import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Query

from app.core.tenancy import Ctx, require
from app.schemas.ledger import (
    AllocationIn,
    CancelIn,
    CustomerIn,
    CustomerOut,
    CustomerPatch,
    InvoiceDetail,
    InvoiceIn,
    InvoiceOut,
    ManualPaymentIn,
    Page,
    PaymentDetail,
    PaymentIn,
    PaymentOut,
    ReasonIn,
    ReviewIn,
)
from app.services import customers, invoices, payments

router = APIRouter(tags=["ledger"])
PageQ = Annotated[int, Query(ge=1)]
LimitQ = Annotated[int, Query(ge=1, le=100)]


def _version(if_match: str | None) -> int | None:
    try:
        return int(if_match.strip('"')) if if_match else None
    except ValueError:
        return None


# ---------------------------------------------------------------------------------------------------- customers
@router.get("/customers")
def list_customers(q: str | None = None, filter: str = "all", sort: str = "name", desc: bool = False, page: PageQ = 1, limit: LimitQ = 25,
                   ctx: Ctx = Depends(require("customers.view"))) -> Page[CustomerOut]:
    rows, total = customers.list_customers(ctx.db, ctx.today(), q, filter, sort, desc, page, limit)
    return Page(data=rows, total=total, page=page, limit=limit)


@router.post("/customers", status_code=201)
def create_customer(body: CustomerIn, ctx: Ctx = Depends(require("customers.manage"))) -> CustomerOut:
    return customers.create(ctx.db, ctx.org_id, ctx.user, body, ctx.today(), ctx.info)


@router.get("/customers/{cid}")
def get_customer(cid: uuid.UUID, ctx: Ctx = Depends(require("customers.view"))) -> CustomerOut:
    return customers.get(ctx.db, ctx.today(), cid)


@router.patch("/customers/{cid}")
def patch_customer(cid: uuid.UUID, body: CustomerPatch, ctx: Ctx = Depends(require("customers.manage")), if_match: str | None = Header(default=None)) -> CustomerOut:
    return customers.update(ctx.db, ctx.org_id, ctx.user, cid, body, _version(if_match), ctx.today(), ctx.info)


# ----------------------------------------------------------------------------------------------------- invoices
@router.get("/invoices")
def list_invoices(tab: str = "all", customer_id: uuid.UUID | None = None, q: str | None = None, sort: str = "due", desc: bool = True,
                  page: PageQ = 1, limit: LimitQ = 25, ctx: Ctx = Depends(require("invoices.view"))) -> Page[InvoiceOut]:
    rows, total = invoices.list_invoices(ctx.db, ctx.today(), tab, customer_id, q, sort, desc, page, limit)
    return Page(data=rows, total=total, page=page, limit=limit)


@router.post("/invoices", status_code=201)
def create_invoice(body: InvoiceIn, ctx: Ctx = Depends(require("invoices.manage"))) -> InvoiceDetail:
    return invoices.create(ctx.db, ctx.org_id, ctx.user, body, ctx.today(), ctx.info)


@router.get("/invoices/{iid}")
def get_invoice(iid: uuid.UUID, ctx: Ctx = Depends(require("invoices.view"))) -> InvoiceDetail:
    return invoices.get(ctx.db, ctx.today(), iid)


@router.post("/invoices/{iid}/cancel")
def cancel_invoice(iid: uuid.UUID, body: CancelIn, ctx: Ctx = Depends(require("invoices.manage"))) -> InvoiceDetail:
    return invoices.cancel(ctx.db, ctx.org_id, ctx.user, iid, body.reason, ctx.today(), ctx.info)


@router.post("/invoices/{iid}/payments", status_code=201)
def record_payment(iid: uuid.UUID, body: ManualPaymentIn, ctx: Ctx = Depends(require("payments.manage"))) -> PaymentDetail:
    when = body.payment_date or ctx.today()
    return payments.record_for_invoice(ctx.db, ctx.org_id, ctx.user, iid, body.amount, body.method, body.reference, when, ctx.info)


# ----------------------------------------------------------------------------------------------------- payments
@router.get("/payments")
def list_payments(tab: str = "all", customer_id: uuid.UUID | None = None, q: str | None = None, sort: str = "date", desc: bool = True,
                  page: PageQ = 1, limit: LimitQ = 25, ctx: Ctx = Depends(require("payments.view"))) -> Page[PaymentOut]:
    rows, total = payments.list_payments(ctx.db, tab, customer_id, q, sort, desc, page, limit)
    return Page(data=rows, total=total, page=page, limit=limit)


@router.post("/payments", status_code=201)
def create_payment(body: PaymentIn, ctx: Ctx = Depends(require("payments.manage"))) -> PaymentDetail:
    return payments.create(ctx.db, ctx.org_id, ctx.user, body, ctx.info)


@router.get("/payments/{pid}")
def get_payment(pid: uuid.UUID, ctx: Ctx = Depends(require("payments.view"))) -> PaymentDetail:
    return payments.get(ctx.db, pid)


@router.post("/payments/{pid}/allocations", status_code=201)
def allocate(pid: uuid.UUID, body: AllocationIn, ctx: Ctx = Depends(require("reconciliation.allocate"))) -> PaymentDetail:
    return payments.allocate(ctx.db, ctx.org_id, ctx.user, pid, body.invoice_id, body.amount, "manual", ctx.info)


@router.post("/allocations/{aid}/void")
def void_allocation(aid: uuid.UUID, body: ReasonIn, ctx: Ctx = Depends(require("reconciliation.allocate"))) -> PaymentDetail:
    return payments.void_allocation(ctx.db, ctx.org_id, ctx.user, aid, body.reason, ctx.info)


@router.post("/payments/{pid}/reverse")
def reverse_payment(pid: uuid.UUID, body: ReasonIn, ctx: Ctx = Depends(require("payments.manage"))) -> PaymentDetail:
    return payments.reverse(ctx.db, ctx.org_id, ctx.user, pid, body.reason, ctx.info)


@router.post("/payments/{pid}/review")
def review_payment(pid: uuid.UUID, body: ReviewIn, ctx: Ctx = Depends(require("payments.manage"))) -> PaymentDetail:
    return payments.set_review(ctx.db, ctx.org_id, ctx.user, pid, body.under_review, ctx.info)
