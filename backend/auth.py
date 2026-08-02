import secrets

import bcrypt
from fastapi import Cookie, Depends, HTTPException, status

from db import get_user_by_username

SESSION_COOKIE_NAME = "session_id"

_sessions: dict[str, str] = {}


def verify_credentials(username: str, password: str) -> bool:
    user = get_user_by_username(username)
    if user is None or user["password_hash"] is None:
        return False
    return bcrypt.checkpw(password.encode(), user["password_hash"].encode())


def create_session(username: str) -> str:
    session_id = secrets.token_urlsafe(32)
    _sessions[session_id] = username
    return session_id


def destroy_session(session_id: str | None) -> None:
    if session_id:
        _sessions.pop(session_id, None)


def get_current_username(
    session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
) -> str | None:
    if session_id is None:
        return None
    return _sessions.get(session_id)


def require_auth(username: str | None = Depends(get_current_username)) -> str:
    if username is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return username
