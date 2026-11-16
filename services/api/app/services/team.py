import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import CursorResult, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.orm import Session

from app.core.errors import ApiError
from app.core.mailer import Mailer, MailError, Message
from app.core.requestinfo import RequestInfo
from app.core.security import AuthUser
from app.services import audit
from app.services.permissions import ALL_KEYS, AR_ALWAYS_ON, NON_GRANTABLE

INVITE_DAYS = 7
ROLE_KEYS = {"owner", "ar_specialist"}


def _hash(token: str) -> bytes:
    return hashlib.sha256(token.encode()).digest()


def _check(cond: bool, status: int, code: str, detail: str) -> None:
    if not cond:
        raise ApiError(status, code, detail)


# ----------------------------------------------------------------------------------------------- members
def list_members(db: Session) -> list[dict[str, Any]]:
    rows = db.execute(text(
        "select m.id, m.user_id, p.full_name, p.email, r.key as role_key, r.name as role_name, m.status, "
        "m.joined_at from memberships m join profiles p on p.id = m.user_id "
        "join roles r on r.id = m.role_id and r.organization_id = m.organization_id order by p.full_name"))
    return [dict(r._mapping) for r in rows]


def change_member(db: Session, org: uuid.UUID, actor: AuthUser, member_id: uuid.UUID, role_key: str | None,
                  status: str | None, info: RequestInfo) -> dict[str, Any]:
    cur = db.execute(text("select m.id, m.user_id, m.status, r.key as role_key from memberships m "
                          "join roles r on r.id = m.role_id and r.organization_id = m.organization_id "
                          "where m.id = :i and m.organization_id = :o"), {"i": member_id, "o": org}).first()
    _check(cur is not None, 404, "not_found", "Member not found.")
    assert cur is not None
    _check(status is None or status in {"active", "suspended"}, 422, "validation_error", "Status must be active or suspended.")
    _check(role_key is None or role_key in ROLE_KEYS, 422, "validation_error", "Unknown role.")
    _check(not (status == "suspended" and cur.user_id == actor.id), 422, "business_rule_violation",
           "You cannot suspend yourself.")
    if role_key and role_key != cur.role_key:
        db.execute(text("update memberships set role_id = (select id from roles where organization_id = :o and key = :k) "
                        "where id = :i"), {"o": org, "k": role_key, "i": member_id})
    if status and status != cur.status:
        db.execute(text("update memberships set status = :s, suspended_at = case when :s = 'suspended' then now() end "
                        "where id = :i"), {"s": status, "i": member_id})
    try:  # the "at least one active owner" rule is deferred to commit; check it now to answer with a clear error
        db.execute(text("set constraints all immediate"))
    except DBAPIError as e:
        raise ApiError(422, "business_rule_violation", "An organization must keep at least one active owner.",
                       [{"field": "role_key", "code": "last_owner", "message": "last_owner"}]) from e
    after = {"role_key": role_key or cur.role_key, "status": status or cur.status}
    audit.record(db, org, "member.updated", actor_id=actor.id, record_type="membership", record_id=member_id,
                 before={"role_key": cur.role_key, "status": cur.status}, after=after, info=info)
    return {"id": member_id, **after}


# ------------------------------------------------------------------------------------------- invitations
def list_invitations(db: Session) -> list[dict[str, Any]]:
    rows = db.execute(text(
        "select i.id, i.email, r.key as role_key, i.status, i.expires_at, i.last_sent_at, i.send_count "
        "from invitations i join roles r on r.id = i.role_id and r.organization_id = i.organization_id "
        "where i.status = 'pending' and i.expires_at > now() order by i.created_at desc"))
    return [dict(r._mapping) for r in rows]


def _send(mailer: Mailer, org_name: str, email: str, token: str, web_base: str) -> dict[str, Any]:
    """Emails the invitation. The link is also returned to the person inviting, so a message that lands in spam (or is refused) never blocks the invitation."""
    link = f"{web_base}/invite/{token}"
    try:
        mailer.send(Message(email, f"You are invited to {org_name} on venn", f"Open this link to join {org_name}: {link}\nIt expires in {INVITE_DAYS} days."))
        emailed = True
    except MailError:
        emailed = False
    return {"link": link, "emailed": emailed}


