import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text


@pytest.mark.usefixtures("migrated")
def test_baseline_installs_extensions(migrated: str) -> None:
    with create_engine(migrated).connect() as c:
        names = {r[0] for r in c.execute(text("select extname from pg_extension"))}
    assert {"vector"} <= names


def test_readiness_reaches_the_database(migrated: str) -> None:
    from app.core import db
    from app.main import create_app

    db._engine = None  # new engine for the test database
    r = TestClient(create_app()).get("/api/v1/health/ready")
    assert r.status_code == 200 and r.json() == {"status": "ready"}
