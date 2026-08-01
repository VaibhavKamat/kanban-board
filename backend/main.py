from pathlib import Path

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response, status
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from auth import (
    SESSION_COOKIE_NAME,
    create_session,
    destroy_session,
    get_current_username,
    verify_credentials,
)

app = FastAPI()

STATIC_DIR = Path(__file__).parent / "static"


class LoginRequest(BaseModel):
    username: str
    password: str


@app.get("/api/hello")
def hello():
    return {"message": "Hello from FastAPI"}


@app.post("/api/login")
def login(credentials: LoginRequest, response: Response):
    if not verify_credentials(credentials.username, credentials.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    session_id = create_session(credentials.username)
    response.set_cookie(key=SESSION_COOKIE_NAME, value=session_id, httponly=True, samesite="lax")
    return {"username": credentials.username}


@app.post("/api/logout")
def logout(
    response: Response,
    session_id: str | None = Cookie(default=None, alias=SESSION_COOKIE_NAME),
):
    destroy_session(session_id)
    response.delete_cookie(SESSION_COOKIE_NAME)
    return {"ok": True}


@app.get("/api/me")
def me(username: str | None = Depends(get_current_username)):
    return {"authenticated": username is not None, "username": username}


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