def invite(db: Session, org: uuid.UUID, actor: AuthUser, email: str, role_key: str, mailer: Mailer,
           info: RequestInfo, web_base: str) -> dict[str, Any]:
    email = email.strip().lower()
    _check("@" in email and "." in email.split("@")[-1] and " " not in email, 422, "validation_error",
           "Enter a valid email address.")
    _check(role_key in ROLE_KEYS, 422, "validation_error", "Unknown role.")
    _check(db.execute(text("select 1 from memberships m join profiles p on p.id = m.user_id "
                           "where m.organization_id = :o and lower(p.email) = :e and m.status <> 'removed'"),
                      {"o": org, "e": email}).first() is None, 409, "duplicate", f"{email} is already on the team.")
    _check(db.execute(text("select 1 from invitations where organization_id = :o and lower(email) = :e "
                           "and status = 'pending' and expires_at > now()"), {"o": org, "e": email}).first() is None,
           409, "duplicate", f"{email} already has a pending invitation.")
    db.execute(text("update invitations set status = 'expired' where organization_id = :o and lower(email) = :e "
                    "and status = 'pending' and expires_at <= now()"), {"o": org, "e": email})
    token = secrets.token_urlsafe(32)
    row = db.execute(text(
        "insert into invitations (organization_id, email, role_id, token_hash, expires_at, invited_by) values "
        "(:o, :e, (select id from roles where organization_id = :o and key = :k), :h, :x, :u) returning id"),
        {"o": org, "e": email, "k": role_key, "h": _hash(token), "x": datetime.now(UTC) + timedelta(days=INVITE_DAYS),
         "u": actor.id}).one()
    name = db.execute(text("select name from organizations where id = :o"), {"o": org}).scalar_one()
    audit.record(db, org, "invitation.created", actor_id=actor.id, record_type="invitation", record_id=row.id,
                 after={"email": email, "role_key": role_key}, info=info)
    sent = _send(mailer, name, email, token, web_base)
    return {"id": row.id, "email": email, "role_key": role_key, "status": "pending", **sent}


def resend(db: Session, org: uuid.UUID, actor: AuthUser, inv_id: uuid.UUID, mailer: Mailer, info: RequestInfo,
           web_base: str) -> dict[str, Any]:
    inv = db.execute(text("select id, email from invitations where id = :i and organization_id = :o and status = 'pending'"),
                     {"i": inv_id, "o": org}).first()
    _check(inv is not None, 404, "not_found", "Invitation not found.")
    assert inv is not None
    token = secrets.token_urlsafe(32)  # the old link stops working
    db.execute(text("update invitations set token_hash = :h, expires_at = :x, last_sent_at = now(), "
                    "send_count = send_count + 1 where id = :i"),
               {"h": _hash(token), "x": datetime.now(UTC) + timedelta(days=INVITE_DAYS), "i": inv_id})
    name = db.execute(text("select name from organizations where id = :o"), {"o": org}).scalar_one()
    audit.record(db, org, "invitation.resent", actor_id=actor.id, record_type="invitation", record_id=inv_id, info=info)
    return _send(mailer, name, inv.email, token, web_base)


def revoke(db: Session, org: uuid.UUID, actor: AuthUser, inv_id: uuid.UUID, info: RequestInfo) -> None:
    res: CursorResult[Any] = db.execute(  # type: ignore[assignment]
        text("update invitations set status = 'revoked' where id = :i and organization_id = :o and status = 'pending'"),
        {"i": inv_id, "o": org})
    n = res.rowcount
    _check(n == 1, 404, "not_found", "Invitation not found.")
    audit.record(db, org, "invitation.revoked", actor_id=actor.id, record_type="invitation", record_id=inv_id, info=info)


