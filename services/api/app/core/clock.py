"""The only place that asks what time it is, so tests can fix it."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo

_override: datetime | None = None


def now() -> datetime:
    return _override or datetime.now(UTC)


def today(tz: str) -> date:
    """"Today" in the organization's time zone: overdue is decided here, never in UTC (FEATURE_SPECIFICATION A.6)."""
    return now().astimezone(ZoneInfo(tz)).date()
