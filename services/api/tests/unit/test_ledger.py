from datetime import date, timedelta
from decimal import Decimal as D  # noqa: N817

import pytest
from hypothesis import given
from hypothesis import strategies as st
from pydantic import BaseModel, ValidationError

from app.core.money import Money, fmt, parse_money, round_half_even
from app.services.ledger import InvoiceFacts, InvoiceState, aging_bucket, balance, display_status, is_overdue, max_allocation

TODAY = date(2026, 11, 15)
cents = st.decimals(min_value=D("0"), max_value=D("1000000"), places=2)


def facts(**kw: object) -> InvoiceFacts:
    base = dict(lifecycle="issued", total=D("100"), paid=D(0), adjusted=D(0), due_date=TODAY + timedelta(days=5), disputed=False)
    return InvoiceFacts(**{**base, **kw})  # type: ignore[arg-type]


@given(total=cents, paid=cents, adj=cents)
def test_balance_is_never_negative_and_matches_the_formula(total: D, paid: D, adj: D) -> None:
    b = balance(total, paid, adj)
    assert b >= 0
    if total - paid - adj >= 0:
        assert b == total - paid - adj


def test_status_precedence_in_the_documented_order() -> None:
    past = TODAY - timedelta(days=3)
    assert display_status(facts(lifecycle="cancelled", paid=D(100)), TODAY) == InvoiceState.CANCELLED
    assert display_status(facts(lifecycle="draft"), TODAY) == InvoiceState.DRAFT
    assert display_status(facts(paid=D(100), due_date=past, disputed=True), TODAY) == InvoiceState.PAID
    assert display_status(facts(due_date=past, disputed=True), TODAY) == InvoiceState.DISPUTED
    assert display_status(facts(due_date=past, paid=D(10)), TODAY) == InvoiceState.OVERDUE
    assert display_status(facts(paid=D(10)), TODAY) == InvoiceState.PARTIALLY_PAID
    assert display_status(facts(), TODAY) == InvoiceState.ISSUED
    assert display_status(facts(adjusted=D(100)), TODAY) == InvoiceState.PAID  # a full write-off settles it


def test_due_today_is_not_overdue_but_yesterday_is() -> None:
    assert not is_overdue(facts(due_date=TODAY), TODAY)
    assert is_overdue(facts(due_date=TODAY - timedelta(days=1)), TODAY)
    assert not is_overdue(facts(due_date=TODAY - timedelta(days=1), paid=D(100)), TODAY)


@pytest.mark.parametrize(("late", "bucket"), [(-5, "current"), (0, "current"), (1, "1-30"), (30, "1-30"), (31, "31-60"), (60, "31-60"), (61, "61-90"), (90, "61-90"), (91, "90+"), (400, "90+")])
def test_aging_buckets(late: int, bucket: str) -> None:
    assert aging_bucket(TODAY - timedelta(days=late), TODAY) == bucket


@given(amount=cents, allocated=cents, owed=cents)
def test_max_allocation_never_exceeds_either_side(amount: D, allocated: D, owed: D) -> None:
    m = max_allocation(amount, min(allocated, amount), owed)
    assert 0 <= m <= owed and m <= amount - min(allocated, amount)


class Body(BaseModel):
    amount: Money


def test_money_rejects_floats_and_garbage_and_serializes_as_text() -> None:
    assert Body(amount="1000").model_dump(mode="json") == {"amount": "1000.00"}  # type: ignore[arg-type]
    assert Body(amount="0.1234").model_dump(mode="json") == {"amount": "0.1234"}  # type: ignore[arg-type]
    for bad in (10.5, True, "abc", "1e3", "1.23456", "", "NaN", "99999999999999999"):
        with pytest.raises(ValidationError):
            Body(amount=bad)  # type: ignore[arg-type]


def test_rounding_is_half_even_at_the_currency_precision() -> None:
    assert round_half_even(D("2.345")) == D("2.34") and round_half_even(D("2.355")) == D("2.36")
    assert round_half_even(D("2.5"), "JPY") == D("2")
    assert parse_money("12.50") == D("12.50") and fmt(D("5")) == "5.00"
