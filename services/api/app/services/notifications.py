"""In-app notifications and tasks (MOD-21). Other modules call notify(); a dedupe key makes the same event produce one notification per person."""

import uuid
from datetime import date
from typing import Annotated, Any

from pydantic import BaseModel, Field, StringConstraints
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.errors import ApiError


class TaskIn(BaseModel):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
    due_date: date | None = None
    link: str | None = Field(default=None, max_length=300)


def users_with(db: Session, org: uuid.UUID, permission: str) -> list[uuid.UUID]:
    rows = db.execute(text("select distinct m.user_id from memberships m join role_permissions rp on rp.role_id = m.role_id where m.organization_id = :o and m.status = 'active' and rp.permission_key = :p"),
                      {"o": org, "p": permission}).all()
    return [r.user_id for r in rows]


def notify(db: Session, org: uuid.UUID, users: list[uuid.UUID], kind: str, title: str, body: str | None, link: str | None, dedupe: str | None = None, skip: uuid.UUID | None = None) -> int:
    n = 0
    for u in dict.fromkeys(users):
        if u == skip:
            continue  # nobody needs to be told about what they just did
        made = db.execute(text("insert into notifications (organization_id, user_id, kind, title, body, link, dedupe_key) values (:o, :u, :k, :t, :b, :l, :d) on conflict do nothing returning id"),
                          {"o": org, "u": u, "k": kind, "t": title, "b": body, "l": link, "d": dedupe}).first()
        n += 1 if made else 0
    return n


def _n(r: Any) -> dict[str, Any]:
    return {"id": str(r.id), "kind": r.kind, "title": r.title, "body": r.body, "link": r.link, "read": r.read_at is not None, "created_at": r.created_at}


def list_notifications(db: Session, user: uuid.UUID, unread: bool, page: int, limit: int) -> tuple[list[dict[str, Any]], int, int]:
    where = "user_id = :u and (not :unread or read_at is null)"
    total = db.execute(text(f"select count(*) from notifications where {where}"), {"u": user, "unread": unread}).scalar_one()  # noqa: S608
    rows = db.execute(text(f"select id, kind, title, body, link, read_at, created_at from notifications where {where} order by created_at desc, id limit :n offset :o"),  # noqa: S608
                      {"u": user, "unread": unread, "n": limit, "o": (page - 1) * limit}).all()
    unread_n = db.execute(text("select count(*) from notifications where user_id = :u and read_at is null"), {"u": user}).scalar_one()
    return [_n(r) for r in rows], int(total), int(unread_n)


def mark_read(db: Session, user: uuid.UUID, ids: list[uuid.UUID] | None) -> int:
    rows = db.execute(text("update notifications set read_at = now() where user_id = :u and read_at is null and (cast(:ids as uuid[]) is null or id = any(cast(:ids as uuid[]))) returning id"), {"u": user, "ids": ids}).all()
    return len(rows)


# ---------------------------------------------------------------------------------------------------------- tasks
def _t(r: Any) -> dict[str, Any]:
    return {"id": str(r.id), "title": r.title, "due_date": r.due_date, "link": r.link, "system": r.system, "done": r.done_at is not None, "assignee": r.assignee, "created_at": r.created_at}


TASK_SQL = "select t.id, t.title, t.due_date, t.link, t.system, t.done_at, t.created_at, p.full_name as assignee from tasks t left join profiles p on p.id = t.assignee_id"


def list_tasks(db: Session, user: uuid.UUID, everyone: bool) -> list[dict[str, Any]]:
    rows = db.execute(text(f"{TASK_SQL} where (:all or t.assignee_id = :u or t.assignee_id is null) order by (t.done_at is not null), t.due_date nulls last, t.created_at desc limit 200"), {"u": user, "all": everyone}).all()  # noqa: S608
    return [_t(r) for r in rows]


def create_task(db: Session, org: uuid.UUID, user: uuid.UUID, body: TaskIn, system: bool = False, assignee: uuid.UUID | None = None) -> dict[str, Any]:
    tid = db.execute(text("insert into tasks (organization_id, title, due_date, assignee_id, link, system, created_by) values (:o, :t, :d, :a, :l, :s, :u) returning id"),
                     {"o": org, "t": body.title.strip(), "d": body.due_date, "a": assignee or user, "l": body.link, "s": system, "u": user}).scalar_one()
    return _t(db.execute(text(f"{TASK_SQL} where t.id = :i"), {"i": tid}).one())  # noqa: S608


def toggle_task(db: Session, user: uuid.UUID, tid: uuid.UUID, everyone: bool) -> dict[str, Any]:
    r = db.execute(text("update tasks set done_at = case when done_at is null then now() else null end where id = :i and (:all or assignee_id = :u or assignee_id is null) returning id"),
                   {"i": tid, "u": user, "all": everyone}).first()
    if r is None:
        raise ApiError(404, "not_found", "Task not found.")
    return _t(db.execute(text(f"{TASK_SQL} where t.id = :i"), {"i": tid}).one())  # noqa: S608
