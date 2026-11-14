import logging
import time
import uuid
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import health
from app.core.config import get_settings
from app.core.errors import install_error_handlers
from app.core.logging import setup_logging

log = logging.getLogger("venn.request")


def create_app() -> FastAPI:
    s = get_settings()
    setup_logging(s.log_level)
    app = FastAPI(title="venn API", version="0.1.0",
                  docs_url="/docs" if s.env != "production" else None)
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

    install_error_handlers(app)
    app.include_router(health.router, prefix="/api/v1")
    return app


app = create_app()
