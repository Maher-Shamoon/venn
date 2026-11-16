"""Verifies Supabase access tokens. Nothing sensitive is trusted from the token except who the user is."""

import uuid
from dataclasses import dataclass
from functools import lru_cache

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


def decode_token(token: str, s: Settings) -> AuthUser:
    try:
        if s.jwks_url:
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
        email_verified=bool(meta.get("email_verified", False)),
        name=str(meta.get("full_name") or meta.get("name") or claims.get("email", "")).strip(),
    )
