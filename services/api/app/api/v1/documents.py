import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile

from app.core.tenancy import Ctx, require
from app.schemas.ledger import Page
from app.services import documents as svc
from app.services import investigations

router = APIRouter(tags=["documents"])


@router.post("/documents", status_code=201)
def upload(response: Response, file: Annotated[UploadFile, File()], investigation_id: uuid.UUID | None = None, ctx: Ctx = Depends(require("documents.upload"))) -> dict[str, Any]:
    data = file.file.read(svc.MAX_BYTES + 1)  # sync endpoint: database work must not block the event loop
    doc, created = svc.upload(ctx.db, ctx.org_id, ctx.user, file.filename or "upload", data, ctx.info)
    if not created:
        response.status_code = 200  # the same file was already here
    if investigation_id:
        doc["linked"] = investigations.link_document(ctx.db, ctx.org_id, ctx.user, investigation_id, uuid.UUID(doc["id"]), doc["filename"], ctx.info)
    return doc


@router.get("/documents")
def list_documents(q: str | None = None, page: Annotated[int, Query(ge=1)] = 1, limit: Annotated[int, Query(ge=1, le=100)] = 25, ctx: Ctx = Depends(require("documents.view"))) -> Page[dict[str, Any]]:
    rows, total = svc.list_documents(ctx.db, q, page, limit)
    return Page(data=rows, total=total, page=page, limit=limit)


@router.get("/documents/{did}")
def get_document(did: uuid.UUID, ctx: Ctx = Depends(require("documents.view"))) -> dict[str, Any]:
    return svc.get(ctx.db, did)


@router.get("/documents/{did}/download")
def download(did: uuid.UUID, ctx: Ctx = Depends(require("documents.view"))) -> Response:
    name, kind, data = svc.content(ctx.db, did)
    safe = name.encode("ascii", "replace").decode().replace('"', "_")
    return Response(data, media_type=kind, headers={"Content-Disposition": f'attachment; filename="{safe}"', "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store"})


@router.delete("/documents/{did}", status_code=204)
def delete_document(did: uuid.UUID, ctx: Ctx = Depends(require("documents.upload"))) -> Response:
    svc.delete(ctx.db, ctx.org_id, ctx.user, did, ctx.info)
    return Response(status_code=204)
