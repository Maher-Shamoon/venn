import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import text

from app.core.tenancy import Ctx, require

router = APIRouter(tags=["audit"])


class AuditEvent(BaseModel):
    id: uuid.UUID
    seq: int
    occurred_at: datetime
    actor_type: str
    actor_id: uuid.UUID | None
    actor_name: str | None
    action: str
    group: str
    record_type: str | None
    record_id: str | None
    before: dict[str, Any] | None
    after: dict[str, Any] | None
    request_id: str | None


class AuditPage(BaseModel):
    data: list[AuditEvent]
    next_cursor: int | None


@router.get("/audit-events")
def list_events(
    group: str | None = None,
    actor: uuid.UUID | None = None,
    record_type: str | None = None,
    record_id: str | None = None,
    after: datetime | None = Query(default=None, alias="from"),
    before: datetime | None = Query(default=None, alias="to"),
    cursor: int | None = Query(default=None, description="seq of the last row of the previous page"),
    limit: int = Query(default=25, ge=1, le=100),
    ctx: Ctx = Depends(require("audit.view")),
) -> AuditPage:
    """Newest first. `group` is the part of the action before the dot (e.g. `invoice`, `approval`)."""
    rows = ctx.db.execute(text("""
        select e.*, split_part(e.action, '.', 1) as grp, p.full_name as actor_name
        from audit_events e left join profiles p on p.id = e.actor_id
        where (cast(:g as text) is null or split_part(e.action, '.', 1) = :g)
          and (cast(:a as uuid) is null or e.actor_id = :a)
          and (cast(:rt as text) is null or e.record_type = :rt)
          and (cast(:rid as text) is null or e.record_id = :rid)
          and (cast(:f as timestamptz) is null or e.occurred_at >= :f)
          and (cast(:t as timestamptz) is null or e.occurred_at <= :t)
          and (cast(:c as bigint) is null or e.seq < :c)
        order by e.seq desc limit :n
    """), {"g": group, "a": actor, "rt": record_type, "rid": record_id, "f": after, "t": before,
           "c": cursor, "n": limit + 1}).all()
    page = rows[:limit]
    return AuditPage(
        data=[AuditEvent(id=r.id, seq=r.seq, occurred_at=r.occurred_at, actor_type=r.actor_type, actor_id=r.actor_id,
                         actor_name=r.actor_name, action=r.action, group=r.grp, record_type=r.record_type,
                         record_id=r.record_id, before=r.before, after=r.after, request_id=r.request_id)
              for r in page],
        next_cursor=page[-1].seq if len(rows) > limit else None,
    )


@router.get("/audit-events/verify")
def verify(ctx: Ctx = Depends(require("audit.view"))) -> dict[str, Any]:
    """Recomputes the hash chain of this organization's audit log. `first_broken_seq` names the first entry that was changed, if any."""
    from app.services import audit

    broken = audit.verify_chain(ctx.db, ctx.org_id)
    count = ctx.db.execute(text("select count(*) from audit_events")).scalar_one()
    return {"valid": broken is None, "first_broken_seq": broken, "events": int(count)}
