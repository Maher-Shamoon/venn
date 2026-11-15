import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser
from app.core.tenancy import Ctx, current_user, org_context, request_info, require, user_session
from app.services import organizations

router = APIRouter(tags=["identity"])


class Membership(BaseModel):
    organization_id: uuid.UUID
    organization_name: str
    role_key: str
    role_name: str
    status: str


class Me(BaseModel):
    id: uuid.UUID
    email: str
    email_verified: bool
    full_name: str
    memberships: list[Membership]


class OrgContext(BaseModel):
    organization_id: uuid.UUID
    role_key: str
    permissions: list[str]


class OrganizationIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    industry: str | None = None
    company_size: str | None = None
    country: str | None = Field(default=None, min_length=2, max_length=2)
    default_currency: str | None = Field(default=None, min_length=3, max_length=3)
    timezone: str | None = None
    website: str | None = None


class OrganizationOut(BaseModel):
    id: uuid.UUID
    name: str
    default_currency: str
    timezone: str
    status: str
    version: int


@router.get("/me")
def me(user: AuthUser = Depends(current_user), db: Session = Depends(user_session)) -> Me:
    """The signed-in user and the organizations they belong to. Needs no organization header."""
    rows = db.execute(text(
        "select o.id, o.name, r.key, r.name as role_name, m.status from memberships m "
        "join organizations o on o.id = m.organization_id "
        "join roles r on r.id = m.role_id and r.organization_id = m.organization_id "
        "where m.user_id = :u order by o.name"), {"u": user.id}).all()
    return Me(id=user.id, email=user.email, email_verified=user.email_verified,
              full_name=user.name or user.email,
              memberships=[Membership(organization_id=r.id, organization_name=r.name, role_key=r.key,
                                      role_name=r.role_name, status=r.status) for r in rows])


@router.get("/me/context")
def context(ctx: Ctx = Depends(org_context)) -> OrgContext:
    """Role and permissions in the organization named by X-Organization-Id. The UI uses it only to hide controls."""
    return OrgContext(organization_id=ctx.org_id, role_key=ctx.role_key, permissions=sorted(ctx.permissions))


@router.post("/organizations", status_code=201)
def create_organization(body: OrganizationIn, user: AuthUser = Depends(current_user),
                        db: Session = Depends(user_session),
                        info: RequestInfo = Depends(request_info)) -> OrganizationOut:
    if not user.email_verified:
        from app.core.errors import ApiError
        raise ApiError(403, "email_not_verified", "Verify your email address to continue.")
    org = organizations.create_organization(db, user, info=info, **body.model_dump())
    row = db.execute(text("select id, name, default_currency, timezone, status, version "
                          "from organizations where id = :o"), {"o": org}).one()
    return OrganizationOut(**row._mapping)


@router.get("/organization")
def get_organization(ctx: Ctx = Depends(require("settings.view"))) -> OrganizationOut:
    row = ctx.db.execute(text("select id, name, default_currency, timezone, status, version from organizations")).one()
    return OrganizationOut(**row._mapping)
