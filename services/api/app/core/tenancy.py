"""Request pipeline: authenticate -> verify organization membership -> set tenancy in the database -> permissions.

Every request runs in one transaction as the non-owner role `venn_app` with `app.org_id` / `app.user_id`
set, so PostgreSQL row-level security enforces tenancy even if application code forgets a filter.
"""

import uuid
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import date

from fastapi import Depends, Header, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import clock
from app.core.config import get_settings
from app.core.db import get_engine
from app.core.errors import ApiError
from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser, decode_token


def request_info(request: Request) -> RequestInfo:
    return RequestInfo(getattr(request.state, "request_id", None), request.client.host if request.client else None,
                       request.headers.get("user-agent"))


def current_user(authorization: str | None = Header(default=None)) -> AuthUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError(401, "unauthenticated", "Sign in to continue.")
    return decode_token(authorization[7:].strip(), get_settings())


def _scoped_session(user: AuthUser, org_id: uuid.UUID | None) -> Session:
    s = Session(get_engine(), expire_on_commit=False)
    # One round trip: switch to the non-owner role and set the tenancy values (the same as SET LOCAL ROLE + two set_config calls).
    s.execute(text("select set_config('role', 'venn_app', true), set_config('app.user_id', :u, true), set_config('app.org_id', :o, true)"),
              {"u": str(user.id), "o": str(org_id) if org_id else ""})
    return s


def user_session(user: AuthUser = Depends(current_user)) -> Iterator[Session]:
    """A session for endpoints that run before any organization exists (profile, create organization).

    Used with scope="function" so the commit happens before the response is sent: a failed commit is an error, never a silent 200.
    """
    s = _scoped_session(user, None)
    try:
        yield s
        s.commit()
    except BaseException:
        s.rollback()
        raise
    finally:
        s.close()


def public_session() -> Iterator[Session]:
    """No user and no organization: only for endpoints that answer to a secret token (invitations)."""
    s = Session(get_engine(), expire_on_commit=False)
    s.execute(text("set local role venn_app"))
    try:
        yield s
        s.commit()
    except BaseException:
        s.rollback()
        raise
    finally:
        s.close()


@dataclass
class Ctx:
    db: Session
    user: AuthUser
    org_id: uuid.UUID
    role_key: str
    permissions: frozenset[str]
    info: RequestInfo
    tz: str = "UTC"

    def today(self) -> date:
        """Today in the organization's time zone: overdue is decided here, never in UTC."""
        return clock.today(self.tz)


def org_context(
    user: AuthUser = Depends(current_user),
    info: RequestInfo = Depends(request_info),
    x_organization_id: str | None = Header(default=None),
) -> Iterator[Ctx]:
    if not user.email_verified:
        raise ApiError(403, "email_not_verified", "Verify your email address to continue.")
    if not x_organization_id:
        raise ApiError(400, "bad_request", "X-Organization-Id header is required.")
    try:
        org_id = uuid.UUID(x_organization_id)
    except ValueError as e:
        raise ApiError(400, "bad_request", "X-Organization-Id must be a UUID.") from e

    s = _scoped_session(user, org_id)
    try:
        # Filter by organization explicitly: the own_memberships policy also exposes the user's other organizations.
        # One query for membership, role, permissions and the organization's time zone.
        row = s.execute(
            text("select m.status, r.key, o.timezone, coalesce(array_agg(rp.permission_key) filter (where rp.permission_key is not null), '{}') as perms "
                 "from memberships m join roles r on r.id = m.role_id and r.organization_id = m.organization_id "
                 "join organizations o on o.id = m.organization_id left join role_permissions rp on rp.role_id = r.id "
                 "where m.user_id = :u and m.organization_id = :o group by m.status, r.key, o.timezone"),
            {"u": user.id, "o": org_id}).first()
        if row is None:
            raise ApiError(403, "not_a_member", "You are not a member of this organization.")
        if row.status != "active":
            raise ApiError(403, "membership_suspended", "Your access to this organization is suspended.")
        yield Ctx(s, user, org_id, row.key, frozenset(row.perms), info, row.timezone)
        s.commit()
    except BaseException:
        s.rollback()
        raise
    finally:
        s.close()


def require(permission: str):  # type: ignore[no-untyped-def]
    """Dependency factory: `ctx: Ctx = Depends(require("invoices.view"))`. The server decides, never the client."""

    def dep(ctx: Ctx = Depends(org_context, scope="function")) -> Ctx:
        if permission not in ctx.permissions:
            raise ApiError(403, "permission_denied", "You do not have permission to do that.")
        return ctx

    dep.required_permission = permission  # type: ignore[attr-defined]
    return dep