def _open(db: Session, token: str) -> Any:
    """Finds a usable invitation from its token. The row-level policy only exposes the row matching this hash."""
    db.execute(text("select set_config('app.invite_hash', :h, true)"), {"h": _hash(token).hex()})
    inv = db.execute(text("select id, organization_id, email, role_id, status, expires_at from invitations")).first()
    if inv is None or inv.status != "pending" or inv.expires_at <= datetime.now(UTC):
        raise ApiError(404, "not_found", "This invitation is not valid. It may have expired or been withdrawn.")
    return inv


def describe(db: Session, token: str) -> dict[str, Any]:
    inv = _open(db, token)
    db.execute(text("select set_config('app.org_id', :o, true)"), {"o": str(inv.organization_id)})
    org = db.execute(text("select name from organizations")).scalar_one()
    role = db.execute(text("select key, name from roles where id = :r"), {"r": inv.role_id}).one()
    return {"organization_name": org, "role_key": role.key, "role_name": role.name, "email": inv.email}


def accept(db: Session, user: AuthUser, token: str, info: RequestInfo) -> dict[str, Any]:
    inv = _open(db, token)
    _check(inv.email.lower() == user.email.lower(), 403, "permission_denied",
           f"This invitation was sent to {inv.email}. Sign in with that address.")
    db.execute(text("select set_config('app.org_id', :o, true)"), {"o": str(inv.organization_id)})
    db.execute(text("insert into profiles (id, email, full_name) values (:id, :e, :n) "
                    "on conflict (id) do update set updated_at = now()"), {"id": user.id, "e": user.email, "n": user.name or user.email})
    existing = db.execute(text("select id from memberships where organization_id = :o and user_id = :u"),
                          {"o": inv.organization_id, "u": user.id}).first()
    _check(existing is None, 409, "duplicate", "You are already a member of this organization.")
    db.execute(text("insert into memberships (organization_id, user_id, role_id, invited_by) values "
                    "(:o, :u, :r, (select invited_by from invitations where id = :i))"),
               {"o": inv.organization_id, "u": user.id, "r": inv.role_id, "i": inv.id})
    db.execute(text("update invitations set status = 'accepted', accepted_by = :u, accepted_at = now() where id = :i"),
               {"u": user.id, "i": inv.id})
    audit.record(db, inv.organization_id, "invitation.accepted", actor_id=user.id, record_type="invitation",
                 record_id=inv.id, info=info)
    return {"organization_id": inv.organization_id}


# ----------------------------------------------------------------------------------------- role permissions
def ar_permissions(db: Session) -> list[dict[str, Any]]:
    granted = {r[0] for r in db.execute(text(
        "select permission_key from role_permissions rp join roles r on r.id = rp.role_id where r.key = 'ar_specialist'"))}
    return [{"key": k, "granted": k in granted, "locked": k in NON_GRANTABLE or k in AR_ALWAYS_ON,
             "reason": "owner only" if k in NON_GRANTABLE else "always on" if k in AR_ALWAYS_ON else None}
            for k in sorted(ALL_KEYS)]


def set_ar_permissions(db: Session, org: uuid.UUID, actor: AuthUser, keys: set[str], info: RequestInfo) -> None:
    _check(keys <= ALL_KEYS, 422, "validation_error", "Unknown permission.")
    _check(not (keys & NON_GRANTABLE), 422, "business_rule_violation", "Owner-only permissions cannot be granted to AR specialists.")
    _check(AR_ALWAYS_ON <= keys, 422, "business_rule_violation", "Some permissions cannot be switched off.")
    role = db.execute(text("select id from roles where organization_id = :o and key = 'ar_specialist'"), {"o": org}).scalar_one()
    before = sorted(r[0] for r in db.execute(text("select permission_key from role_permissions where role_id = :r"), {"r": role}))
    db.execute(text("delete from role_permissions where role_id = :r"), {"r": role})
    for k in sorted(keys):
        db.execute(text("insert into role_permissions (role_id, organization_id, permission_key) values (:r, :o, :k)"),
                   {"r": role, "o": org, "k": k})
    audit.record(db, org, "role.permissions_changed", actor_id=actor.id, record_type="role", record_id=role,
                 before={"permissions": before}, after={"permissions": sorted(keys)}, info=info)
