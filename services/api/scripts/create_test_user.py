"""Creates (or resets) a confirmed email/password user in the configured Supabase project, for automated tests.

Development projects only. Writes the credentials to apps/web/e2e/.test-user.local (git-ignored).
Usage: PYTHONPATH=. uv run python scripts/create_test_user.py [email]
"""

import json
import secrets
import sys
import uuid
from pathlib import Path

from sqlalchemy import create_engine, text

from app.core.config import get_settings

email = (sys.argv[1] if len(sys.argv) > 1 else "qa.tester@venn-dev.test").lower()
password = "Vq-" + secrets.token_urlsafe(14) + "9!"
settings = get_settings()
if settings.env == "production":
    sys.exit("refusing to run against production")

with create_engine(settings.database_url).begin() as c:
    uid = c.execute(text("select id from auth.users where email = :e"), {"e": email}).scalar()
    if uid is None:
        uid = uuid.uuid4()
        c.execute(text("""
            insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
              raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
              confirmation_token, recovery_token, email_change, email_change_token_new)
            values ('00000000-0000-0000-0000-000000000000', :id, 'authenticated', 'authenticated', :e,
              extensions.crypt(:p, extensions.gen_salt('bf')), now(),
              cast(:app as jsonb),
              cast(:meta as jsonb), now(), now(), '', '', '', '')
        """), {"id": uid, "e": email, "p": password, "app": json.dumps({"provider": "email", "providers": ["email"]}),
                                   "meta": json.dumps({"full_name": "QA Tester", "email_verified": True})})
        c.execute(text("""
            insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at, last_sign_in_at)
            values (:pid, :id, cast(:d as jsonb), 'email', now(), now(), now())
        """), {"pid": str(uid), "id": uid, "d": json.dumps({"sub": str(uid), "email": email, "email_verified": True})})
    else:
        c.execute(text("update auth.users set encrypted_password = extensions.crypt(:p, extensions.gen_salt('bf')), "
                       "email_confirmed_at = coalesce(email_confirmed_at, now()) where id = :id"), {"p": password, "id": uid})

out = Path(__file__).resolve().parents[3] / "apps" / "web" / "e2e" / ".test-user.local"
out.write_text(json.dumps({"email": email, "password": password}), encoding="utf-8")
print(f"test user ready: {email} (credentials saved to {out.name})")
