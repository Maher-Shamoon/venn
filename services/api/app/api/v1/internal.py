import hmac
from typing import Any

from fastapi import APIRouter, Header

from app.core.config import get_settings
from app.core.errors import ApiError
from app.services import jobs

router = APIRouter(prefix="/internal", tags=["internal"], include_in_schema=False)


@router.post("/cron/daily")
@router.get("/cron/daily")  # Vercel cron calls with GET
def daily(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """Runs the scheduled jobs. Only the platform scheduler knows the secret; without one configured the endpoint is closed."""
    secret = get_settings().cron_secret
    if not secret or not authorization or not hmac.compare_digest(authorization, f"Bearer {secret}"):
        raise ApiError(401, "unauthenticated", "Not allowed.")
    return jobs.run_daily()
