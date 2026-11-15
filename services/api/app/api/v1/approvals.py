import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.tenancy import Ctx, require
from app.schemas.ledger import Page
from app.services import approvals as svc

router = APIRouter(tags=["approvals"])
PageQ = Annotated[int, Query(ge=1)]
LimitQ = Annotated[int, Query(ge=1, le=100)]


class ReplyIn(BaseModel):
    comment: str = Field(min_length=1, max_length=2000)


@router.get("/approvals")
def list_approvals(tab: str = "pending", page: PageQ = 1, limit: LimitQ = 25, ctx: Ctx = Depends(require("approvals.view_own"))) -> Page[dict[str, Any]]:
    rows, total = svc.list_requests(ctx.db, ctx.org_id, ctx.user.id, "approvals.decide" in ctx.permissions, tab, page, limit)
    return Page(data=rows, total=total, page=page, limit=limit)


@router.post("/approvals", status_code=201)
def request_adjustment(body: svc.RequestIn, ctx: Ctx = Depends(require("adjustments.request"))) -> dict[str, Any]:
    return svc.create(ctx.db, ctx.org_id, ctx.user, body, ctx.info)


@router.get("/approvals/{rid}")
def get_approval(rid: uuid.UUID, ctx: Ctx = Depends(require("approvals.view_own"))) -> dict[str, Any]:
    svc.expire_due(ctx.db, ctx.org_id)
    return svc.get(ctx.db, ctx.user.id, "approvals.decide" in ctx.permissions, rid)


@router.post("/approvals/{rid}/decision")
def decide(rid: uuid.UUID, body: svc.DecisionIn, ctx: Ctx = Depends(require("approvals.decide"))) -> dict[str, Any]:
    return svc.decide(ctx.db, ctx.org_id, ctx.user, rid, body, ctx.info)


@router.post("/approvals/{rid}/reply")
def reply(rid: uuid.UUID, body: ReplyIn, ctx: Ctx = Depends(require("approvals.view_own"))) -> dict[str, Any]:
    return svc.reply(ctx.db, ctx.org_id, ctx.user, rid, body.comment, ctx.info)


@router.post("/approvals/{rid}/withdraw")
def withdraw(rid: uuid.UUID, ctx: Ctx = Depends(require("approvals.view_own"))) -> dict[str, Any]:
    return svc.withdraw(ctx.db, ctx.org_id, ctx.user, rid, ctx.info)


@router.get("/settings/approval-policies")
def get_policies(ctx: Ctx = Depends(require("settings.view"))) -> dict[str, Any]:
    return {"data": svc.read_policies(ctx.db)}


@router.put("/settings/approval-policies")
def put_policy(body: svc.PolicyIn, ctx: Ctx = Depends(require("settings.manage"))) -> dict[str, Any]:
    return {"data": svc.set_policy(ctx.db, ctx.org_id, ctx.user, body, ctx.info)}
