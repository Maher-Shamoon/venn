"""RFC 9457 problem details with stable `code` values (API_SPECIFICATION 1.4)."""

from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

PROBLEM = "application/problem+json"
_CODES = {
    400: "bad_request", 401: "unauthenticated", 403: "permission_denied", 404: "not_found",
    405: "method_not_allowed", 409: "conflict", 422: "validation_error", 429: "rate_limited",
}


class ApiError(Exception):
    """Raise from services and routers; the handler turns it into problem+json."""

    def __init__(self, status: int, code: str, detail: str, errors: list[dict[str, str]] | None = None):
        super().__init__(detail)
        self.status, self.code, self.detail, self.errors = status, code, detail, errors or []


def problem(request: Request, status: int, code: str, title: str, detail: str,
            errors: list[dict[str, str]] | None = None) -> JSONResponse:
    body: dict[str, Any] = {
        "type": f"https://docs.venn.example/errors/{code}", "title": title, "status": status,
        "code": code, "detail": detail, "request_id": getattr(request.state, "request_id", None),
    }
    if errors:
        body["errors"] = errors
    return JSONResponse(body, status_code=status, media_type=PROBLEM)


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api(request: Request, exc: ApiError) -> JSONResponse:
        return problem(request, exc.status, exc.code, exc.code.replace("_", " ").capitalize(),
                       exc.detail, exc.errors)

    @app.exception_handler(StarletteHTTPException)
    async def _http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        fallback = "internal_error" if exc.status_code >= 500 else "bad_request"
        return problem(request, exc.status_code, _CODES.get(exc.status_code, fallback),
                       str(exc.detail), str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def _validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = [{"field": ".".join(str(p) for p in e["loc"][1:]), "code": e["type"], "message": e["msg"]}
                  for e in exc.errors()]
        return problem(request, 422, "validation_error", "Validation failed",
                       "Request validation failed", errors)

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        # Never leak internals; the request id lets support find the log line.
        return problem(request, 500, "internal_error", "Internal error", "Something went wrong.")
