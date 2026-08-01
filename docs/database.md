# Database

SQLite, one file (`kanban.db`), created on backend startup if it doesn't exist. Schema is defined structurally in `docs/db_schema.json`; this document explains the reasoning behind it.

## Why `users` and `boards` exist for a single-user MVP

CLAUDE.md requires the database to "support multiple users for future" even though the MVP has exactly one hardcoded user and one board. Rather than hardcoding that assumption into the schema, `users` and `boards` are real tables with a foreign-key relationship - there's just one row in each for now. This means adding real multi-user support later is a matter of adding registration/auth logic, not a schema migration.

The `users` table intentionally has no password column. Login (Part 4) is a hardcoded in-memory string comparison, not a database lookup - a password column would be dead schema until real credential storage is actually needed.

## Why columns use `key` vs `name`

CLAUDE.md specifies "fixed columns that can be renamed" - not a free-form list a user can add to or remove from. The schema encodes this directly: `key` is a stable internal identifier (`backlog`, `todo`, `in_progress`, `review`, `done`) that application code always operates on and never exposes as editable, while `name` is the user-facing label the rename feature updates. This means the "fixed" constraint is structural (there is no create/delete-column endpoint at all in Part 6) rather than something enforced only by API validation that could be bypassed or forgotten.

The five seeded columns match the mock data already built into the frontend in Part 3 exactly, so Part 6's seeding and Part 7's wiring don't need to reconcile any naming differences.

## Why `order` is a plain integer

Both `columns.order` (fixed, set once at seed time) and `cards.order` (changes on every drag-and-drop move) use a simple 0-indexed integer rather than a fractional-indexing scheme. At this scale (a handful of columns, a modest number of cards), moving a card means resequencing the affected column(s) by list position - simple to implement and reason about, and avoids a class of floating-point-precision bugs that fractional indexing can introduce for no benefit here.

## Why `messages` exists already, unused

The AI chat feature (Part 9) needs to persist conversation history per board. That table is defined now, in this same sign-off pass, rather than proposed later - so the schema for AI chat doesn't require a second review round once Part 8/9 is reached, and so Part 9's design (which references `board_id`, `role`, `content`) can be written against a schema that's already agreed.

## What's deliberately not a table: login sessions

Part 4's login sessions live in an in-memory Python dictionary inside the FastAPI process, not in SQLite. This is a deliberate simplification, not an oversight: the app runs as a single process in a single container, so a session store that resets on restart is an accepted MVP limitation. This decision is carried forward as-is through the rest of the plan - it is not migrated into the database later.

## Table summary

| Table | Purpose | Written by |
|---|---|---|
| `users` | Registered users (one row: the hardcoded user) | Seeded at startup (Part 6) |
| `boards` | One board per user | Seeded at startup (Part 6) |
| `columns` | The 5 fixed columns of a board | Seeded at startup; `name` updated by the rename endpoint (Part 6) |
| `cards` | Kanban cards | Created/edited/moved/deleted via the board API (Part 6), and by AI-driven updates (Part 9) |
| `messages` | AI chat history | Written by the chat endpoint (Part 9) |

Full column-level detail (types, nullability, foreign keys, indexes, seed rows) is in `docs/db_schema.json`.
