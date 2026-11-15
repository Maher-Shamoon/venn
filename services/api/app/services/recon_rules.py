"""Deterministic reconciliation rules R1 to R8 (FEATURE_SPECIFICATION section B.7). Pure functions: no database, no clock, no AI.

Given one payment and the open invoices around it, decide what to suggest, what to flag and whether an exact match may be applied
without a person. The same inputs always give the same answer.
"""

import re
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import Decimal
from itertools import combinations
from typing import Literal

Confidence = Literal["exact", "high", "medium"]
MAX_SUBSET = 6
MAX_POOL = 20  # R6 searches subsets of at most this many invoices, oldest first; more than that is too ambiguous to guess


@dataclass(frozen=True)
class Inv:
    id: str
    number: str
    customer_id: str
    balance: Decimal
    currency: str
    due_date: date


@dataclass(frozen=True)
class Pay:
    id: str
    amount: Decimal
    allocated: Decimal
    currency: str
    payment_date: date
    reference: str
    memo: str
    payer: str
    customer_id: str | None

    @property
    def unallocated(self) -> Decimal:
        return self.amount - self.allocated


@dataclass(frozen=True)
class PriorPayment:
    """Another payment of the same organization, for duplicate detection (R7)."""

    id: str
    customer_id: str | None
    payer: str
    amount: Decimal
    currency: str
    reference: str
    payment_date: date


@dataclass(frozen=True)
class Settings:
    auto_apply_exact: bool = True
    short_grace_days: int = 7


@dataclass
class Suggestion:
    rule: str
    confidence: Confidence
    allocations: list[tuple[str, Decimal]]
    reason: str


@dataclass
class Discrepancy:
    type: Literal["short_payment", "overpayment", "duplicate_payment", "currency_mismatch"]
    exposure: Decimal
    detail: str
    invoice_id: str | None = None


@dataclass
class Outcome:
    suggestion: Suggestion | None = None
    auto_apply: bool = False
    under_review: bool = False
    discrepancies: list[Discrepancy] = field(default_factory=list)
    unmatched: bool = False
    note: str = ""


def normalise(s: str) -> str:
    return re.sub(r"\s+", " ", s.upper()).strip()


def referenced(text: str, invoices: list[Inv]) -> list[Inv]:
    """Invoices whose number appears as a whole token in the reference or memo, in the order they were found."""
    hay = normalise(text)
    found: list[tuple[int, Inv]] = []
    for inv in invoices:
        m = re.search(rf"(?<![A-Z0-9]){re.escape(normalise(inv.number))}(?![A-Z0-9])", hay)
        if m:
            found.append((m.start(), inv))
    return [i for _, i in sorted(found, key=lambda t: t[0])]


def _unique_subset(pool: list[Inv], target: Decimal) -> list[Inv] | None:
    """The only subset of at most MAX_SUBSET invoices that sums to target, or None when there is none or more than one."""
    pool = sorted(pool, key=lambda i: (i.due_date, i.number))[:MAX_POOL]
    hits: list[list[Inv]] = []
    for k in range(2, min(MAX_SUBSET, len(pool)) + 1):
        for combo in combinations(pool, k):
            if sum((i.balance for i in combo), Decimal(0)) == target:
                hits.append(list(combo))
                if len(hits) > 1:
                    return None
    return hits[0] if hits else None


