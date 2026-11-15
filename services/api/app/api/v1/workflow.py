import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.mailer import Mailer, get_mailer
from app.core.tenancy import Ctx, require
from app.services import collections, disputes, notifications

router = APIRouter(tags=["workflow"])
PageQ = Annotated[int, Query(ge=1)]
LimitQ = Annotated[int, Query(ge=1, le=100)]


class ReadIn(BaseModel):
    ids: list[uuid.UUID] | None = Field(default=None, max_length=200)


# --------------------------------------------------------------------------------------------- notifications, tasks
@router.get("/notifications")
def list_notifications(unread: bool = False, page: PageQ = 1, limit: LimitQ = 25, ctx: Ctx = Depends(require("dashboard.operational"))) -> dict[str, Any]:
    rows, total, unread_n = notifications.list_notifications(ctx.db, ctx.user.id, unread, page, limit)
    return {"data": rows, "total": total, "unread": unread_n, "page": page, "limit": limit}


@router.post("/notifications/read")
def mark_read(body: ReadIn, ctx: Ctx = Depends(require("dashboard.operational"))) -> dict[str, Any]:
    return {"marked": notifications.mark_read(ctx.db, ctx.user.id, body.ids)}


@router.get("/tasks")
def list_tasks(ctx: Ctx = Depends(require("dashboard.operational"))) -> dict[str, Any]:
    return {"data": notifications.list_tasks(ctx.db, ctx.user.id, "approvals.decide" in ctx.permissions)}


@router.post("/tasks", status_code=201)
def create_task(body: notifications.TaskIn, ctx: Ctx = Depends(require("dashboard.operational"))) -> dict[str, Any]:
    return notifications.create_task(ctx.db, ctx.org_id, ctx.user.id, body)


@router.post("/tasks/{tid}/toggle")
def toggle_task(tid: uuid.UUID, ctx: Ctx = Depends(require("dashboard.operational"))) -> dict[str, Any]:
    return notifications.toggle_task(ctx.db, ctx.user.id, tid, "approvals.decide" in ctx.permissions)


# ------------------------------------------------------------------------------------------------------- disputes
@router.get("/disputes")
def list_disputes(filter: str = "all", q: str | None = None, ctx: Ctx = Depends(require("disputes.view"))) -> dict[str, Any]:
    return {"data": disputes.list_disputes(ctx.db, filter, q, ctx.today())}


@router.post("/disputes", status_code=201)
def open_dispute(body: disputes.DisputeIn, ctx: Ctx = Depends(require("disputes.manage"))) -> dict[str, Any]:
    return disputes.open_dispute(ctx.db, ctx.org_id, ctx.user, body, ctx.today(), ctx.info)


@router.get("/disputes/{did}")
def get_dispute(did: uuid.UUID, ctx: Ctx = Depends(require("disputes.view"))) -> dict[str, Any]:
    return disputes.get(ctx.db, did, ctx.today())


@router.post("/disputes/{did}/notes", status_code=201)
def dispute_note(did: uuid.UUID, body: disputes.NoteIn, ctx: Ctx = Depends(require("disputes.manage"))) -> dict[str, Any]:
    return disputes.add_note(ctx.db, ctx.org_id, ctx.user, did, body.text, ctx.today(), ctx.info)


@router.post("/disputes/{did}/status")
def dispute_status(did: uuid.UUID, body: disputes.StatusIn, ctx: Ctx = Depends(require("disputes.manage"))) -> dict[str, Any]:
    return disputes.set_status(ctx.db, ctx.org_id, ctx.user, did, body.status, ctx.today(), ctx.info)


@router.post("/disputes/{did}/resolve")
def dispute_resolve(did: uuid.UUID, body: disputes.ResolveIn, ctx: Ctx = Depends(require("disputes.manage"))) -> dict[str, Any]:
    return disputes.resolve(ctx.db, ctx.org_id, ctx.user, did, body, ctx.today(), ctx.info)


# --------------------------------------------------------------------------------------------------- collections
@router.get("/collections")
def list_cases(filter: str = "all", ctx: Ctx = Depends(require("collections.view"))) -> dict[str, Any]:
    return {"data": collections.list_cases(ctx.db, ctx.org_id, ctx.user.id, filter, ctx.today())}


@router.get("/collections/{cid}")
def get_case(cid: uuid.UUID, ctx: Ctx = Depends(require("collections.view"))) -> dict[str, Any]:
    return collections.get(ctx.db, cid, ctx.today())


@router.post("/collections/{cid}/drafts")
def draft(cid: uuid.UUID, body: collections.DraftIn, ctx: Ctx = Depends(require("collections.draft"))) -> dict[str, Any]:
    return collections.draft(ctx.db, ctx.org_id, ctx.user, cid, body.tone, ctx.today(), ctx.info)


@router.post("/collections/{cid}/send")
def send(cid: uuid.UUID, body: collections.SendIn, ctx: Ctx = Depends(require("collections.send")), mailer: Mailer = Depends(get_mailer)) -> dict[str, Any]:
    return collections.send(ctx.db, ctx.org_id, ctx.user, mailer, cid, body, ctx.today(), ctx.info)


@router.post("/collections/{cid}/promise")
def promise(cid: uuid.UUID, body: collections.PromiseIn, ctx: Ctx = Depends(require("collections.draft"))) -> dict[str, Any]:
    return collections.set_promise(ctx.db, ctx.org_id, ctx.user, cid, body, ctx.today(), ctx.info)


@router.post("/collections/{cid}/notes", status_code=201)
def case_note(cid: uuid.UUID, body: collections.NoteIn, ctx: Ctx = Depends(require("collections.draft"))) -> dict[str, Any]:
    return collections.add_note(ctx.db, ctx.org_id, ctx.user, cid, body.text, ctx.today(), ctx.info)


@router.post("/collections/{cid}/final-notice")
def final_notice(cid: uuid.UUID, ctx: Ctx = Depends(require("adjustments.request"))) -> dict[str, Any]:
    return collections.request_final_notice(ctx.db, ctx.org_id, ctx.user, cid, ctx.today(), ctx.info)
