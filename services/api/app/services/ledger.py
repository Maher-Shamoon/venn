"""Pure accounting rules. No database, no clock: everything a test needs is a parameter (NFR: testable, deterministic)."""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from enum import StrEnum


class InvoiceState(StrEnum):
    CANCELLED = "cancelled"
    DRAFT = "draft"
    PAID = "paid"
    DISPUTED = "disputed"
    OVERDUE = "overdue"
    PARTIALLY_PAID = "partially_paid"
    ISSUED = "issued"


@dataclass(frozen=True)
class InvoiceFacts:
    lifecycle: str
    total: Decimal
    paid: Decimal
    adjusted: Decimal
    due_date: date
    disputed: bool = False


def balance(total: Decimal, paid: Decimal, adjusted: Decimal) -> Decimal:
    """balance_due = total - allocations - approved adjustments, never below zero (A.2)."""
    return max(Decimal(0), total - paid - adjusted)


def is_overdue(f: InvoiceFacts, today: date) -> bool:
    return f.lifecycle == "issued" and balance(f.total, f.paid, f.adjusted) > 0 and f.due_date < today


def display_status(f: InvoiceFacts, today: date) -> InvoiceState:
    """First match wins: Cancelled > Draft > Paid > Disputed > Overdue > Partially paid > Issued (A.3)."""
    if f.lifecycle == "cancelled":
        return InvoiceState.CANCELLED
    if f.lifecycle == "draft":
        return InvoiceState.DRAFT
    if balance(f.total, f.paid, f.adjusted) == 0:
        return InvoiceState.PAID
    if f.disputed:
        return InvoiceState.DISPUTED
    if is_overdue(f, today):
        return InvoiceState.OVERDUE
    if f.paid > 0:
        return InvoiceState.PARTIALLY_PAID
    return InvoiceState.ISSUED


def days_late(due: date, today: date) -> int:
    return max(0, (today - due).days)


AGING_BUCKETS = [("current", 0, 0), ("1-30", 1, 30), ("31-60", 31, 60), ("61-90", 61, 90), ("90+", 91, 10**6)]


def aging_bucket(due: date, today: date) -> str:
    late = days_late(due, today)
    return next(name for name, lo, hi in AGING_BUCKETS if lo <= late <= hi)


def max_allocation(payment_amount: Decimal, payment_allocated: Decimal, invoice_balance: Decimal) -> Decimal:
    """The most that can be applied now: what is left on the payment and what is still owed."""
    return max(Decimal(0), min(payment_amount - payment_allocated, invoice_balance))
