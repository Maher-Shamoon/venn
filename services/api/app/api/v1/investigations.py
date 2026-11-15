import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header

from app.core.errors import ApiError
from app.core.tenancy import Ctx, require
from app.services import investigations as svc

router = APIRouter(tags=["investigations"])


def _version(if_match: str | None) -> int | None:
    try:
        return int(if_match.strip('"')) if if_match else None
    except ValueError:
        return None


@router.get("/investigations")
def list_cases(filter: str = "all", q: str | None = None, ctx: Ctx = Depends(require("investigations.view"))) -> dict[str, Any]:
    return {"data": svc.list_cases(ctx.db, ctx.user.id, filter, q)}


@router.post("/investigations", status_code=201)
def open_case(body: svc.OpenIn, ctx: Ctx = Depends(require("investigations.manage"))) -> dict[str, Any]:
    return svc.open_manual(ctx.db, ctx.org_id, ctx.user, body, ctx.info)


@router.get("/investigations/{iid}")
def get_case(iid: uuid.UUID, ctx: Ctx = Depends(require("investigations.view"))) -> dict[str, Any]:
    return svc.get(ctx.db, iid)


@router.patch("/investigations/{iid}")
def patch_case(iid: uuid.UUID, body: svc.PatchIn, ctx: Ctx = Depends(require("investigations.manage")), if_match: str | None = Header(default=None)) -> dict[str, Any]:
    if (body.assignee_id or body.clear_assignee) and "investigations.assign" not in ctx.permissions:
        raise ApiError(403, "permission_denied", "You cannot assign investigations.")
    return svc.patch(ctx.db, ctx.org_id, ctx.user, iid, body, _version(if_match), ctx.info)


@router.post("/investigations/{iid}/notes", status_code=201)
def add_note(iid: uuid.UUID, body: svc.NoteIn, ctx: Ctx = Depends(require("investigations.manage"))) -> dict[str, Any]:
    return svc.add_note(ctx.db, ctx.org_id, ctx.user, iid, body.text, ctx.info)


@router.post("/investigations/{iid}/evidence", status_code=201)
def add_evidence(iid: uuid.UUID, body: svc.EvidenceIn, ctx: Ctx = Depends(require("investigations.manage"))) -> dict[str, Any]:
    return svc.add_evidence(ctx.db, ctx.org_id, ctx.user, iid, body, ctx.info)


@router.delete("/investigations/{iid}/evidence/{eid}")
def remove_evidence(iid: uuid.UUID, eid: uuid.UUID, ctx: Ctx = Depends(require("investigations.manage"))) -> dict[str, Any]:
    return svc.remove_evidence(ctx.db, ctx.org_id, ctx.user, iid, eid, ctx.info)


@router.post("/investigations/{iid}/analysis")
def rerun(iid: uuid.UUID, ctx: Ctx = Depends(require("investigations.manage"))) -> dict[str, Any]:
    svc.run_analysis(ctx.db, ctx.org_id, ctx.user, iid, ctx.info)
    return svc.get(ctx.db, iid)


@router.post("/investigations/{iid}/actions")
def act(iid: uuid.UUID, body: svc.ActionIn, ctx: Ctx = Depends(require("investigations.manage"))) -> dict[str, Any]:
    return svc.act(ctx.db, ctx.org_id, ctx.user, iid, body, "adjustments.request" in ctx.permissions, ctx.info)


@router.post("/investigations/{iid}/resolve")
def resolve(iid: uuid.UUID, body: svc.ResolveIn, ctx: Ctx = Depends(require("investigations.manage"))) -> dict[str, Any]:
    return svc.resolve(ctx.db, ctx.org_id, ctx.user, iid, body.outcome, ctx.info)


@router.post("/investigations/{iid}/dismiss")
def dismiss(iid: uuid.UUID, body: svc.DismissIn, ctx: Ctx = Depends(require("investigations.manage"))) -> dict[str, Any]:
    return svc.dismiss(ctx.db, ctx.org_id, ctx.user, iid, body.reason, ctx.info)
