import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

from app.core.errors import ApiError
from app.core.tenancy import Ctx, org_context
from app.services import imports
from app.services.importing import MAX_BYTES

router = APIRouter(tags=["imports"])
Context = Annotated[Ctx, Depends(org_context, scope="function")]


class MappingIn(BaseModel):
    mapping: dict[str, str] | None = None
    date_format: str | None = None


def _allow(ctx: Ctx, kind: str) -> None:
    if imports.PERMISSION.get(kind) not in ctx.permissions:
        raise ApiError(403, "permission_denied", "You do not have permission to do that.")


def _kind(ctx: Ctx, job_id: uuid.UUID) -> str:
    kind: str = imports.get(ctx.db, job_id)["kind"]
    _allow(ctx, kind)
    return kind


@router.post("/imports", status_code=201)
def create_import(ctx: Context, kind: Annotated[str, Form()], file: Annotated[UploadFile, File()], date_format: Annotated[str | None, Form()] = None) -> dict[str, Any]:
    _allow(ctx, kind)
    if date_format not in (None, "", "iso", "dmy", "mdy"):
        raise ApiError(422, "validation_error", "Unknown date format.")
    content = file.file.read(MAX_BYTES + 1)  # sync endpoint: the database work below must not block the event loop
    return imports.create(ctx.db, ctx.org_id, ctx.user, kind, file.filename or "upload.csv", content, date_format or None, ctx.info)


@router.get("/imports/{job_id}")
def get_import(job_id: uuid.UUID, ctx: Context) -> dict[str, Any]:
    _kind(ctx, job_id)
    return imports.get(ctx.db, job_id)


@router.get("/imports/{job_id}/rows")
def import_rows(job_id: uuid.UUID, ctx: Context, cls: str | None = None, page: Annotated[int, Query(ge=1)] = 1, limit: Annotated[int, Query(ge=1, le=100)] = 25) -> dict[str, Any]:
    _kind(ctx, job_id)
    return imports.list_rows(ctx.db, job_id, cls, page, limit)


@router.post("/imports/{job_id}/mapping")
def remap(job_id: uuid.UUID, body: MappingIn, ctx: Context) -> dict[str, Any]:
    _kind(ctx, job_id)
    if body.date_format not in (None, "iso", "dmy", "mdy"):
        raise ApiError(422, "validation_error", "Unknown date format.")
    return imports.revalidate(ctx.db, ctx.org_id, ctx.user, job_id, body.mapping, body.date_format, ctx.info)


@router.post("/imports/{job_id}/commit")
def commit_import(job_id: uuid.UUID, ctx: Context) -> dict[str, Any]:
    _kind(ctx, job_id)
    return imports.commit(ctx.db, ctx.org_id, ctx.user, job_id, ctx.info)


@router.post("/imports/{job_id}/discard", status_code=204)
def discard_import(job_id: uuid.UUID, ctx: Context) -> None:
    _kind(ctx, job_id)
    imports.discard(ctx.db, ctx.org_id, ctx.user, job_id, ctx.info)


@router.get("/imports/{job_id}/problems.csv", response_class=PlainTextResponse)
def problems_csv(job_id: uuid.UUID, ctx: Context) -> PlainTextResponse:
    _kind(ctx, job_id)
    return PlainTextResponse(imports.problems(ctx.db, job_id), media_type="text/csv", headers={"Content-Disposition": 'attachment; filename="problem-rows.csv"'})
