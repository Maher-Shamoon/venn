import time

import pytest

from app.core import security
from app.core.config import Settings
from app.core.ratelimit import RateLimiter
from app.core.security import _email_confirmed


def test_made_up_tokens_still_count_against_the_address() -> None:
    lim = RateLimiter(100, 100, 100, address_per_minute=3)
    assert [lim.check("GET", "/api/v1/x", f"Bearer fake{i}", "1.2.3.4", now=0) for i in range(3)] == [None] * 3
    assert lim.check("GET", "/api/v1/x", "Bearer another", "1.2.3.4", now=1) is not None
    assert lim.check("GET", "/api/v1/x", "Bearer another", "5.6.7.8", now=1) is None  # a different address is unaffected


def test_email_confirmation_comes_from_supabase_not_from_the_token(monkeypatch: pytest.MonkeyPatch) -> None:
    s = Settings(jwks_url="https://p.supabase.co/auth/v1/.well-known/jwks.json", jwt_issuer="https://p.supabase.co/auth/v1", supabase_anon_key="pk")
    calls: list[str] = []

    def reply(confirmed: str | None):  # type: ignore[no-untyped-def]
        def get(url: str, **kw: object) -> object:
            calls.append(url)
            return type("R", (), {"status_code": 200, "json": lambda self: {"email_confirmed_at": confirmed}})()
        return get

    monkeypatch.setattr(security.httpx, "get", reply(None))
    assert _email_confirmed("t1", s) is False  # whatever the token's metadata claims
    monkeypatch.setattr(security.httpx, "get", reply("2026-01-01T00:00:00Z"))
    assert _email_confirmed("t2", s) is True and _email_confirmed("t2", s) is True
    assert len(calls) == 2  # the positive answer is remembered for a few minutes
    assert time.monotonic() > 0


def test_tenancy_survives_a_commit_inside_a_request(migrated: str) -> None:
    from sqlalchemy import text
    from sqlalchemy.orm import Session

    from app.core.db import get_engine
    from app.core.tenancy import scope_session

    s = scope_session(Session(get_engine()), "", "")
    try:
        assert s.execute(text("select current_user")).scalar() == "venn_app"
        s.commit()  # the values are transaction-local; the next transaction must get them again
        assert s.execute(text("select current_user")).scalar() == "venn_app"
    finally:
        s.close()
