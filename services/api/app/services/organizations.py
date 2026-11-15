import uuid

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser
from app.services import audit
from app.services.permissions import ALL_KEYS, AR_DEFAULT

ROLES = [("owner", "Owner", True, ALL_KEYS), ("ar_specialist", "AR specialist", False, AR_DEFAULT)]


def ensure_profile(db: Session, user: AuthUser) -> None:
    """First sight of a Supabase user: mirror them into profiles (id = auth user id)."""
    db.execute(
        text("insert into profiles (id, email, full_name) values (:id, :e, :n) "
             "on conflict (id) do update set email = excluded.email, updated_at = now()"),
        {"id": user.id, "e": user.email, "n": user.name or user.email},
    )


def create_organization(db: Session, user: AuthUser, name: str, info: RequestInfo | None = None,
                        **fields: str) -> uuid.UUID:
    """Creates the organization, its two system roles with their permissions, and the creator as Owner.

    Runs in the caller's transaction: either everything exists afterwards or nothing does.
    """
    if not name.strip():
        raise ApiError(422, "validation_error", "Organization name is required.",
                       [{"field": "name", "code": "required", "message": "Organization name is required."}])
    org = uuid.uuid4()
    ensure_profile(db, user)
    # The new organization is the tenant for every insert below (row-level security checks it).
    db.execute(text("select set_config('app.org_id', :o, true)"), {"o": str(org)})
    allowed = {"industry", "company_size", "country", "default_currency", "timezone", "website"}
    extra = {k: v for k, v in fields.items() if k in allowed and v}
    cols = "".join(f", {k}" for k in extra)
    vals = "".join(f", :{k}" for k in extra)
    # Column names come from the fixed `allowed` set above, never from user input.
    db.execute(text(f"insert into organizations (id, name, created_by{cols}) values (:id, :n, :u{vals})"),  # noqa: S608
               {"id": org, "n": name.strip(), "u": user.id, **extra})
    owner_role: uuid.UUID | None = None
    for key, label, locked, perms in ROLES:
        rid = db.execute(
            text("insert into roles (organization_id, key, name, is_locked) values (:o, :k, :n, :l) returning id"),
            {"o": org, "k": key, "n": label, "l": locked}).scalar_one()
        for p in sorted(perms):
            db.execute(text("insert into role_permissions (role_id, organization_id, permission_key) "
                            "values (:r, :o, :p)"), {"r": rid, "o": org, "p": p})
        if key == "owner":
            owner_role = rid
    db.execute(text("insert into memberships (organization_id, user_id, role_id) values (:o, :u, :r)"),
               {"o": org, "u": user.id, "r": owner_role})
    db.execute(text("update profiles set last_active_org_id = :o where id = :u"), {"o": org, "u": user.id})
    audit.record(db, org, "organization.created", actor_id=user.id, record_type="organization", record_id=org,
                 after={"name": name.strip(), **extra}, info=info)
    return org
