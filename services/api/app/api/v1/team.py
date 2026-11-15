import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.mailer import Mailer, get_mailer
from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser
from app.core.tenancy import Ctx, current_user, public_session, request_info, require, user_session
from app.services import team

router = APIRouter(tags=["team"])
MailerDep = Depends(get_mailer)


class MemberPatch(BaseModel):
    role_key: str | None = None
    status: str | None = None


class InviteIn(BaseModel):
    email: str
    role_key: str = "ar_specialist"


class PermissionsIn(BaseModel):
    permissions: list[str]


@router.get("/members")
def members(ctx: Ctx = Depends(require("team.view"))) -> dict[str, list[dict[str, Any]]]:
    return {"data": team.list_members(ctx.db)}


@router.patch("/members/{member_id}")
def patch_member(member_id: uuid.UUID, body: MemberPatch, ctx: Ctx = Depends(require("team.manage"))) -> dict[str, Any]:
    return team.change_member(ctx.db, ctx.org_id, ctx.user, member_id, body.role_key, body.status, ctx.info)


@router.get("/members/invitations")
def invitations(ctx: Ctx = Depends(require("team.manage"))) -> dict[str, list[dict[str, Any]]]:
    return {"data": team.list_invitations(ctx.db)}


@router.post("/members/invitations", status_code=201)
def create_invitation(body: InviteIn, ctx: Ctx = Depends(require("team.manage")), mailer: Mailer = MailerDep) -> dict[str, Any]:
    return team.invite(ctx.db, ctx.org_id, ctx.user, body.email, body.role_key, mailer, ctx.info, get_settings().web_url)


@router.post("/members/invitations/{inv_id}/resend", status_code=204)
def resend_invitation(inv_id: uuid.UUID, ctx: Ctx = Depends(require("team.manage")), mailer: Mailer = MailerDep) -> None:
    team.resend(ctx.db, ctx.org_id, ctx.user, inv_id, mailer, ctx.info, get_settings().web_url)


@router.delete("/members/invitations/{inv_id}", status_code=204)
def revoke_invitation(inv_id: uuid.UUID, ctx: Ctx = Depends(require("team.manage"))) -> None:
    team.revoke(ctx.db, ctx.org_id, ctx.user, inv_id, ctx.info)


@router.get("/invitations/{token}")
def describe_invitation(token: str, db: Session = Depends(public_session, scope="function")) -> dict[str, Any]:
    return team.describe(db, token)


@router.post("/invitations/{token}/accept")
def accept_invitation(token: str, user: AuthUser = Depends(current_user), db: Session = Depends(user_session, scope="function"),
                      info: RequestInfo = Depends(request_info)) -> dict[str, Any]:
    return team.accept(db, user, token, info)


@router.get("/roles/ar/permissions")
def get_ar_permissions(ctx: Ctx = Depends(require("team.view"))) -> dict[str, list[dict[str, Any]]]:
    return {"data": team.ar_permissions(ctx.db)}


@router.put("/roles/ar/permissions", status_code=204)
def put_ar_permissions(body: PermissionsIn, ctx: Ctx = Depends(require("team.manage"))) -> None:
    team.set_ar_permissions(ctx.db, ctx.org_id, ctx.user, set(body.permissions), ctx.info)
