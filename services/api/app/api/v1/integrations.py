import uuid
from typing import Any

from fastapi import APIRouter, Depends, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.errors import ApiError
from app.core.tenancy import Ctx, require
from app.services import integrations as svc
from app.services import jobs

router = APIRouter(tags=["integrations"])


class StripeKeyIn(BaseModel):
    key: str = Field(min_length=10, max_length=300)


@router.get("/integrations")
def list_integrations(ctx: Ctx = Depends(require("integrations.view"))) -> dict[str, Any]:
    return {"data": svc.list_status(ctx.db)}


@router.post("/integrations/stripe/connect")
def stripe_connect(body: StripeKeyIn, ctx: Ctx = Depends(require("integrations.manage"))) -> dict[str, Any]:
    return svc.connect_stripe(ctx.db, ctx.org_id, ctx.user, body.key, ctx.info)


@router.post("/integrations/stripe/sync")
def stripe_sync(ctx: Ctx = Depends(require("integrations.manage"))) -> dict[str, Any]:
    return svc.sync_stripe(ctx.db, ctx.org_id, ctx.user, ctx.info)


@router.delete("/integrations/{provider}", status_code=204)
def disconnect(provider: str, ctx: Ctx = Depends(require("integrations.manage"))) -> Response:
    svc.disconnect(ctx.db, ctx.org_id, ctx.user, provider, ctx.info)
    return Response(status_code=204)


@router.get("/integrations/gmail/start")
def gmail_start(ctx: Ctx = Depends(require("integrations.manage"))) -> dict[str, str]:
    return {"url": svc.gmail_start(ctx.org_id, ctx.user)}


@router.get("/integrations/gmail/callback", include_in_schema=False)
def gmail_callback(code: str = "", state: str = "", error: str = "") -> RedirectResponse:
    """Google sends the person's browser here. No sign-in header exists on this request: the signed state says which organization and person began the flow."""
    back = get_settings().web_url.rstrip("/") + "/app/integrations"
    if error or not code or not state:
        return RedirectResponse(f"{back}?error=gmail_denied", status_code=303)
    try:
        org, user, refresh, email = svc.gmail_finish(code, state)
    except ApiError:
        return RedirectResponse(f"{back}?error=gmail_failed", status_code=303)
    s = jobs.scoped(org)
    try:
        svc.gmail_store(s, org, user, refresh, email)
        s.commit()
    except Exception:  # noqa: BLE001
        s.rollback()
        return RedirectResponse(f"{back}?error=gmail_failed", status_code=303)
    finally:
        s.close()
    return RedirectResponse(f"{back}?connected=gmail", status_code=303)


@router.get("/investigations/{iid}/emails")
def case_emails(iid: uuid.UUID, ctx: Ctx = Depends(require("investigations.manage"))) -> dict[str, Any]:
    return {"data": svc.gmail_for_case(ctx.db, iid)}
