from datetime import date

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import clock


def org_today(db: Session) -> date:
    """Today in the current organization's time zone."""
    return clock.today(db.execute(text("select timezone from organizations")).scalar_one())
