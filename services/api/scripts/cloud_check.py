"""Read-only look at the configured database: migration state, tables, auth link, tenancy role."""

import sys

from sqlalchemy import create_engine, text

from app.core.config import get_settings

with create_engine(get_settings().database_url).connect() as c:
    print("revision:", c.execute(text("select version_num from alembic_version")).scalar())
    print("tables:", sorted(r[0] for r in c.execute(text(
        "select tablename from pg_tables where schemaname = 'public' order by 1"))))
    print("auth fk on profiles:", c.execute(text(
        "select count(*) from pg_constraint where conname = 'profiles_auth_fk'")).scalar())
    print("venn_app role:", c.execute(text("select count(*) from pg_roles where rolname = 'venn_app'")).scalar())
    print("rls forced:", sorted(r[0] for r in c.execute(text(
        "select relname from pg_class where relforcerowsecurity and relnamespace = 'public'::regnamespace"))))
    if len(sys.argv) > 1:
        print("auth users:", c.execute(text("select count(*) from auth.users")).scalar())
