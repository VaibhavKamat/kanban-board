# AI chat and board updates

`POST /api/chat` lets the user talk to Claude about their board, and lets Claude make changes to it. This documents the structured-output contract and how a response gets applied.

## Request / response

Request: `{"message": "<user's new message>"}`

Response: `{"reply": "<text shown to the user>", "board": <same shape as GET /api/board>}` - the endpoint always returns the fresh, full board state, whether or not anything changed. The frontend (Part 10) can unconditionally replace its board state with `board` after every chat turn, with no polling and no separate `GET /api/board` call.

## Model call

Uses Anthropic's Structured Outputs (`client.messages.parse()` with a Pydantic `output_format`), not a general tool the model chooses to invoke - every response is forced into the schema below. Model is `ai.MODEL` (`claude-opus-5`).

- **System prompt**: fixed instructions plus the current board state, freshly serialized as JSON on every request (so it's always up to date; caching the system prompt was not a goal here).
- **Messages**: the last 20 persisted turns (`board.get_recent_messages`) followed by the new user message. Board content lives in the system prompt, not history, so old turns never show a stale board.

## Structured output schema

```python
class CardUpdate(BaseModel):
    id: str | None = None        # existing card's id from the board state, or null to create one
    column_key: str              # target column: backlog | todo | in_progress | review | done
    title: str                   # always required, even for a pure move (echo the existing title)
    description: str | None = None  # null = leave unchanged; only meaningful for existing cards
    order: int | None = None     # 0-indexed position in the target column; null = append at end
    deleted: bool = False        # true = delete this card (id required)

class ColumnUpdate(BaseModel):
    key: str                     # one of the 5 fixed keys
    name: str                    # new display name

class BoardUpdate(BaseModel):
    cards: list[CardUpdate] = []
    columns: list[ColumnUpdate] = []

class ChatResponse(BaseModel):
    reply: str
    board_update: BoardUpdate | None = None
```

This is a **diff/patch shape** - `board_update` lists only the entities that changed, not a full board replace. That's simpler for the model to produce correctly and impossible to get wrong in a way that silently drops unrelated cards.

Identifiers deliberately mirror `docs/db_schema.json` / `GET /api/board`'s response shape:
- Cards are addressed by their string `id` (as returned by `GET /api/board`), matching Part 6/7's `Card.id`.
- Columns are addressed by the fixed `key` (e.g. `todo`), not the numeric `id` - the model is far more likely to get a stable semantic key right than an arbitrary database id, and `key` is exactly what CLAUDE.md's "fixed columns" concept already models.

## Applying the update

`chat._apply_board_update()` translates each `CardUpdate`/`ColumnUpdate` into a call to Part 6's existing mutation functions (`board.create_card`, `board.update_card`, `board.delete_card`, `board.rename_column`) - there is no separate "apply an AI update" code path, so AI-driven and human-driven changes always go through identical validation and resequencing logic.

Per-entity failures (an id the model hallucinated, an already-deleted card) are caught and skipped rather than failing the whole request - a partially-wrong `board_update` still returns whatever the model got right, plus its `reply` text. If the model's output doesn't parse into the schema at all (`response.parsed_output is None` - e.g. a safety refusal), the endpoint falls back to a plain apology reply with no board change, rather than erroring.

## Persistence

Both turns are written to the `messages` table via `board.add_message` only after a successful model round-trip - if the Anthropic call itself fails, nothing is persisted (no orphaned "no answer" turns).
