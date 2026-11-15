"""Money crosses the API as decimal strings ("1000.00"). Floats are rejected everywhere (FEATURE_SPECIFICATION A.1)."""

import re
from decimal import ROUND_HALF_EVEN, Decimal, InvalidOperation
from typing import Annotated, Any

from pydantic import BeforeValidator, PlainSerializer

DIGITS = {"JPY": 0, "KRW": 0, "VND": 0, "BHD": 3, "KWD": 3, "JOD": 3}
MAX = Decimal("999999999999999.9999")  # numeric(19,4)


def currency_digits(currency: str) -> int:
    return DIGITS.get(currency.upper(), 2)


def parse_money(v: Any) -> Decimal:
    if isinstance(v, bool) or isinstance(v, float):
        raise ValueError("Amounts must be sent as text, for example \"1000.00\".")
    text = str(v).strip()
    if not re.fullmatch(r"-?[0-9]+(\.[0-9]+)?", text):  # plain decimal text only: no exponents, separators or NaN
        raise ValueError("Enter a valid amount.")
    try:
        d = Decimal(text)
    except (InvalidOperation, ValueError) as e:
        raise ValueError("Enter a valid amount.") from e
    if not d.is_finite() or abs(d) > MAX or d.as_tuple().exponent < -4:  # type: ignore[operator]
        raise ValueError("Enter a valid amount with at most 4 decimals.")
    return d


def fmt(d: Decimal) -> str:
    """At least two decimals, more only when the value needs them (up to 4)."""
    q = d.quantize(Decimal("0.01")) if d == d.quantize(Decimal("0.01")) else d.quantize(Decimal("0.0001"))
    return format(q, "f")


def round_half_even(d: Decimal, currency: str = "USD") -> Decimal:
    return d.quantize(Decimal(1).scaleb(-currency_digits(currency)), rounding=ROUND_HALF_EVEN)


Money = Annotated[Decimal, BeforeValidator(parse_money), PlainSerializer(fmt, return_type=str)]
