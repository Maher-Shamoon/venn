"""A transaction that fails at commit must produce an error response, never a success whose data was rolled back."""

import uuid

import pytest
from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.tenancy import user_session
from tests.test_identity_api import Token, auth, client, new_org  # noqa: F401


def test_a_deferred_constraint_failure_is_reported_not_swallowed(client: TestClient, auth: Token) -> None:  # noqa: F811
    owner, org = new_org(client, auth)
    r = APIRouter()

    @r.post("/_test/demote")
    def demote(db: Session = Depends(user_session, scope="function")) -> dict[str, str]:  # noqa: B008
        # Leaves the organization without an owner: the deferred trigger only fires at commit.
        db.execute(text("select set_config('app.org_id', :o, true)"), {"o": str(org)})
        db.execute(text("update memberships set status = 'suspended' where user_id = :u"), {"u": owner})
        return {"ok": "yes"}

    client.app.include_router(r, prefix="/api/v1")  # type: ignore[attr-defined]
    resp = client.post("/api/v1/_test/demote", headers=auth(owner))
    assert resp.status_code == 500 and resp.json()["code"] == "internal_error"
    # And nothing was changed.
    assert client.get("/api/v1/me/context", headers=auth(owner, org=org)).status_code == 200
    assert uuid.UUID(str(org))
    pytest.importorskip("fastapi")
