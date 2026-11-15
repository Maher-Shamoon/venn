# Supabase setup (development)

One free Supabase project gives venn real sign-up, email verification, sign-in and password reset, and the Postgres database the API uses.

## 1. Create the project
1. https://supabase.com/dashboard → New project. Pick a region near you and set a **database password** (keep it; you need it in step 4).
2. Wait until the project is ready.

## 2. Authentication settings
Authentication → Sign In / Providers → **Email**:
- Confirm email: **on**
- Minimum password length: **12**; password requirements: lowercase, uppercase, digits and symbols

Authentication → URL Configuration:
- Site URL: `http://localhost:5174`
- Redirect URLs: `http://localhost:5174/**`, `http://localhost:5180/**`, `http://localhost:4173/**`

(Supabase's built-in email sender is limited to a few emails an hour. That is enough for testing; production uses your own SMTP.)

## 3. Web app keys (these are public, safe to share)
Project Settings → API:
- Project URL, e.g. `https://abcd1234.supabase.co`
- `anon` `public` key

Create `apps/web/.env.local`:
```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-KEY
```
Never use the `service_role` key in the web app, and never paste it in chat.

## 4. API settings (secrets: keep in `services/api/.env`, never commit)
Project Settings → Database → Connection string → **Session pooler** (URI). Replace `postgresql://` with `postgresql+psycopg://` and insert your password:
```
VENN_DATABASE_URL=postgresql+psycopg://postgres.YOUR-REF:YOUR-DB-PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
VENN_JWKS_URL=https://YOUR-PROJECT.supabase.co/auth/v1/.well-known/jwks.json
VENN_JWT_ISSUER=https://YOUR-PROJECT.supabase.co/auth/v1
```
Then apply the migrations: `cd services/api && uv run alembic upgrade head`.

If your project still signs tokens with the legacy shared secret instead of JWKS, set `VENN_JWT_SECRET` (Project Settings → API → JWT Secret) and leave `VENN_JWKS_URL` empty.
