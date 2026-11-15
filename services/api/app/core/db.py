from collections.abc import Iterator

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


_engine: Engine | None = None
_factory: sessionmaker[Session] | None = None


def get_engine() -> Engine:
    global _engine, _factory
    if _engine is None:
        cfg = get_settings()
        # Serverless instances multiply: keep each instance's share of the database's connection limit small.
        pool = {"pool_size": 2, "max_overflow": 1, "pool_recycle": 240} if cfg.env == "production" else {}
        _engine = create_engine(cfg.database_url, pool_pre_ping=True, **pool)
        _factory = sessionmaker(_engine, expire_on_commit=False)
    return _engine


def get_session() -> Iterator[Session]:
    get_engine()
    assert _factory is not None
    with _factory() as session:
        yield session
