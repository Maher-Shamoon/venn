import uuid
from typing import Any

from fastapi import APIRouter, Depends, Response

from app.core.tenancy import Ctx, require
from app.services import audit, dashboard, shell

router = APIRouter(tags=["dashboard"])


@router.get("/dashboard/owner")
def owner(range: str = "30d", ctx: Ctx = Depends(require("dashboard.executive"))) -> dict[str, Any]:
    return dashboard.owner(ctx.db, range, ctx.today())


@router.get("/dashboard/ar")
def ar(ctx: Ctx = Depends(require("dashboard.operational"))) -> dict[str, Any]:
    return dashboard.ar(ctx.db, ctx.user.id, ctx.today())


def _can(ctx: Ctx) -> tuple[bool, bool]:
    return "reports.financial" in ctx.permissions, "reports.operational" in ctx.permissions


@router.get("/reports")
def reports(ctx: Ctx = Depends(require("analytics.view"))) -> dict[str, Any]:
    return {"data": dashboard.catalog(*_can(ctx))}


@router.get("/reports/{slug}.csv")
def export(slug: str, range: str = "30d", customer_id: uuid.UUID | None = None, ctx: Ctx = Depends(require("reports.export"))) -> Response:
    rep = dashboard.report(ctx.db, slug, range, ctx.today(), customer_id, *_can(ctx))
    audit.record(ctx.db, ctx.org_id, "report.exported", actor_id=ctx.user.id, record_type="report", record_id=slug, after={"range": range, "rows": len(rep["rows"])}, info=ctx.info)
    return Response(dashboard.to_csv(rep), media_type="text/csv; charset=utf-8", headers={"Content-Disposition": f'attachment; filename="{slug}-{range}.csv"', "X-Content-Type-Options": "nosniff"})


@router.get("/reports/{slug}")
def report(slug: str, range: str = "30d", customer_id: uuid.UUID | None = None, ctx: Ctx = Depends(require("analytics.view"))) -> dict[str, Any]:
    return dashboard.report(ctx.db, slug, range, ctx.today(), customer_id, *_can(ctx))


@router.get("/shell")
def shell_frame(ctx: Ctx = Depends(require("dashboard.operational"))) -> dict[str, Any]:
    return shell.frame(ctx.db, ctx.user.id, ctx.permissions)


@router.get("/search")
def search(q: str = "", ctx: Ctx = Depends(require("dashboard.operational"))) -> dict[str, Any]:
    return shell.search(ctx.db, q, ctx.permissions)
