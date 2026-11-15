from datetime import date, timedelta
from decimal import Decimal as D  # noqa: N817

from hypothesis import given
from hypothesis import strategies as st

from app.services.recon_rules import Inv, Outcome, Pay, PriorPayment, Settings, reconcile, referenced

TODAY = date(2026, 11, 15)
NW, MR = "cust-nw", "cust-mr"


def inv(number: str, balance: str, cust: str = NW, cur: str = "USD", due: date = date(2026, 11, 1)) -> Inv:
    return Inv(f"id-{number}", number, cust, D(balance), cur, due)


def pay(amount: str, ref: str = "", payer: str = "", cust: str | None = None, cur: str = "USD", memo: str = "", when: date = date(2026, 11, 10), allocated: str = "0") -> Pay:
    return Pay("p1", D(amount), D(allocated), cur, when, ref, memo, payer, cust)


def run(p: Pay, invs: list[Inv], paid: set[str] | None = None, priors: list[PriorPayment] | None = None, names: dict[str, str] | None = None, s: Settings | None = None) -> Outcome:
    return reconcile(p, invs, paid or set(), priors or [], names or {}, s or Settings(), TODAY)


def test_r1_exact_reference_and_amount_is_auto_applied_when_enabled() -> None:
    o = run(pay("1000", ref="ACH inv-1047 thanks"), [inv("INV-1047", "1000")])
    assert o.suggestion and o.suggestion.rule == "R1" and o.suggestion.confidence == "exact" and o.suggestion.allocations == [("id-INV-1047", D("1000"))] and o.auto_apply
    assert not run(pay("1000", ref="INV-1047"), [inv("INV-1047", "1000")], s=Settings(auto_apply_exact=False)).auto_apply
    assert not run(pay("1000", ref="INV-1047"), [inv("INV-1047", "1000")], names={}).under_review


def test_reference_must_match_a_whole_invoice_number() -> None:
    assert referenced("paid INV-10470", [inv("INV-1047", "1")]) == []
    assert referenced("paid XINV-1047", [inv("INV-1047", "1")]) == []
    assert len(referenced("inv-1047, INV-1048", [inv("INV-1047", "1"), inv("INV-1048", "1")])) == 2


def test_r2_partial_payment_suggests_and_flags_a_short_payment_after_the_grace_period() -> None:
    fresh = run(pay("4000", ref="INV-1042", when=TODAY - timedelta(days=2)), [inv("INV-1042", "5000")])
    assert fresh.suggestion and fresh.suggestion.rule == "R2" and fresh.suggestion.allocations[0][1] == D("4000") and not fresh.auto_apply and fresh.discrepancies == []
    late = run(pay("4000", ref="INV-1042", when=TODAY - timedelta(days=8)), [inv("INV-1042", "5000")])
    assert [d.type for d in late.discrepancies] == ["short_payment"] and late.discrepancies[0].exposure == D("1000")


def test_r3_overpayment_applies_up_to_the_balance_and_flags_the_rest() -> None:
    o = run(pay("1200", ref="INV-7"), [inv("INV-7", "1000")])
    assert o.suggestion and o.suggestion.rule == "R3" and o.suggestion.allocations == [("id-INV-7", D("1000"))] and not o.auto_apply
    assert [(d.type, d.exposure) for d in o.discrepancies] == [("overpayment", D("200"))]


def test_r4_several_references_must_add_up_exactly() -> None:
    invs = [inv("INV-1", "300"), inv("INV-2", "700")]
    o = run(pay("1000", ref="INV-2 INV-1"), invs)
    assert o.suggestion and o.suggestion.rule == "R4" and [a[0] for a in o.suggestion.allocations] == ["id-INV-2", "id-INV-1"]
    assert run(pay("999", ref="INV-1 INV-2"), invs).suggestion is None


def test_r5_known_customer_with_a_single_invoice_of_that_amount() -> None:
    invs = [inv("A-1", "500"), inv("A-2", "900"), inv("M-1", "500", cust=MR)]
    o = run(pay("500", payer="N. Labs LLC"), invs, names={"n. labs llc": NW})
    assert o.suggestion and o.suggestion.rule == "R5" and o.suggestion.confidence == "high" and o.suggestion.allocations == [("id-A-1", D("500"))] and not o.auto_apply
    assert run(pay("500", payer="Unknown"), invs).unmatched
    two = run(pay("500", cust=NW), [inv("A-1", "500"), inv("A-9", "500")])
    assert two.suggestion is None  # two equal invoices: never guess


