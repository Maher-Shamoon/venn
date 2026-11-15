from typing import Any

from fastapi import APIRouter, Depends, Header

from app.core.tenancy import Ctx, require
from app.services import settings as svc

router = APIRouter(tags=["settings"])


def _version(if_match: str | None) -> int | None:
    try:
        return int(if_match.strip('"')) if if_match else None
    except ValueError:
        return None


@router.get("/settings")
def get_settings(ctx: Ctx = Depends(require("settings.view"))) -> dict[str, Any]:
    return svc.read(ctx.db)


@router.patch("/settings/company")
def patch_company(body: svc.CompanyIn, ctx: Ctx = Depends(require("settings.manage")), if_match: str | None = Header(default=None)) -> dict[str, Any]:
    return svc.update_company(ctx.db, ctx.org_id, ctx.user, body, _version(if_match), ctx.info)


@router.patch("/settings/financial")
def patch_financial(body: svc.FinancialIn, ctx: Ctx = Depends(require("settings.manage")), if_match: str | None = Header(default=None)) -> dict[str, Any]:
    return svc.update_financial(ctx.db, ctx.org_id, ctx.user, body, _version(if_match), ctx.info)
