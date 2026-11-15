import uuid
from datetime import date, datetime
from typing import Generic, TypeVar

from pydantic import BaseModel, Field, field_validator

from app.core.money import Money

T = TypeVar("T")


class Page(BaseModel, Generic[T]):  # noqa: UP046
    data: list[T]
    total: int
    page: int
    limit: int


# ----------------------------------------------------------------------------------------------- customers
class CustomerIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    legal_name: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    city: str | None = None
    payment_terms_days: int | None = Field(default=None, ge=0, le=365)
    payer_aliases: list[str] = []
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Customer name is required.")
        return v.strip()

    @field_validator("contact_email")
    @classmethod
    def _email(cls, v: str | None) -> str | None:
        if v and not ("@" in v and "." in v.split("@")[-1] and " " not in v):
            raise ValueError("Enter a valid email address.")
        return v or None

    @field_validator("payer_aliases")
    @classmethod
    def _aliases(cls, v: list[str]) -> list[str]:
        seen: dict[str, str] = {}
        for a in v:
            if a.strip():
                seen.setdefault(a.strip().lower(), a.strip())
        return list(seen.values())


class CustomerPatch(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    legal_name: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    city: str | None = None
    payment_terms_days: int | None = Field(default=None, ge=0, le=365)
    payer_aliases: list[str] | None = None
    notes: str | None = None


class CustomerOut(BaseModel):
    id: uuid.UUID
    name: str
    legal_name: str | None
    contact_name: str | None
    contact_email: str | None
    city: str | None
    payment_terms_days: int | None
    payer_aliases: list[str]
    notes: str | None
    version: int
    open_balance: Money
    overdue: Money
    open_invoices: int
    last_payment: date | None
    avg_days_to_pay: int | None


# ------------------------------------------------------------------------------------------------ invoices
class LineIn(BaseModel):
    description: str = Field(min_length=1)
    quantity: Money
    unit_price: Money


class InvoiceIn(BaseModel):
    customer_id: uuid.UUID
    invoice_number: str | None = None
    po_number: str | None = None
    issue_date: date
    due_date: date
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    description: str | None = None
    lines: list[LineIn] = Field(min_length=1)


class InvoiceOut(BaseModel):
    id: uuid.UUID
    invoice_number: str
    customer_id: uuid.UUID
    customer_name: str
    po_number: str | None
    issue_date: date
    due_date: date
    currency: str
    total_amount: Money
    amount_paid: Money
    amount_adjusted: Money
    balance_due: Money
    lifecycle_status: str
    status: str
    days_late: int
    version: int


class LineOut(BaseModel):
    position: int
    description: str
    quantity: Money
    unit_price: Money
    amount: Money


class AllocationOut(BaseModel):
    id: uuid.UUID
    payment_id: uuid.UUID
    payment_number: str
    invoice_id: uuid.UUID
    invoice_number: str
    amount: Money
    currency: str
    method: str
    created_at: datetime
    voided_at: datetime | None
    void_reason: str | None


class InvoiceDetail(InvoiceOut):
    description: str | None
    cancel_reason: str | None
    lines: list[LineOut]
    allocations: list[AllocationOut]


class CancelIn(BaseModel):
    reason: str = Field(min_length=1)


class ManualPaymentIn(BaseModel):
    amount: Money
    method: str | None = None
    reference: str | None = None
    payment_date: date | None = None


# ------------------------------------------------------------------------------------------------ payments
class PaymentIn(BaseModel):
    payment_date: date
    amount: Money
    currency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    method: str | None = None
    reference: str | None = None
    memo: str | None = None
    payer_name_raw: str | None = None
    customer_id: uuid.UUID | None = None


class PaymentOut(BaseModel):
    id: uuid.UUID
    number: str
    customer_id: uuid.UUID | None
    customer_name: str | None
    payment_date: date
    amount: Money
    currency: str
    allocated_amount: Money
    unallocated_amount: Money
    method: str | None
    reference: str | None
    payer_name_raw: str | None
    verification_level: str
    under_review: bool
    reversed_at: datetime | None
    status: str
    version: int


class PaymentDetail(PaymentOut):
    memo: str | None
    reversal_reason: str | None
    allocations: list[AllocationOut]


class AllocationIn(BaseModel):
    invoice_id: uuid.UUID
    amount: Money


class ReasonIn(BaseModel):
    reason: str = Field(min_length=1)


class ReviewIn(BaseModel):
    under_review: bool
