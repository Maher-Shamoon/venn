import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from app.core.tenancy import Ctx, require
from app.schemas.ledger import Page, ReasonIn
from app.services import reconciliation as rec

router = APIRouter(prefix="/reconciliation", tags=["reconciliation"])
PageQ = Annotated[int, Query(ge=1)]
LimitQ = Annotated[int, Query(ge=1, le=100)]


@router.post("/runs", status_code=201)
def start_run(ctx: Ctx = Depends(require("reconciliation.run"))) -> dict[str, Any]:
    return rec.run(ctx.db, ctx.org_id, ctx.user, ctx.today(), ctx.info)


@router.get("/runs")
def runs(ctx: Ctx = Depends(require("payments.view"))) -> dict[str, Any]:
    return {"data": rec.list_runs(ctx.db)}


@router.get("/suggestions")
def suggestions(status: str = "pending", page: PageQ = 1, limit: LimitQ = 25, ctx: Ctx = Depends(require("payments.view"))) -> Page[dict[str, Any]]:
    rows, total = rec.list_suggestions(ctx.db, status, page, limit)
    return Page(data=rows, total=total, page=page, limit=limit)


@router.post("/suggestions/{sid}/accept")
def accept(sid: uuid.UUID, ctx: Ctx = Depends(require("reconciliation.allocate"))) -> dict[str, Any]:
    return rec.accept(ctx.db, ctx.org_id, ctx.user, sid, ctx.info)


@router.post("/suggestions/{sid}/reject")
def reject(sid: uuid.UUID, body: ReasonIn, ctx: Ctx = Depends(require("reconciliation.allocate"))) -> dict[str, Any]:
    return rec.reject(ctx.db, ctx.org_id, ctx.user, sid, body.reason, ctx.info)


@router.get("/auto-applied")
def auto_applied(page: PageQ = 1, limit: LimitQ = 25, ctx: Ctx = Depends(require("payments.view"))) -> Page[dict[str, Any]]:
    rows, total = rec.list_auto_applied(ctx.db, page, limit)
    return Page(data=rows, total=total, page=page, limit=limit)


@router.get("/discrepancies")
def discrepancies(status: str = "open", page: PageQ = 1, limit: LimitQ = 25, ctx: Ctx = Depends(require("payments.view"))) -> Page[dict[str, Any]]:
    rows, total = rec.list_discrepancies(ctx.db, status, page, limit)
    return Page(data=rows, total=total, page=page, limit=limit)


@router.post("/discrepancies/{did}/resolve")
def resolve(did: uuid.UUID, body: ReasonIn, ctx: Ctx = Depends(require("reconciliation.allocate"))) -> dict[str, Any]:
    return rec.resolve_discrepancy(ctx.db, ctx.org_id, ctx.user, did, body.reason, ctx.info)
