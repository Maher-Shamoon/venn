import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import (
    approvals,
    audit,
    dashboard,
    documents,
    health,
    identity,
    imports,
    integrations,
    internal,
    investigations,
    ledger,
    reconciliation,
    settings,
    team,
    workflow,
)
from app.core.config import get_settings
from app.core.errors import install_error_handlers, problem
from app.core.logging import setup_logging
from app.core.mailer import MailError
from app.core.ratelimit import RateLimiter

log = logging.getLogger("venn.request")


def create_app() -> FastAPI:
    s = get_settings()
    setup_logging(s.log_level)
    app = FastAPI(title="venn API", version="0.1.0",
                  docs_url="/docs" if s.env != "production" else None,
                  openapi_url="/openapi.json" if s.env != "production" else None)
    app.add_middleware(CORSMiddleware, allow_origins=s.cors_origins, allow_credentials=True,
                       allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Request-Id"])

    @app.middleware("http")
    async def request_id(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        rid = request.headers.get("X-Request-Id") or f"req_{uuid.uuid4().hex[:16]}"
        request.state.request_id = rid
        t = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Request-Id"] = rid
        log.info("request", extra={"request_id": rid, "method": request.method,
                                   "path": request.url.path, "status": response.status_code,
                                   "ms": round((time.perf_counter() - t) * 1000)})
        return response

    app.state.limiter = RateLimiter(s.rate_limit_per_minute, s.rate_limit_heavy_per_minute, s.rate_limit_anonymous_per_minute, s.rate_limit_address_per_minute)

    @app.middleware("http")
    async def limit(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        if request.method != "OPTIONS" and request.url.path.startswith("/api/") and not request.url.path.endswith(("/health", "/ready")):
            auth = request.headers.get("Authorization")
            wait = request.app.state.limiter.check(request.method, request.url.path, auth, request.headers.get("x-vercel-forwarded-for") or (request.client.host if request.client else "unknown"))
            if wait is not None:
                request.state.request_id = request.headers.get("X-Request-Id") or f"req_{uuid.uuid4().hex[:16]}"
                res = problem(request, 429, "rate_limited", "Too many requests", f"Too many requests. Try again in {wait} seconds.")
                res.headers["Retry-After"] = str(wait)
                res.headers["X-Request-Id"] = request.state.request_id
                return res
        return await call_next(request)

    install_error_handlers(app)

    @app.exception_handler(MailError)
    async def mail_failed(request: Request, exc: MailError) -> Response:
        return problem(request, 502, "email_failed", "Email failed", "The email could not be sent, so nothing was recorded. Try again in a moment.")

    app.include_router(health.router, prefix="/api/v1")
    app.include_router(identity.router, prefix="/api/v1")
    app.include_router(audit.router, prefix="/api/v1")
    app.include_router(team.router, prefix="/api/v1")
    app.include_router(settings.router, prefix="/api/v1")
    app.include_router(ledger.router, prefix="/api/v1")
    app.include_router(reconciliation.router, prefix="/api/v1")
    app.include_router(approvals.router, prefix="/api/v1")
    app.include_router(investigations.router, prefix="/api/v1")
    app.include_router(documents.router, prefix="/api/v1")
    app.include_router(dashboard.router, prefix="/api/v1")
    app.include_router(workflow.router, prefix="/api/v1")
    app.include_router(internal.router, prefix="/api/v1")
    app.include_router(integrations.router, prefix="/api/v1")
    app.include_router(imports.router, prefix="/api/v1")
    return app


app = create_app()
