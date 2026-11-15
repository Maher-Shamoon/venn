import os

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url


def test_every_migration_can_be_applied_undone_and_applied_again(database_url: str, migrated: str) -> None:
    """Rollback must work before it is needed: up to head, down to nothing, up again, and the same tables come back."""
    from app.core.config import get_settings

    url = make_url(database_url)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        c.execute(text("drop database if exists venn_roundtrip"))
        c.execute(text("create database venn_roundtrip"))
    target = url.set(database="venn_roundtrip").render_as_string(hide_password=False)
    previous = os.environ["VENN_DATABASE_URL"]
    os.environ["VENN_DATABASE_URL"] = target
    get_settings.cache_clear()
    cfg = Config("alembic.ini")

    def tables() -> set[str]:
        with create_engine(target).connect() as c:
            return {r[0] for r in c.execute(text("select table_name from information_schema.tables where table_schema = 'public' and table_name <> 'alembic_version'"))}

    try:
        command.upgrade(cfg, "head")
        first = tables()
        assert {"invoices", "payments", "investigations", "documents", "collection_cases", "notifications"} <= first
        command.downgrade(cfg, "base")
        assert tables() == set()
        command.upgrade(cfg, "head")
        assert tables() == first
    finally:
        os.environ["VENN_DATABASE_URL"] = previous
        get_settings.cache_clear()
        with admin.connect() as c:
            c.execute(text("drop database if exists venn_roundtrip with (force)"))
