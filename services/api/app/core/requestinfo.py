from dataclasses import dataclass


@dataclass(frozen=True)
class RequestInfo:
    """Who and where a request came from; stored with every audit entry."""

    request_id: str | None = None
    ip: str | None = None
    user_agent: str | None = None
