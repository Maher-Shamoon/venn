"""Append-only audit trail. `record` is called inside the service that makes the change, in the same transaction,
so a change and its audit entry commit or roll back together (NFR-G-04)."""

import hashlib
import json
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.requestinfo import RequestInfo

REDACTED = "[redacted]"
# Any key containing one of these is never stored: secrets and bank details.
SENSITIVE = ("password", "token", "secret", "account_number", "account", "iban", "routing", "api_key")


def redact(value: Any) -> Any:
    """Recursively masks sensitive keys so before/after snapshots can never leak a secret."""
    if isinstance(value, dict):
        return {k: REDACTED if any(s in k.lower() for s in SENSITIVE) else redact(v) for k, v in value.items()}
    if isinstance(value, list):
        return [redact(v) for v in value]
    return value


def _utc(t: datetime) -> str:
    return t.astimezone(UTC).isoformat()  # stored and hashed in UTC regardless of the session time zone


def _canonical(payload: dict[str, Any]) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str).encode()


def compute_hash(prev: bytes | None, payload: dict[str, Any]) -> bytes:
    return hashlib.sha256((prev or b"") + _canonical(payload)).digest()


def _payload(row: Any) -> dict[str, Any]:
    return {
        "seq": row.seq, "occurred_at": _utc(row.occurred_at),
        "actor_type": row.actor_type, "actor_id": str(row.actor_id) if row.actor_id else None,
        "action": row.action, "record_type": row.record_type, "record_id": row.record_id,
        "before": row.before, "after": row.after,
    }


def record(db: Session, org_id: uuid.UUID, action: str, *, actor_id: uuid.UUID | None = None,
           record_type: str | None = None, record_id: str | uuid.UUID | None = None,
           before: dict[str, Any] | None = None, after: dict[str, Any] | None = None,
           info: RequestInfo | None = None) -> None:
    info = info or RequestInfo()
    # One writer per organization at a time keeps the chain linear; released at commit.
    db.execute(text("select pg_advisory_xact_lock(hashtextextended(:o, 0))"), {"o": str(org_id)})
    last = db.execute(text("select seq, hash from audit_events where organization_id = :o order by seq desc limit 1"),
                      {"o": org_id}).first()
    seq = (last.seq if last else 0) + 1
    now = db.execute(text("select now()")).scalar_one()
    body = {
        "seq": seq, "occurred_at": _utc(now), "actor_type": "user" if actor_id else "system",
        "actor_id": str(actor_id) if actor_id else None, "action": action, "record_type": record_type,
        "record_id": str(record_id) if record_id is not None else None,
        "before": redact(before), "after": redact(after),
    }
    prev = bytes(last.hash) if last else None
    db.execute(
        text("insert into audit_events (organization_id, seq, occurred_at, actor_type, actor_id, action, record_type, "
             "record_id, before, after, request_id, ip, user_agent, prev_hash, hash) values "
             "(:o, :seq, :at, :at_type, :actor, :action, :rt, :rid, cast(:before as jsonb), cast(:after as jsonb), "
             ":req, :ip, :ua, :prev, :hash)"),
        {"o": org_id, "seq": seq, "at": now, "at_type": body["actor_type"], "actor": actor_id, "action": action,
         "rt": record_type, "rid": body["record_id"],
         "before": json.dumps(body["before"]) if before is not None else None,
         "after": json.dumps(body["after"]) if after is not None else None,
         "req": info.request_id, "ip": info.ip, "ua": info.user_agent, "prev": prev, "hash": compute_hash(prev, body)},
    )


def verify_chain(db: Session, org_id: uuid.UUID) -> int | None:
    """Returns the seq of the first entry whose hash or link is wrong, or None when the chain is intact."""
    prev: bytes | None = None
    expected_seq = 1
    for row in db.execute(text("select * from audit_events where organization_id = :o order by seq"), {"o": org_id}):
        stored_prev = bytes(row.prev_hash) if row.prev_hash else None
        if row.seq != expected_seq or stored_prev != prev or bytes(row.hash) != compute_hash(prev, _payload(row)):
            return int(row.seq)
        prev = bytes(row.hash)
        expected_seq += 1
    return None
