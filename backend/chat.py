import json
from typing import Optional

from pydantic import BaseModel

import board
from ai import MODEL, get_client

HISTORY_LIMIT = 20


class CardUpdate(BaseModel):
    id: Optional[str] = None
    column_key: str
    title: str
    description: Optional[str] = None
    order: Optional[int] = None
    deleted: bool = False


class ColumnUpdate(BaseModel):
    key: str
    name: str


class BoardUpdate(BaseModel):
    cards: list[CardUpdate] = []
    columns: list[ColumnUpdate] = []


class ChatResponse(BaseModel):
    reply: str
    board_update: Optional[BoardUpdate] = None


SYSTEM_PROMPT_TEMPLATE = """You are an assistant embedded in a Kanban board app. \
You can answer questions about the board and, when asked, create, edit, move, or delete cards.

The board has 5 fixed columns, referenced by these keys (never invent other keys): \
backlog, todo, in_progress, review, done. Columns cannot be added or removed - only renamed.

Current board state (JSON):
{board_json}

When you make changes, describe them in `board_update`:
- To edit or move an existing card, set `id` to its exact id from the board state above.
- To create a new card, leave `id` null.
- To delete a card, set `deleted` to true (`id` required).
- `column_key` is the target column for the card - always one of the fixed keys above.
- `title` is always required, even for a pure move - echo the card's existing title unchanged.
- `description` is optional; leave it null to keep the existing description unchanged.
- `order` is the 0-indexed position within the target column; leave it null to append at the end.
- Only include a `columns` entry for a column whose display name you are actually renaming, \
referencing it by its fixed `key`.
- If you are not changing the board, leave `board_update` null.

Always reply conversationally via `reply`, describing what you did or answering the question."""


def _build_system_prompt(username: str, board_id: int) -> str:
    current_board = board.get_board(username, board_id)
    return SYSTEM_PROMPT_TEMPLATE.format(board_json=json.dumps(current_board))


def _apply_card_update(username: str, board_id: int, card: CardUpdate) -> None:
    try:
        column_id = board.get_column_id_by_key(username, board_id, card.column_key)
    except LookupError:
        return

    if card.deleted:
        if card.id is None:
            return
        try:
            board.delete_card(username, int(card.id))
        except (LookupError, ValueError):
            pass
        return

    if card.id is None:
        board.create_card(username, column_id, card.title, card.description or "")
        return

    try:
        board.update_card(
            username,
            int(card.id),
            title=card.title,
            description=card.description,
            target_column_id=column_id,
            target_order=card.order,
        )
    except (LookupError, ValueError):
        pass


def _apply_column_update(username: str, board_id: int, column: ColumnUpdate) -> None:
    try:
        column_id = board.get_column_id_by_key(username, board_id, column.key)
        board.rename_column(username, column_id, column.name)
    except LookupError:
        pass


def _apply_board_update(username: str, board_id: int, update: BoardUpdate) -> None:
    for card in update.cards:
        _apply_card_update(username, board_id, card)
    for column in update.columns:
        _apply_column_update(username, board_id, column)


def chat(username: str, message: str, board_id: Optional[int] = None) -> dict:
    if board_id is None:
        board_id = board.get_personal_board_id(username)

    history = board.get_recent_messages(username, board_id, limit=HISTORY_LIMIT)
    messages = [{"role": m["role"], "content": m["content"]} for m in history]
    messages.append({"role": "user", "content": message})

    client = get_client()
    response = client.messages.parse(
        model=MODEL,
        max_tokens=1024,
        system=_build_system_prompt(username, board_id),
        messages=messages,
        output_format=ChatResponse,
    )

    parsed = response.parsed_output
    if parsed is None:
        parsed = ChatResponse(reply="Sorry, I couldn't process that. Could you rephrase?")
    elif parsed.board_update is not None:
        _apply_board_update(username, board_id, parsed.board_update)

    board.add_message(username, board_id, "user", message)
    board.add_message(username, board_id, "assistant", parsed.reply)

    return {"reply": parsed.reply, "board": board.get_board(username, board_id)}