def reconcile(pay: Pay, open_invoices: list[Inv], paid_numbers: set[str], priors: list[PriorPayment], customers_by_name: dict[str, str],
              settings: Settings, today: date) -> Outcome:
    out = Outcome()
    room = pay.unallocated
    if room <= 0:
        return out  # nothing left to match
    same_cur = [i for i in open_invoices if i.currency == pay.currency and i.balance > 0]
    text = f"{pay.reference} {pay.memo}"
    named = referenced(text, same_cur)
    cust = pay.customer_id or customers_by_name.get(pay.payer.strip().lower())

    # ---- R7 duplicates and R8 currency mismatch are flags, evaluated first so they can stop auto-apply
    other_cur = referenced(text, [i for i in open_invoices if i.currency != pay.currency and i.balance > 0])
    for inv in other_cur:
        out.discrepancies.append(Discrepancy("currency_mismatch", pay.amount, f"The reference names {inv.number}, which is in {inv.currency}; this payment is in {pay.currency}.", inv.id))
    dup = next((p for p in priors if p.id != pay.id and p.amount == pay.amount and p.currency == pay.currency and (p.customer_id == cust or p.payer.lower() == pay.payer.lower())
                and p.reference.strip().lower() == pay.reference.strip().lower() and abs((p.payment_date - pay.payment_date).days) <= 14), None)
    paid_ref = next((n for n in paid_numbers if re.search(rf"(?<![A-Z0-9]){re.escape(normalise(n))}(?![A-Z0-9])", normalise(text))), None)
    if dup or paid_ref:
        out.under_review = True
        why = "Same amount and reference as an earlier payment within 14 days." if dup else f"The reference names {paid_ref}, which is already paid in full."
        out.discrepancies.append(Discrepancy("duplicate_payment", pay.amount, why))

    # ---- R1 to R4: the reference names one or more open invoices
    if len(named) == 1:
        inv = named[0]
        if cust and cust != inv.customer_id and pay.customer_id:
            out.note = f"The reference names {inv.number}, but the payment is recorded for a different customer."
        elif room == inv.balance:
            out.suggestion = Suggestion("R1", "exact", [(inv.id, inv.balance)], f"Reference contains {inv.number} and the amount equals its balance.")
        elif room < inv.balance:
            out.suggestion = Suggestion("R2", "high", [(inv.id, room)], f"Reference contains {inv.number}; the payment is {inv.balance - room} short of the balance.")
            if (today - pay.payment_date).days >= settings.short_grace_days:
                out.discrepancies.append(Discrepancy("short_payment", inv.balance - room, f"{inv.number} is still short by {inv.balance - room} after {settings.short_grace_days} days.", inv.id))
        else:
            out.suggestion = Suggestion("R3", "high", [(inv.id, inv.balance)], f"Reference contains {inv.number}; the payment is {room - inv.balance} more than its balance.")
            out.discrepancies.append(Discrepancy("overpayment", room - inv.balance, f"{room - inv.balance} more than {inv.number} owes.", inv.id))
    elif len(named) > 1:
        total = sum((i.balance for i in named), Decimal(0))
        if room == total:
            out.suggestion = Suggestion("R4", "high", [(i.id, i.balance) for i in named], f"Reference lists {', '.join(i.number for i in named)} and the amount equals their combined balance.")

    # ---- R5 and R6: no usable reference, but the customer is known
    if out.suggestion is None and cust:
        mine = [i for i in same_cur if i.customer_id == cust]
        exact = [i for i in mine if i.balance == room]
        if len(exact) == 1:
            out.suggestion = Suggestion("R5", "high", [(exact[0].id, exact[0].balance)], f"Only one open invoice for this customer ({exact[0].number}) has exactly this balance.")
        elif not exact:
            subset = _unique_subset(mine, room)
            if subset:
                out.suggestion = Suggestion("R6", "medium", [(i.id, i.balance) for i in subset], f"Exactly one combination of this customer's open invoices adds up to the amount: {', '.join(i.number for i in subset)}.")

    if out.suggestion is None and not out.discrepancies:
        out.unmatched = True
    elif out.suggestion is None:
        out.unmatched = True
    out.auto_apply = bool(out.suggestion and out.suggestion.rule == "R1" and settings.auto_apply_exact and not out.under_review and not out.discrepancies)
    return out


def due_short_payment(inv_balance: Decimal, paid_to_it: Decimal, payment_date: date, today: date, grace: int) -> bool:
    return inv_balance > 0 and paid_to_it > 0 and today >= payment_date + timedelta(days=grace)
