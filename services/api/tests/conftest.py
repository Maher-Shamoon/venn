"""Integration tests run against a real PostgreSQL with pgvector.

Locally this is an embedded server (pgserver); in CI the workflow supplies VENN_TEST_DATABASE_URL
pointing at a pgvector service container. Never SQLite: RLS and constraints must be the real ones.
"""

import os
import tempfile
from collections.abc import Iterator

import pytest

os.environ.setdefault("VENN_RATE_LIMIT_PER_MINUTE", "1000000")  # the suite makes thousands of requests; the limiter has its own tests
os.environ.setdefault("VENN_RATE_LIMIT_HEAVY_PER_MINUTE", "1000000")
os.environ.setdefault("VENN_RATE_LIMIT_ANONYMOUS_PER_MINUTE", "1000000")


@pytest.fixture(scope="session")
def database_url() -> Iterator[str]:
    url = os.environ.get("VENN_TEST_DATABASE_URL")
    if url:
        yield url
        return
    import pgserver

    srv = pgserver.get_server(tempfile.mkdtemp(prefix="venn-pg-"), cleanup_mode="stop")
    srv.psql("create database venn_test;")
    uri = srv.get_uri(database="venn_test")
    yield uri.replace("postgresql://", "postgresql+psycopg://", 1)
    srv.cleanup()


@pytest.fixture(scope="session")
def migrated(database_url: str) -> str:
    """Applies all migrations once and points the app at the test database."""
    from alembic import command
    from alembic.config import Config

    os.environ["VENN_DATABASE_URL"] = database_url
    from app.core.config import get_settings

    get_settings.cache_clear()
    command.upgrade(Config("alembic.ini"), "head")
    return database_url
