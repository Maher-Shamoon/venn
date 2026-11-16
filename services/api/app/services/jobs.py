"""Scheduled work, run once a day by the platform's scheduler (Vercel cron) through POST /api/v1/internal/cron/daily.

For each organization, inside that organization's own tenancy: expire approval requests that were not decided in time, refresh the collections
queue (open and close cases, flag broken promises) and create a follow-up task for each case that is due. Everything is safe to run twice.
Money is never moved here: no payment is allocated and nothing is sent.
"""

import logging
import uuid
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import clock
from app.core.db import get_engine
from app.services import approvals, collections, notifications

log = logging.getLogger("venn.jobs")


def scoped(org: uuid.UUID) -> Session:
    s = Session(get_engine(), expire_on_commit=False)
    s.execute(text("select set_config('role', 'venn_app', true), set_config('app.user_id', '', true), set_config('app.org_id', :o, true)"), {"o": str(org)})
    return s


def run_daily() -> dict[str, Any]:
    with Session(get_engine()) as admin:
        orgs = [(r.id, r.timezone) for r in admin.execute(text("select id, timezone from organizations")).all()]
    out = {"organizations": len(orgs), "expired": 0, "opened": 0, "closed": 0, "broken": 0, "tasks": 0, "failed": 0}
    for org, tz in orgs:
        s = scoped(org)
        try:
            today = clock.today(tz)
            out["expired"] += approvals.expire_due(s, org)
            r = collections.sync(s, org, today)
            out["opened"] += r["opened"]
            out["closed"] += r["closed"]
            out["broken"] += r["broken"]
            out["tasks"] += _follow_up_tasks(s, org, today)
            s.commit()
        except Exception:  # noqa: BLE001  # one organization's failure must not stop the others
            log.exception("daily job failed for %s", org)
            s.rollback()
            out["failed"] += 1
        finally:
            s.close()
    return out


def _follow_up_tasks(s: Session, org: uuid.UUID, today: Any) -> int:
    """One task per due case and day, for every member who can work collections. The link and date make it idempotent."""
    due = s.execute(text("select c.id, c.number, cu.name from collection_cases c join customers cu on cu.id = c.customer_id "
                         "where c.status = 'active' and c.paused_reason is null and c.stage <> 'promise' and c.next_action_date <= :t"), {"t": today}).all()
    made = 0
    users = notifications.users_with(s, org, "collections.draft")
    for c in due:
        link = f"/app/collections/{c.id}"
        title = f"Follow up with {c.name} ({c.number})"
        for u in users:
            if s.execute(text("select 1 from tasks where link = :l and assignee_id = :u and system and due_date = :t"), {"l": link, "u": u, "t": today}).first():
                continue
            s.execute(text("insert into tasks (organization_id, title, due_date, assignee_id, link, system) values (:o, :ti, :t, :u, :l, true)"), {"o": org, "ti": title, "t": today, "u": u, "l": link})
            made += 1
    return made
