from datetime import date
from decimal import Decimal as D  # noqa: N817

from app.services.investigation_rules import ACTIONS, Evidence, Facts, InvoiceFacts, PaymentFacts, analyze, priority

INV = InvoiceFacts("i1", "INV-1042", D("5000"), D("4900"), D("0"), D("100"), date(2026, 11, 1))
PAY = PaymentFacts("p1", "PAY-0001", D("4900"), D("4900"), date(2026, 11, 10), "INV-1042")


def facts(kind: str, **kw: object) -> Facts:
    base: dict[str, object] = {"type": kind, "currency": "USD", "invoice": INV, "payment": PAY, "other_payment": None}
    return Facts(**{**base, **kw})  # type: ignore[arg-type]


def test_small_shortfall_recommends_a_write_off_that_needs_approval() -> None:
    a = analyze(facts("short_payment"))
    assert a.status == "completed" and a.recommendation and a.recommendation.action == "request_write_off" and a.recommendation.amount == D("100")
    assert ACTIONS[a.recommendation.action]["gate"] == "approval"
    assert [f.kind for f in a.findings][:3] == ["confirmed", "calculated", "possible"]
    assert all(f.cites for f in a.findings if f.kind in ("confirmed", "calculated"))  # every stated fact cites a record


def test_large_shortfall_without_evidence_gives_no_recommendation() -> None:
    big = InvoiceFacts("i1", "INV-1042", D("5000"), D("4000"), D("0"), D("1000"), date(2026, 11, 1))
    a = analyze(facts("short_payment", invoice=big))
    assert a.status == "insufficient_evidence" and a.recommendation is None and "missing" in {f.kind for f in a.findings}
    with_doc = analyze(facts("short_payment", invoice=big, evidence=[Evidence("document", "d1", "Remittance advice.pdf")]))
    assert with_doc.status == "completed" and with_doc.recommendation and with_doc.recommendation.action == "monitor"
    assert "missing" not in {f.kind for f in with_doc.findings}


def test_overpayment_recommends_a_refund_record_for_the_excess_only() -> None:
    paid = InvoiceFacts("i1", "INV-1042", D("1000"), D("1000"), D("0"), D("0"), date(2026, 11, 1))
    a = analyze(facts("overpayment", invoice=paid, exposure=D("200")))
    assert a.recommendation and a.recommendation.action == "request_refund" and a.recommendation.amount == D("200")


def test_duplicate_payment_names_both_payments_and_never_acts_alone() -> None:
    other = PaymentFacts("p0", "PAY-0000", D("4900"), D("0"), date(2026, 11, 8), "INV-1042")
    a = analyze(facts("duplicate_payment", other_payment=other))
    assert sum(f.kind == "confirmed" for f in a.findings) == 2 and a.recommendation and a.recommendation.action == "monitor"


def test_recommendations_come_only_from_the_closed_catalog() -> None:
    for kind in ("short_payment", "overpayment", "duplicate_payment", "currency_mismatch", "manual"):
        a = analyze(facts(kind, exposure=D("10")))
        assert a.recommendation is None or a.recommendation.action in ACTIONS


def test_priority_from_exposure_and_age() -> None:
    assert priority(D("100"), 0) == "low" and priority(D("600"), 0) == "medium" and priority(D("3000"), 0) == "high" and priority(D("20000"), 0) == "critical"
    assert priority(D("100"), 45) == "medium" and priority(D("20000"), 99) == "critical"
