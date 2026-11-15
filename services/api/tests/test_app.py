from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def test_health_ok_and_request_id() -> None:
    r = client.get("/api/v1/health")
    assert r.status_code == 200 and r.json() == {"status": "ok"}
    assert r.headers["X-Request-Id"].startswith("req_")


def test_request_id_is_echoed() -> None:
    r = client.get("/api/v1/health", headers={"X-Request-Id": "abc"})
    assert r.headers["X-Request-Id"] == "abc"


def test_unknown_route_is_problem_json() -> None:
    r = client.get("/api/v1/nope")
    assert r.status_code == 404 and r.headers["content-type"].startswith("application/problem+json")
    body = r.json()
    assert body["code"] == "not_found" and body["request_id"] == r.headers["X-Request-Id"]


def test_wrong_method_is_problem_json() -> None:
    r = client.post("/api/v1/health")
    assert r.status_code == 405 and r.json()["code"] == "method_not_allowed"


def test_too_many_requests_get_a_429_with_retry_after() -> None:
    from fastapi.testclient import TestClient

    from app.core.ratelimit import RateLimiter
    from app.main import app

    old = app.state.limiter
    app.state.limiter = RateLimiter(2, 1, 2)
    try:
        c = TestClient(app)
        assert [c.get("/api/v1/invitations/nothing").status_code for _ in range(2)] == [404, 404]
        r = c.get("/api/v1/invitations/nothing")
        assert r.status_code == 429 and r.json()["code"] == "rate_limited" and int(r.headers["Retry-After"]) >= 1 and r.headers["x-request-id"]
        assert c.get("/api/v1/health").status_code == 200  # health checks are never limited
    finally:
        app.state.limiter = old
