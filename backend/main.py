from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Cookie, Depends, FastAPI, HTTPException, Response, status
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

import board
from ai import send_message
from chat import chat as run_chat
from auth import (
    SESSION_COOKIE_NAME,
    create_session,
    destroy_session,
    get_current_username,
    require_auth,
    verify_credentials,
)
from db import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(lifespan=lifespan)

STATIC_DIR = Path(__file__).parent / "static"


class LoginRequest(BaseModel):
    username: str
    password: str


class ColumnRenameRequest(BaseModel):
    name: str


class CardCreateRequest(BaseModel):
    column_id: str
    title: str
    description: str = ""


class CardUpdateRequest(BaseModel):
    title: str | None = None
    description: str | None = None
    column_id: str | None = None
    order: int | None = None


class ChatRequest(BaseModel):
    message: str


def _parse_id(value: str) -> int:
    try:
        return int(value)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid id")


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


@app.get("/api/board")
def get_board_route(username: str = Depends(require_auth)):
    return board.get_board(username)


@app.patch("/api/columns/{column_id}")
def rename_column_route(
    column_id: int, body: ColumnRenameRequest, username: str = Depends(require_auth)
):
    try:
        return board.rename_column(username, column_id, body.name)
    except LookupError:
        raise HTTPException(status_code=404, detail="Column not found")


@app.post("/api/cards")
def create_card_route(body: CardCreateRequest, username: str = Depends(require_auth)):
    try:
        return board.create_card(
            username, _parse_id(body.column_id), body.title, body.description
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="Column not found")


@app.patch("/api/cards/{card_id}")
def update_card_route(
    card_id: int, body: CardUpdateRequest, username: str = Depends(require_auth)
):
    target_column_id = _parse_id(body.column_id) if body.column_id is not None else None
    try:
        return board.update_card(
            username,
            card_id,
            title=body.title,
            description=body.description,
            target_column_id=target_column_id,
            target_order=body.order,
        )
    except LookupError:
        raise HTTPException(status_code=404, detail="Card not found")


@app.delete("/api/cards/{card_id}")
def delete_card_route(card_id: int, username: str = Depends(require_auth)):
    try:
        return board.delete_card(username, card_id)
    except LookupError:
        raise HTTPException(status_code=404, detail="Card not found")


@app.get("/api/ai-test")
def ai_test_route(username: str = Depends(require_auth)):
    # Broad except is intentional: this is a system boundary (external API
    # call), and the Anthropic SDK raises a bare TypeError (not
    # anthropic.AnthropicError) for missing credentials.
    try:
        reply = send_message("What is 2+2? Reply with just the number.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI request failed: {e}")
    return {"reply": reply}


@app.get("/api/messages")
def get_messages_route(username: str = Depends(require_auth)):
    return {"messages": board.get_recent_messages(username)}


@app.post("/api/chat")
def chat_route(body: ChatRequest, username: str = Depends(require_auth)):
    # Broad except for the same reason as /api/ai-test: this is a system
    # boundary (external API call) that must never leak a raw stack trace.
    try:
        return run_chat(username, body.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat request failed: {e}")


app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")
