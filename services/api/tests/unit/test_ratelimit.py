from app.core.ratelimit import RateLimiter, is_heavy


def test_sliding_window_blocks_then_recovers_and_separates_callers() -> None:
    r = RateLimiter(3, 1, 2)
    assert [r.check("GET", "/api/v1/customers", "tok-a", "1.1.1.1", now=t) for t in (0, 1, 2)] == [None, None, None]
    wait = r.check("GET", "/api/v1/customers", "tok-a", "1.1.1.1", now=3)
    assert wait is not None and 55 <= wait <= 60
    assert r.check("GET", "/api/v1/customers", "tok-b", "1.1.1.1", now=3) is None  # another person is not affected
    assert r.check("GET", "/api/v1/customers", "tok-a", "1.1.1.1", now=61) is None  # the window moved on


def test_heavy_and_anonymous_requests_have_their_own_smaller_limits() -> None:
    r = RateLimiter(100, 1, 2)
    assert is_heavy("POST", "/api/v1/imports") and is_heavy("GET", "/api/v1/reports/aging.csv") and not is_heavy("GET", "/api/v1/reports/aging")
    assert r.check("POST", "/api/v1/documents", "tok", "x", now=0) is None and r.check("POST", "/api/v1/documents", "tok", "x", now=1) is not None
    assert r.check("GET", "/api/v1/customers", "tok", "x", now=1) is None  # normal requests are counted separately
    assert [r.check("GET", "/api/v1/invitations/abc", None, "9.9.9.9", now=t) for t in (0, 1)] == [None, None]
    assert r.check("GET", "/api/v1/invitations/abc", None, "9.9.9.9", now=2) is not None
