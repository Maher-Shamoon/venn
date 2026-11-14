from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.db import get_session

router = APIRouter(tags=["health"])
DbSession = Depends(get_session)


@router.get("/health")
def health() -> dict[str, str]:
    """Liveness: the process is up. Does not touch the database."""
    return {"status": "ok"}


@router.get("/health/ready")
def ready(db: Session = DbSession) -> dict[str, str]:
    """Readiness: the database answers."""
    db.execute(text("select 1"))
    return {"status": "ready"}