def test_r6_unique_combination_is_medium_and_ambiguity_is_refused() -> None:
    invs = [inv("A-1", "100"), inv("A-2", "250"), inv("A-3", "400")]
    o = run(pay("350", cust=NW), invs)
    assert o.suggestion and o.suggestion.rule == "R6" and o.suggestion.confidence == "medium" and {a[0] for a in o.suggestion.allocations} == {"id-A-1", "id-A-2"}
    assert run(pay("500", cust=NW), [inv("B-1", "100"), inv("B-2", "400"), inv("B-3", "250"), inv("B-4", "250")]).suggestion is None  # 100+400 and 250+250


def test_r7_duplicate_payment_sets_review_and_blocks_auto_apply() -> None:
    earlier = PriorPayment("p0", NW, "Northwind", D("1000"), "USD", "ACH 55102", TODAY - timedelta(days=5))
    o = run(pay("1000", ref="ACH 55102", payer="Northwind", cust=NW), [], priors=[earlier])
    assert o.under_review and [d.type for d in o.discrepancies] == ["duplicate_payment"]
    again = run(pay("1000", ref="INV-1043", cust=NW), [inv("INV-1043", "1000")], priors=[PriorPayment("p0", NW, "Northwind", D("1000"), "USD", "INV-1043", TODAY - timedelta(days=3))])
    assert again.suggestion and again.suggestion.rule == "R1" and not again.auto_apply and again.under_review
    paid = run(pay("1000", ref="INV-1043 again"), [], paid={"INV-1043"})
    assert paid.under_review and "already paid" in paid.discrepancies[0].detail
    old = PriorPayment("p0", NW, "Northwind", D("1000"), "USD", "ACH 55102", TODAY - timedelta(days=40))
    assert not run(pay("1000", ref="ACH 55102", cust=NW), [], priors=[old]).under_review  # outside the 14 day window


def test_r8_currency_mismatch_is_flagged_not_matched() -> None:
    o = run(pay("1000", ref="INV-5", cur="USD"), [inv("INV-5", "1000", cur="EUR")])
    assert o.suggestion is None and [d.type for d in o.discrepancies] == ["currency_mismatch"] and not o.auto_apply


def test_reference_for_a_different_customer_is_not_applied() -> None:
    o = run(pay("1000", ref="INV-1", cust=MR), [inv("INV-1", "1000", cust=NW)])
    assert o.suggestion is None and "different customer" in o.note


def test_nothing_left_to_match_and_nothing_found() -> None:
    assert run(pay("100", ref="INV-1", allocated="100"), [inv("INV-1", "100")]).suggestion is None
    assert run(pay("77.77", ref="lunch", payer="Mystery")  , [inv("INV-1", "100")]).unmatched


def test_the_rules_are_deterministic() -> None:
    invs = [inv("A-1", "100"), inv("A-2", "250"), inv("A-3", "400")]
    first = run(pay("350", cust=NW), invs)
    assert all(run(pay("350", cust=NW), list(reversed(invs))).suggestion == first.suggestion for _ in range(3))


amounts = st.decimals(min_value=D("0.01"), max_value=D("5000"), places=2)


@given(amount=amounts, balances=st.lists(amounts, min_size=1, max_size=6), allocated=st.decimals(min_value=D("0"), max_value=D("100"), places=2))
def test_a_suggestion_never_exceeds_the_payment_or_any_invoice(amount: D, balances: list[D], allocated: D) -> None:
    invs = [inv(f"I-{n}", str(b)) for n, b in enumerate(balances)]
    p = pay(str(amount), ref=" ".join(i.number for i in invs), cust=NW, allocated=str(min(allocated, amount - D("0.01"))))
    o = run(p, invs)
    if o.suggestion:
        total = sum((a for _, a in o.suggestion.allocations), D(0))
        assert total <= p.unallocated
        by_id = {i.id: i.balance for i in invs}
        assert all(0 < a <= by_id[i] for i, a in o.suggestion.allocations)
