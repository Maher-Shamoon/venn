"""Encryption for connection secrets (API keys, refresh tokens) kept in the database. The key lives only in the environment."""

import base64
import hashlib
import hmac
import time

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import get_settings
from app.core.errors import ApiError


def _fernet() -> Fernet:
    key = get_settings().secrets_key
    if not key:
        raise ApiError(503, "not_configured", "Connections are not configured on this server (no secrets key).")
    return Fernet(key.encode())


def seal(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def unseal(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken as e:
        raise ApiError(409, "reconnect", "The stored connection could not be read. Connect it again.") from e


def sign_state(payload: str, ttl: int = 600) -> str:
    """A tamper-proof, short-lived value for the OAuth round trip, so a callback can only finish a flow this server started."""
    key = get_settings().secrets_key
    if not key:  # an empty key would make every state forgeable
        raise ApiError(500, "internal_error", "Connections are not configured.")
    body = f"{payload}|{int(time.time()) + ttl}"
    mac = hmac.new(key.encode(), body.encode(), hashlib.sha256).hexdigest()
    return base64.urlsafe_b64encode(f"{body}|{mac}".encode()).decode()


def read_state(state: str) -> str:
    try:
        body, mac = base64.urlsafe_b64decode(state.encode()).decode().rsplit("|", 1)
        payload, exp = body.rsplit("|", 1)
    except ValueError as e:
        raise ApiError(400, "bad_request", "The sign-in link is not valid.") from e
    if not get_settings().secrets_key:
        raise ApiError(500, "internal_error", "Connections are not configured.")
    good = hmac.new(get_settings().secrets_key.encode(), body.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(mac, good) or int(exp) < time.time():
        raise ApiError(400, "bad_request", "The sign-in link expired or was changed. Start again.")
    return payload
