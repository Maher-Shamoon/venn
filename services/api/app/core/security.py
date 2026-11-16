"""Verifies Supabase access tokens. Nothing sensitive is trusted from the token except who the user is."""

import hashlib
import time
import uuid
from dataclasses import dataclass
from functools import lru_cache

import httpx
import jwt
from jwt import PyJWKClient

from app.core.config import Settings
from app.core.errors import ApiError


@dataclass(frozen=True)
class AuthUser:
    id: uuid.UUID
    email: str
    email_verified: bool
    name: str


@lru_cache
def _jwks(url: str) -> PyJWKClient:
    return PyJWKClient(url, cache_keys=True, lifespan=3600)  # keys cached for an hour


_confirmed: dict[str, float] = {}  # token hash -> when we may ask Supabase again


def _email_confirmed(token: str, s: Settings) -> bool:
    """Asks Supabase whether this account's email is confirmed. The token's own metadata is writable by the user, so it proves nothing."""
    k = hashlib.sha256(token.encode()).hexdigest()
    if _confirmed.get(k, 0) > time.monotonic():
        return True
    try:
        r = httpx.get(f"{s.jwt_issuer}/user", headers={"Authorization": f"Bearer {token}", "apikey": s.supabase_anon_key}, timeout=5)
    except httpx.HTTPError as e:
        raise ApiError(503, "unavailable", "Sign-in could not be checked. Try again in a moment.") from e
    ok = r.status_code == 200 and bool(r.json().get("email_confirmed_at"))
    if ok:
        if len(_confirmed) > 5000:
            _confirmed.clear()
        _confirmed[k] = time.monotonic() + 600
    return ok


def decode_token(token: str, s: Settings) -> AuthUser:
    try:
        if s.jwks_url:
            if not s.jwt_issuer:  # without an issuer, a token from any project signed by the same keys would pass
                raise ApiError(500, "internal_error", "Authentication is not configured.")
            key: object = _jwks(s.jwks_url).get_signing_key_from_jwt(token).key
            algorithms = ["RS256", "ES256"]
        elif s.jwt_secret:
            key, algorithms = s.jwt_secret, ["HS256"]
        else:
            raise ApiError(500, "internal_error", "Authentication is not configured.")
        claims = jwt.decode(
            token, key, algorithms=algorithms, audience=s.jwt_audience,  # type: ignore[arg-type]
            issuer=s.jwt_issuer or None, options={"require": ["exp", "sub"]},
            leeway=30,  # a token minted a moment "in the future" by a server with a faster clock is still valid
        )
    except jwt.ExpiredSignatureError as e:
        raise ApiError(401, "token_expired", "The session has expired.") from e
    except (jwt.InvalidTokenError, jwt.PyJWKClientError) as e:
        raise ApiError(401, "unauthenticated", "Sign in to continue.") from e
    try:
        uid = uuid.UUID(str(claims["sub"]))
    except ValueError as e:
        raise ApiError(401, "unauthenticated", "Sign in to continue.") from e
    meta = claims.get("user_metadata") or {}
    return AuthUser(
        id=uid, email=str(claims.get("email", "")).lower(),
        email_verified=_email_confirmed(token, s) if s.jwks_url and s.supabase_anon_key else bool(meta.get("email_verified", False)),
        name=str(meta.get("full_name") or meta.get("name") or claims.get("email", "")).strip(),
    )
