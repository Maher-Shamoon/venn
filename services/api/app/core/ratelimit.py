"""A small sliding-window rate limiter, keyed by the caller's token (or address when there is none).

Shortcut: counters live in this process, so with several API instances each enforces its own limit. The shared limit is the
Vercel Firewall rule (see docs/testing); move these counters to Redis if the API ever outgrows that.
"""

import hashlib
import time
from collections import deque

HEAVY = (("POST", "/api/v1/imports"), ("POST", "/api/v1/documents"), ("POST", "/api/v1/reconciliation/runs"))


def is_heavy(method: str, path: str) -> bool:
    return any(method == m and path.startswith(p) for m, p in HEAVY) or (method == "GET" and path.startswith("/api/v1/reports/") and path.endswith(".csv"))


class RateLimiter:
    def __init__(self, per_minute: int, heavy_per_minute: int, anonymous_per_minute: int, address_per_minute: int = 1200) -> None:
        self.limits = {"normal": per_minute, "heavy": heavy_per_minute, "anonymous": anonymous_per_minute, "address": address_per_minute}
        self.hits: dict[tuple[str, str], deque[float]] = {}

    def check(self, method: str, path: str, bearer: str | None, address: str, now: float | None = None) -> int | None:
        """Returns None when the request may go on, or the seconds to wait."""
        now = time.monotonic() if now is None else now
        bucket = "heavy" if is_heavy(method, path) else "normal" if bearer else "anonymous"
        who = hashlib.sha256(bearer.encode()).hexdigest()[:16] if bearer else address
        wait = None
        for b, w in ((bucket, who), ("address", address)):  # the address bucket also catches callers who send a different made-up token each time
            q = self.hits.setdefault((b, w), deque())
            while q and now - q[0] >= 60:
                q.popleft()
            if len(q) >= self.limits[b]:
                wait = max(wait or 0, max(1, int(60 - (now - q[0])) + 1))
        if wait is not None:
            return wait
        for k in ((bucket, who), ("address", address)):
            self.hits[k].append(now)
        if len(self.hits) > 20_000:  # forget callers that went quiet
            for k in [k for k, v in self.hits.items() if not v or now - v[-1] >= 60]:
                del self.hits[k]
        return None
