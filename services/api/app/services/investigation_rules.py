"""Deterministic analysis of a discrepancy (MOD-11). Pure functions: facts in, findings and one recommendation out.

Every sentence here comes from a stored record or a calculation in code, never from a model. Findings are grouped in five kinds and each cites
the records it rests on. The recommendation is chosen from a closed catalog, and each action says whether a person must approve it.
"""

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from typing import Literal

Kind = Literal["confirmed", "calculated", "possible", "claim", "missing"]
ACTIONS: dict[str, dict[str, object]] = {
    "request_write_off": {"label": "Request a write-off", "gate": "approval", "approval_type": "write_off"},
    "request_credit": {"label": "Request a credit", "gate": "approval", "approval_type": "credit"},
    "request_refund": {"label": "Record a refund due", "gate": "approval", "approval_type": "refund_due"},
    "monitor": {"label": "Keep monitoring", "gate": "none", "approval_type": None},
}
SMALL_SHORTFALL = Decimal("0.02")  # a shortfall up to 2% of the invoice is treated as a likely fee


@dataclass(frozen=True)
class InvoiceFacts:
    id: str
    number: str
    total: Decimal
    paid: Decimal
    adjusted: Decimal
    balance: Decimal
    due_date: date


@dataclass(frozen=True)
class PaymentFacts:
    id: str
    number: str
    amount: Decimal
    allocated: Decimal
    payment_date: date
    reference: str


@dataclass(frozen=True)
class Evidence:
    type: str  # invoice, payment, document, email, manual
    ref: str
    label: str


@dataclass(frozen=True)
class Facts:
    type: str
    currency: str
    invoice: InvoiceFacts | None
    payment: PaymentFacts | None
    other_payment: PaymentFacts | None  # the earlier payment, for duplicates
    evidence: list[Evidence] = field(default_factory=list)
    exposure: Decimal = Decimal(0)


@dataclass
class Finding:
    kind: Kind
    text: str
    cites: list[str]


@dataclass
class Recommendation:
    action: str
    amount: Decimal | None
    why: str


@dataclass
class Analysis:
    status: Literal["completed", "insufficient_evidence"]
    summary: str
    findings: list[Finding]
    recommendation: Recommendation | None


def money(d: Decimal, cur: str) -> str:
    return f"{cur} {d:,.2f}"


def priority(exposure: Decimal, age_days: int) -> str:
    level = 3 if exposure >= 10000 else 2 if exposure >= 2500 else 1 if exposure >= 500 else 0
    if age_days > 30:
        level = min(3, level + 1)
    return ("low", "medium", "high", "critical")[level]


def analyze(f: Facts) -> Analysis:
    cur, inv, pay = f.currency, f.invoice, f.payment
    cites_inv = [f"invoice:{inv.id}"] if inv else []
    cites_pay = [f"payment:{pay.id}"] if pay else []
    has_explanation = any(e.type in ("document", "email") for e in f.evidence)
    out: list[Finding] = []
    rec: Recommendation | None = None

    if f.type == "short_payment" and inv and pay:
        short = f.exposure if f.exposure > 0 else inv.balance
        pct = short / inv.total if inv.total else Decimal(1)
        out.append(Finding("confirmed", f"Payment {pay.number} of {money(pay.amount, cur)} on {pay.payment_date} names {inv.number}, which totals {money(inv.total, cur)}.", cites_pay + cites_inv))
        out.append(Finding("calculated", f"{inv.number} is short by {money(short, cur)}: {money(inv.total, cur)} invoiced, {money(pay.amount, cur)} received. Calculated by venn, not by AI.", cites_inv))
        small = pct <= SMALL_SHORTFALL
        if small:
            out.append(Finding("possible", f"A shortfall of {pct * 100:.2f}% is the size of a typical bank or processing fee.", cites_inv))
        if not has_explanation:
            out.append(Finding("missing", "No remittance advice, document or message from the customer is linked to explain the difference.", []))
        if small:
            rec = Recommendation("request_write_off", short, f"The shortfall is {pct * 100:.2f}% of the invoice. Writing it off closes the invoice. A person must approve.")
        elif has_explanation:
            rec = Recommendation("monitor", None, "The shortfall is confirmed and evidence is linked. Keep watching for the remaining payment.")
        status: Literal["completed", "insufficient_evidence"] = "completed" if (small or has_explanation) else "insufficient_evidence"
        return Analysis(status, f"{money(short, cur)} still owed on {inv.number}.", out, rec)

    if f.type == "overpayment" and pay:
        excess = f.exposure
        out.append(Finding("confirmed", f"Payment {pay.number} of {money(pay.amount, cur)} was received" + (f" against {inv.number}, whose balance was {money(inv.balance + excess, cur)}." if inv else "."), cites_pay + cites_inv))
        out.append(Finding("calculated", f"The customer paid {money(excess, cur)} more than the invoice required. Calculated by venn, not by AI.", cites_pay))
        if not has_explanation:
            out.append(Finding("missing", "No document or message says whether the extra amount is a deposit or a mistake.", []))
        if inv and inv.paid >= excess:
            rec = Recommendation("request_refund", excess, "Money held above what was owed is normally returned or credited. A person must approve the record.")
        return Analysis("completed", f"{money(excess, cur)} received above what was owed.", out, rec)

    if f.type == "duplicate_payment" and pay:
        out.append(Finding("confirmed", f"Payment {pay.number} of {money(pay.amount, cur)} on {pay.payment_date} has reference {pay.reference or 'none'}.", cites_pay))
        if f.other_payment:
            o = f.other_payment
            out.append(Finding("confirmed", f"Payment {o.number} of {money(o.amount, cur)} on {o.payment_date} has the same amount and reference.", [f"payment:{o.id}"]))
        out.append(Finding("calculated", f"If both are real, {money(pay.amount, cur)} was received twice. Calculated by venn, not by AI.", cites_pay))
        out.append(Finding("missing", "Nothing proves that the bank received two transfers rather than the file being imported twice.", []))
        return Analysis("completed", f"{pay.number} may be a duplicate.", out, Recommendation("monitor", None, "Check the bank statement. If it is a duplicate, reverse the payment in Payments."))

    if f.type == "currency_mismatch":
        out.append(Finding("confirmed", f"The payment is in {cur}" + (f" but {inv.number} is in a different currency." if inv else "."), cites_pay + cites_inv))
        out.append(Finding("missing", "venn does not convert currencies, so the payment cannot be applied to that invoice.", []))
        return Analysis("completed", "Payment and invoice currencies differ.", out, Recommendation("monitor", None, "Confirm the currency with the customer, then correct the payment or the invoice."))

    if inv:
        out.append(Finding("confirmed", f"{inv.number} totals {money(inv.total, cur)}, with {money(inv.paid, cur)} paid and {money(inv.adjusted, cur)} adjusted. Balance {money(inv.balance, cur)}.", cites_inv))
    if not has_explanation:
        out.append(Finding("missing", "No document or message is linked to this case yet.", []))
    return Analysis("completed" if inv or pay else "insufficient_evidence", "Opened by hand.", out, None)
