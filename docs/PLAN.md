# Project Management Kanban MVP - Implementation Plan

This document breaks the project into 10 parts. Each part lists design decisions, a substep checklist, and test/success criteria. Parts are meant to be executed in order - later parts assume earlier parts are complete and signed off.

Fixed Kanban columns (confirmed): **Backlog / To Do / In Progress / Review / Done**. Columns are a fixed, ordered set - they can be renamed but never added or removed.

## Cross-cutting notes (apply throughout)

- Part 2's Dockerfile is single-stage and provisional; it is reworked to multi-stage in Part 3 once a frontend build exists.
- Part 4's session store is in-memory by design and is carried forward as-is - it is not migrated into SQLite later. This is a deliberate MVP simplification, not an oversight.
- Part 5's DB schema is designed up front to anticipate Part 9's AI update shape (same card/column identifiers, plus a `messages` table added before it's used).
- Part 6's `GET /api/board` response shape is finalized in Part 6 and reused verbatim by Part 7 and Part 9 - it should not need to change later.
- Part 9 reuses Part 6's card/column mutation functions to apply AI-driven changes rather than duplicating board-mutation logic.
- Part 10 relies on Part 9 returning the full fresh board state in every chat response, so no polling or websockets are needed.

---

## Part 1: Plan

**Goal:** Turn the original 10-line plan into an actionable, detailed plan and get user sign-off before any code is written.

### Checklist

- [x] Review CLAUDE.md and the original docs/PLAN.md
- [x] Investigate actual repo state (confirmed: no frontend/, backend/, scripts/, Docker, or .gitignore exist yet; CLAUDE.md incorrectly claimed a frontend MVP already existed)
- [x] Resolve the frontend-existence discrepancy with the user (frontend will be built from scratch in Part 3; frontend/AGENTS.md moves from Part 1 to the end of Part 3)
- [x] Fix CLAUDE.md's "Starting Point" section to reflect reality
- [x] Reformat .env to standard `KEY=value` dotenv syntax
- [x] Add a root .gitignore covering .env, node_modules, Next.js build output, Python artifacts, and SQLite files
- [x] Confirm the fixed column set with the user (Backlog / To Do / In Progress / Review / Done)
- [x] Write this enriched plan with checklists and test/success criteria for Parts 2-10
- [ ] Get explicit user sign-off on this plan before starting Part 2

### Tests / success criteria

- User has explicitly approved this plan document.
- `git status` shows only CLAUDE.md, .env, .gitignore, and docs/PLAN.md changed - no other files touched.
- `.env` contains a standard `ANTHROPIC_API_KEY=...` line; `git check-ignore -v .env` confirms it is now ignored.

---

## Part 2: Scaffolding

**Goal:** Docker + FastAPI backend skeleton, serving a static "hello world" page and one API endpoint, runnable end-to-end in a container via start/stop scripts.

### Design decisions

- Backend structure: `backend/main.py` as the FastAPI entrypoint, `backend/requirements.txt` (fastapi, uvicorn). A single `main.py` is fine until Part 6 needs multiple route modules - don't pre-build a package structure.
- Static serving: mount `backend/static/` at `/` via `StaticFiles(html=True)`, registered *after* all `/api/*` routes so API routes aren't shadowed by the catch-all mount. This same mount point is reused (pointed at a different directory) in Part 3 - don't redesign the serving mechanism later.
- All backend routes live under `/api/*` - a convention fixed now so the root static mount never collides with API routes.
- Docker: single-stage `python:3.12-slim` image for now. This is provisional - Part 3 reworks it into a multi-stage build once there's a frontend to build.
- No docker-compose - CLAUDE.md specifies a single container, so shell scripts wrapping plain `docker build` / `docker run` are sufficient.
- Config: a fixed default port (8000) via an environment variable with a plain default; no config management library needed.
- `.env` is loaded into the container via `--env-file .env` at `docker run` time, never baked into the image.

### Checklist

- [x] Create `backend/main.py` and `backend/requirements.txt` (fastapi, uvicorn)
- [x] Add `GET /api/hello` returning a small JSON payload
- [x] Create `backend/static/index.html` that fetches `/api/hello` and displays the result
- [x] Mount `backend/static/` at `/` with `StaticFiles(html=True)`, registered after the `/api` routes
- [x] Write a root `Dockerfile`: `python:3.12-slim` base, copy `backend/`, install requirements, `CMD` runs uvicorn
- [x] Write `scripts/start.sh` and `scripts/stop.sh` (Mac/Linux): build image, run container with a fixed name, port mapping, and `--env-file .env`
- [x] Write `scripts/start.ps1` and `scripts/stop.ps1` (Windows) with equivalent behavior
- [x] Add a minimal `backend/tests/` with one pytest smoke test using FastAPI's `TestClient` against `/api/hello`
- [x] Manually verify: run the start script, load `http://localhost:8000/`, confirm the page shows data from `/api/hello`
- [x] Run the stop script and confirm the container stops and is removed

### Tests / success criteria

- [x] `curl http://localhost:8000/` returns 200 HTML
- [x] `curl http://localhost:8000/api/hello` returns 200 JSON with the expected payload
- [x] `docker ps` shows the container after start, and shows nothing after stop
- [x] `pytest` passes for the smoke test
- [x] A fresh checkout with Docker installed can run the start script with no manual setup steps

---

## Part 3: Build and serve the frontend

**Goal:** Since no frontend exists yet, design and build the Next.js Kanban demo UI from scratch using mock data (no backend calls), then statically build and serve it from FastAPI at `/`, replacing Part 2's placeholder page.

### Design decisions

- Next.js static export (`output: 'export'`) - FastAPI only serves static files, so no Next.js server/SSR/API routes are needed.
- Serving mechanism: reuse Part 2's `StaticFiles(html=True)` mount, now pointed at the Next.js export output. The Docker build copies `frontend/out/*` into the static directory at image build time, so the runtime mount path never changes.
- Single-page app: the whole app (login + board) lives on one page with client-side state, avoiding static-export routing/refresh issues entirely. This also shapes Part 4's login as a state toggle rather than a route.
- Data model (mirrors the Part 5 DB schema to avoid rework): `Column = { id, key, name, order }` (key is fixed/internal, name is the editable display label), `Card = { id, columnId, title, description, order }`.
- Fixed columns: Backlog / To Do / In Progress / Review / Done, seeded as mock data.
- Drag-and-drop: `@dnd-kit/core` + `@dnd-kit/sortable` (actively maintained, unlike `react-beautiful-dnd`).
- Styling: Tailwind CSS, with the CLAUDE.md color palette mapped into the Tailwind theme config. No heavy component library.
- State management: local React state (`useState`/`useReducer`) with a local mock-data module - no external state library needed at this scale.
- Card edit modal: a simple controlled component, no modal library required.

### Checklist

- [x] Scaffold `frontend/` with `create-next-app` (TypeScript, App Router, Tailwind, `output: 'export'` in `next.config`)
- [x] Define `Column` and `Card` TypeScript types per the data model above
- [x] Create mock seed data for the 5 fixed columns and a handful of sample cards
- [x] Map the CLAUDE.md color palette into the Tailwind theme
- [x] Build the board layout: columns in fixed order, inline column rename (no add/remove controls)
- [x] Build the card component (title + description preview)
- [x] Integrate `@dnd-kit` for drag-and-drop of cards within and across columns, updating local state on drop
- [x] Build the card edit modal (edit title/description, save/cancel)
- [x] Run `next build`, confirm `frontend/out/` is produced
- [x] Rework the root `Dockerfile` into a multi-stage build: Node stage runs `npm ci && npm run build`, then copies `frontend/out/*` into the Python runtime stage's static directory; remove Part 2's placeholder `index.html`
- [x] Add frontend unit tests (Vitest + React Testing Library) for column rename, card edit save, and drag-and-drop state updates
- [x] Rebuild the Docker image via the start script, confirm the board renders and works (rename, edit, drag) at `http://localhost:8000/` using mock data only
- [x] Create `frontend/AGENTS.md` describing: directory structure, component conventions, mock data shape, dev (`npm run dev`) vs build (`npm run build`) commands, styling/color-scheme approach, state management approach, and where Part 7 will wire in the backend

### Tests / success criteria

- [x] `npm run build` completes without errors and produces `frontend/out/`
- [x] Frontend unit tests pass: rename updates the displayed column name, edit modal persists changes to local state, drag-and-drop updates a card's `columnId`
- [x] Manual check: columns render in fixed order with correct names, cards can be dragged between columns, cards can be edited via modal, all using mock data (no network activity for board data)
- [x] Docker build succeeds end-to-end (Node build stage + Python runtime stage)
- [x] `frontend/AGENTS.md` exists and accurately describes the codebase as built

---

## Part 4: Fake user sign-in

**Goal:** Gate the board behind a login screen using hardcoded credentials ("user" / "password"), with logout support.

### Design decisions

- Session mechanism: an HttpOnly signed session cookie backed by a server-side in-memory token store (a Python dict). This is simpler than JWT/OAuth and appropriate for one hardcoded user, while still surviving page reloads correctly (unlike a plain client-side flag).
- Credential check: direct string comparison against hardcoded constants - no password hashing library, since there's exactly one hardcoded, non-secret-rotating credential pair. This matches CLAUDE.md's "no unnecessary defensive programming."
- Session storage stays in-memory even after Part 5 introduces the database - it is not moved into SQLite (single process, single container; restart-loses-session is an accepted MVP limitation).
- Frontend gating: on mount, the single-page app calls `GET /api/me`; unauthenticated shows the login form, authenticated shows the board.

### Checklist

- [x] Add `POST /api/login` (username/password body) - sets an HttpOnly session cookie on success, 401 on failure
- [x] Add `POST /api/logout` - clears the session (cookie + server-side store)
- [x] Add `GET /api/me` - returns current auth status
- [x] Add an auth dependency function in FastAPI for protecting board routes (used starting in Part 6)
- [x] Build the frontend login form (username/password fields, submit, error message on failure)
- [x] Wire the app root: call `/api/me` on mount, show login form or board accordingly
- [x] Add a logout control in the board UI
- [x] Add backend tests: successful login sets a cookie, wrong credentials return 401, `/api/me` reflects session state, logout clears the session
- [x] Add frontend tests: login form validation/error display, successful login reveals the board, logout returns to the login form
- [x] Rebuild and run via the start script; manually verify the full flow in a browser, including that refreshing the page keeps the session

### Tests / success criteria

- [x] `curl -c cookies.txt -X POST /api/login` with correct credentials succeeds and sets a cookie; incorrect credentials return 401
- [x] `curl -b cookies.txt /api/me` reflects authenticated state; without the cookie it reflects unauthenticated
- [x] Logout followed by `/api/me` shows unauthenticated
- [x] Page refresh while logged in preserves the session; refresh after logout shows the login form
- [x] Backend and frontend automated tests pass

---

## Part 5: Database modeling

**Goal:** Propose and get sign-off on a SQLite schema, documented as JSON plus prose.

### Design decisions

- `users` and `boards` tables exist even though the MVP has exactly one user and one board - this satisfies "the database will support multiple users for future" without adding any multi-user *logic*.
- `columns` table: `{ id, board_id, key, name, order }`. `key` is a fixed internal identifier (e.g. `backlog`, `todo`, `in_progress`, `review`, `done`) that application logic always operates on and never lets a user add/remove; `name` is the user-editable display label. This structurally enforces "fixed but renamable" rather than relying on API-layer validation alone.
- `cards` table: `{ id, column_id, title, description, order, created_at, updated_at }`. `order` is a plain integer, resequenced on move - no fractional-indexing library needed at this scale.
- `messages` table: `{ id, board_id, role, content, created_at }` - added now even though it's unused until Part 9, so history persistence doesn't require a second schema change and sign-off round-trip.
- Session storage is explicitly *not* a table - it stays in-memory per Part 4's decision.
- Schema is written as `docs/db_schema.json` (structured design artifact: tables, fields, types, keys, relationships) plus `docs/database.md` (prose rationale). The actual SQL/`sqlite3` code is written in Part 6, not here.

### Checklist

- [x] Draft the `users`, `boards`, `columns`, `cards`, `messages` schema with fields, types, and foreign keys
- [x] Confirm the `columns` seed data (5 keys/names/order values) matches Part 3's mock data exactly
- [x] Write `docs/db_schema.json`
- [x] Write `docs/database.md` explaining the rationale (multi-user future-proofing, key vs name, order semantics, why messages exists now, why sessions aren't a table)
- [x] Present the schema to the user for explicit sign-off

### Tests / success criteria

- [x] `docs/db_schema.json` is valid JSON and covers every entity needed by Parts 6, 7, and 9
- [x] `docs/database.md` is concise and understandable to a reader unfamiliar with the project
- [x] User has explicitly approved the schema before Part 6 begins

---

## Part 6: Backend CRUD API

**Goal:** Add API routes so the backend can read and persist the Kanban board for the logged-in user, backed by SQLite, auto-created if missing.

### Design decisions

- `backend/db.py` using stdlib `sqlite3` (no ORM/migrations library - the schema is small and static). `CREATE TABLE IF NOT EXISTS` runs on startup, satisfying "database should be created if it doesn't exist."
- An idempotent startup seed inserts the hardcoded user, their board, and the 5 fixed columns if not already present.
- Routes: `GET /api/board` (full board: ordered columns with nested ordered cards), `PATCH /api/columns/{id}` (rename only), `POST /api/cards`, `PATCH /api/cards/{id}` (edit and/or move via `column_id` + `order`), `DELETE /api/cards/{id}`. All protected by Part 4's auth dependency.
- There is deliberately no add/remove-column endpoint - that absence is what enforces "fixed columns."
- Reordering: on move, resequence `order` values for affected cards by simple list-position renumbering.
- `GET /api/board`'s JSON shape is finalized here and reused verbatim by Part 7 (frontend rendering) and Part 9 (AI context + response) - do not redesign it later.
- Deviation from the original wording: rather than storing the numeric `user_id` inside Part 4's session dict, `board.py` resolves the current user's board via a `username` -> `boards` JOIN on each request. Same effect (routes resolve "current user" generically, matching the multi-user-ready schema) without coupling the session store to a DB primary key.

### Checklist

- [x] Implement `backend/db.py`: connection helper, `CREATE TABLE IF NOT EXISTS` for all Part 5 tables, run on startup
- [x] Implement idempotent startup seed (user, board, 5 columns)
- [x] Resolve the current user generically from the session (via username -> board JOIN; see deviation note above)
- [x] Implement `GET /api/board`
- [x] Implement `PATCH /api/columns/{id}` (rename only; reject/ignore attempts to change `key`)
- [x] Implement `POST /api/cards`
- [x] Implement `PATCH /api/cards/{id}` (edit and/or move, with reordering)
- [x] Implement `DELETE /api/cards/{id}`
- [x] Protect all board routes with the Part 4 auth dependency
- [x] Write backend unit tests: DB creation is idempotent, seed data is correct, each route's happy path, 401 when logged out, reorder-correctness edge cases
- [x] Manually verify a full CRUD cycle via curl against a running container
- [x] Confirm deleting the SQLite file and restarting recreates and reseeds it correctly

### Tests / success criteria

- [x] `pytest` covers all routes' happy paths, auth rejection, and reorder correctness
- [x] Deleting the `.db` file and restarting recreates it with correct seed data
- [x] Full curl sequence (login, get board, create card, get board, move card, get board, delete card, get board) behaves correctly at each step

---

## Part 7: Wire frontend to backend

**Goal:** Replace the Part 3 mock data with real calls to the Part 6 API, making the board persistent.

### Design decisions

- A small `frontend/lib/api.ts` client wraps fetches to `/api/board`, `/api/cards`, `/api/columns`, with `credentials: 'include'` for cookie-based auth (same-origin, since everything is served from one container/port).
- Drag-and-drop uses an optimistic update (move immediately in local state, `PATCH` in the background, revert on failure) for responsive UX - this is warranted complexity, not over-engineering. The optimistic-update pure logic (`moveCardLocally`, `renameColumnLocally`, `updateCardLocally`, `removeCardLocally`, `cardsByColumn`) was extracted into `frontend/lib/board-utils.ts` so it stays unit-testable without mocking `fetch`.
- Error handling stays minimal: a simple inline error on failure, no retry/offline system.
- Part 3 didn't include card-creation or card-deletion UI (only rename/edit/drag). Part 7 adds both: a "+ Add card" button per column (`KanbanColumn`) and a "Delete" button in the card edit modal (`CardModal`), since Part 6's API supports both and there was previously no way to exercise them from the UI.
- **Deviation discovered during verification**: `scripts/start.ps1`/`start.sh` do `docker rm -f` followed by `docker run`, meaning the SQLite file (written inside the container's writable layer) was wiped on every restart via our own scripts - the exact scenario Part 7's persistence test is supposed to prove wouldn't have survived it. Fixed by mounting a named Docker volume (`kanban-data` → `/app/data`) and making `backend/db.py`'s `DB_PATH` configurable via `KANBAN_DB_PATH` (defaults to `backend/kanban.db` for local/non-Docker runs, set to `/app/data/kanban.db` in the run scripts). Named volumes survive `docker rm`, so data now persists across the normal stop/start cycle.

### Checklist

- [x] Add `frontend/lib/api.ts` wrapping the board/card/column endpoints
- [x] Load the board via `GET /api/board` after login instead of mock data
- [x] Wire column rename to `PATCH /api/columns/{id}`
- [x] Wire card edit save to `PATCH /api/cards/{id}`
- [x] Wire card creation to `POST /api/cards` (new "+ Add card" UI control, since Part 3 had none)
- [x] Wire card deletion to `DELETE /api/cards/{id}` (new "Delete" button in the edit modal)
- [x] Wire drag-and-drop to `PATCH /api/cards/{id}` with optimistic update + rollback on failure
- [x] Retire the Part 3 mock data module - deleted `frontend/src/lib/mock-data.ts` (confirmed unused, not kept as a fixture)
- [x] Update frontend unit tests to mock the API client
- [x] Add integration tests against a real backend covering load/edit/rename/drag/delete, verified via a follow-up `GET /api/board` (done as a scripted Playwright run against the live full-stack app, not a committed test file - see verification notes)
- [x] Rebuild the full Docker image, manually verify: log in, see the seeded board, make changes, refresh, confirm changes persisted
- [x] Add a named Docker volume so SQLite data survives the normal `stop.ps1`/`start.ps1` cycle (see deviation note above)

### Tests / success criteria

- [x] Updated frontend unit tests pass (API layer mocked) - 23/23 passing
- [x] Integration tests pass against a real backend - scripted browser run: login → real seeded board loads → create card → edit card → rename column → drag card across columns → refresh (state survives) → delete card, zero console errors throughout
- [x] Manual persistence check: restart the container (not just refresh) and confirm changes survived - verified via the actual `stop.ps1` + `start.ps1` scripts (full `docker rm` + recreate), not just `docker stop`/`start`
- No console errors or failed network requests during normal use

---

## Part 8: AI connectivity

**Goal:** Confirm the backend can reach the Anthropic API with a minimal, isolated test call.

### Design decisions

- Use the official `anthropic` Python SDK. Keep this part deliberately minimal - one non-conversational test call, separate from Part 9's complexity.
- `backend/ai.py` wraps client construction (reads `ANTHROPIC_API_KEY` from the environment via the SDK's own credential resolution) and a simple `send_message` helper. `get_client()` and the `MODEL` constant are written to be reused as-is by Part 9's tool-use/structured-output work.
- The model name is a single constant (`ai.MODEL`), set to `claude-opus-5` (Anthropic's current default recommendation for new integrations unless a lighter model is explicitly requested) - easy to change in one place later.
- `GET /api/ai-test` sends a fixed "What is 2+2?" prompt and returns the reply - can remain as a lightweight connectivity health check afterward.
- A missing/invalid API key must produce a clear error response, not a raw stack trace - this is a real operational concern, not defensive over-engineering.
- **Root-caused during implementation**: the installed `anthropic` SDK version raises a bare `TypeError` (not `anthropic.AnthropicError`) when no credentials are resolvable, and only lazily - inside `messages.create()`, not at `Anthropic()` construction. A narrow `except anthropic.AnthropicError` therefore let the real missing-key failure through as an unhandled exception (FastAPI's generic plain-text 500). Fixed with a broad `except Exception` in the route handler - deliberate here since this is a genuine system boundary (the external Anthropic API call), not general-purpose defensive programming.

### Checklist

- [x] Add `anthropic` to `backend/requirements.txt`
- [x] Add `backend/ai.py` with client construction and a `send_message` helper
- [x] Pick and document the model name in one central location
- [x] Add `GET /api/ai-test` (auth-protected) sending "What is 2+2?" and returning the response text
- [x] Handle a missing API key explicitly with a clear error message
- [x] Add a backend test that mocks the Anthropic client (no real API calls in the automated suite)
- [x] Manually verify with a real API key: curl `/api/ai-test` against the running container and confirm a sane "4" response

### Tests / success criteria

- [x] Automated tests pass without needing a real API key (mocked client)
- [x] Manual curl against a running container with a real key returns a response containing "4"
- [x] A missing/invalid key produces a clear error, not an unhandled exception

---

## Part 9: Board-aware AI chat with Structured Outputs

**Goal:** Extend the AI call so it always receives the current board JSON plus the user's message and conversation history, and responds with a structured reply plus an optional board update.

### Design decisions

- Structured output shape (via Anthropic tool-use / forced JSON schema):
  ```
  {
    "reply": "string - the chat message shown to the user",
    "board_update": null | {
      "cards": [{"id": "string|null", "column_key": "string", "title": "string", "description": "string", "order": "number", "deleted": "boolean"}],
      "columns": [{"key": "string", "name": "string"}]
    }
  }
  ```
- `board_update` is a **diff/patch** of only the entities that changed - not a full board replace. This is simpler for the model to produce correctly, less likely to accidentally drop unrelated cards, and maps directly onto Part 6's existing `PATCH`/`POST` functions.
- The backend applies `board_update` by reusing Part 6's card/column mutation functions directly - no separate "apply AI update" code path.
- Each `POST /api/chat` call sends: the current full board (same shape as `GET /api/board`), the new user message, and recent history from the `messages` table (capped, e.g. last 20 messages, to control token usage).
- Both the user's message and the AI's reply are persisted to `messages`.
- The endpoint returns `{ reply, board }` where `board` is the fresh full board state (built via the same function `GET /api/board` uses) - this lets Part 10 avoid any polling.
- **Implementation choice**: used Anthropic's Structured Outputs (`client.messages.parse()` with a Pydantic `output_format`) rather than a model-chosen tool - every response is forced into the `ChatResponse` schema, so there's no `tool_choice` ambiguity. Model is `ai.MODEL` (`claude-opus-5`), reusing Part 8's `ai.get_client()` unchanged. Full schema and rationale in `docs/ai_chat.md`.
- Refined during implementation: `CardUpdate.description` and `.order` are optional (`None` = "leave unchanged" / "append at end"), mirroring `board.update_card`'s own optional-field semantics - this stops the model from having to guess or re-echo values it isn't actually changing (e.g. a pure column move no longer risks blanking the description).

### Checklist

- [x] Document the structured-output schema in `docs/ai_chat.md`
- [x] Confirm the schema's card/column identifiers match Part 5/6's field names exactly
- [x] Implement `POST /api/chat` (auth-protected): load board + recent history, build the system prompt + tool schema, call Anthropic
- [x] Parse the structured response; when `board_update` is present, apply it via Part 6's existing mutation functions
- [x] Persist the user message and AI reply to `messages`
- [x] Return `{ reply, board }` (always the fresh full board, whether or not it changed)
- [x] Add backend tests (mocked Anthropic client): board-update application correctly mutates via existing functions, history persists and is included in later requests, malformed/missing `board_update` defaults to a no-op
- [x] Add tests for both a chat-only turn and a chat-plus-board-change turn
- [x] Manually verify with a real API key: a chat request that asks for a board change results in a changed `GET /api/board`, and conversation history persists across requests

### Tests / success criteria

- [x] Mocked-client tests pass for: no-op chat, card creation via chat, card move via chat, column rename via chat, multi-card update in one turn
- [x] Manual end-to-end: asking the AI to move a card results in `GET /api/board` reflecting the change
- [x] A second chat request can correctly reference something said in the first, proving history is loaded and sent
- [x] Malformed AI output does not crash the endpoint

---

## Part 10: AI chat sidebar UI

**Goal:** Add a sidebar widget for full AI chat that lets the LLM update the Kanban board, with the UI refreshing automatically when it does.

### Design decisions

- No polling or websockets: since Part 9's `/api/chat` response already includes the fresh full board state, the frontend simply replaces its board state with the `board` field after every AI turn.
- Sidebar: message list + input + send button, styled per the CLAUDE.md palette (purple secondary for the send button, blue primary for user message bubbles). Toggleable via a header button (open by default) rather than a full responsive mobile-overlay system - simpler, and this is a desktop-primary app.
- Chat history loads via a new `GET /api/messages` (or equivalent) on app load, so the sidebar isn't empty after a refresh - reusing the history Part 9 already persists.
- Minimal loading/error states: a loading indicator while awaiting a reply, an inline error on failure - no retry queue.
- **Real bug found via tests, fixed**: the mount-time history load must *merge* into state (`[...history, ...prev]`), not overwrite it. A naive overwrite (`setMessages(history)`) would silently drop a message the user sent before the history fetch resolved - a genuine race, not just a test artifact, since `send()`'s optimistic update and the mount effect's fetch both write to the same state independently. Covered by a dedicated regression test (`useChat.test.ts`) that resolves history *after* a send.

### Checklist

- [x] Add `GET /api/messages` returning persisted chat history for the current user's board
- [x] Build the sidebar component (message list + input + send button), styled per the color scheme
- [x] Load and render existing chat history on app load
- [x] Wire send to `POST /api/chat`, optimistically appending the user's message, then appending the AI reply on response
- [x] On receiving a chat response, replace board state with the response's `board` field (no separate `GET /api/board` call)
- [x] Add a loading indicator while awaiting the AI response
- [x] Add inline error handling for failed chat requests
- [x] Add frontend tests: sending a message appends it, a response with a board update visibly updates the board, a response without one leaves the board unchanged, error state renders correctly
- [x] Full manual end-to-end check in the running container: log in, use chat to create/move/edit a card, watch the board update live without a manual refresh, refresh the page and confirm both board and chat history persisted

### Tests / success criteria

- [x] Frontend tests pass (mocking `/api/chat` responses) - 33/33, including the history-merge race regression test
- [x] A board-changing chat instruction updates the visible board within the same interaction, no manual refresh - verified via real browser + real API against the Docker container
- [x] A page refresh after a chat session shows both the persisted board and the persisted chat history - verified via direct DOM inspection after reload
- [x] Sidebar visually matches the CLAUDE.md color palette

---

## Part 11: User sign up

**Goal:** Let people create their own account (email, username, password) instead of only using the shared demo credentials, while keeping the demo login working.

### Design decisions

- Password hashing via the `bcrypt` package directly (not `passlib`, which is unmaintained and has had compatibility breaks with newer `bcrypt` releases).
- `users` gets two new columns, `email` and `password_hash`. Since `CREATE TABLE IF NOT EXISTS` is a no-op against an already-existing local `kanban.db`, `init_db()` runs a small idempotent migration (`PRAGMA table_info(users)` -> `ALTER TABLE ADD COLUMN` for whichever is missing) before seeding, so existing local databases upgrade in place without losing board data. Email uniqueness is enforced via a separate `CREATE UNIQUE INDEX IF NOT EXISTS`, not an inline column constraint, since SQLite's `ALTER TABLE ADD COLUMN` can't add a `UNIQUE` column - the index applies uniformly whether the table was just created or just migrated.
- The seeded demo user (`user`/`password`) gets backfilled with a `password_hash` and a placeholder email if either is missing, so `auth.py` can verify every login the same way (DB lookup + `bcrypt.checkpw`) instead of a separate hardcoded-string special case.
- No new route/page: the app is a static export with no client-side routing, so `LoginForm` gets a `signin`/`signup` mode toggle instead, matching how the rest of the app is already a single-page state machine.
- Sign up does **not** auto-login: `POST /api/signup` only creates the account (no session cookie), and `LoginForm` switches back to sign-in mode with a "Account created. Please sign in." confirmation, so the new user explicitly logs in with their credentials afterward - changed from an initial auto-login design after user feedback that signing up should behave like a normal signup flow, not silently drop them straight onto the board.
- Validation: `email` via Pydantic's `EmailStr`, `password` via `Field(min_length=8)`, both enforced at the model level so they 422 the same way other bad input already does. Username/email uniqueness enforced by the DB and translated to a 409 on conflict.
- **Real bug found via tests, fixed**: `test_auth.py` had its own `client` fixture that never triggered FastAPI's lifespan (`init_db()` never ran), which was silently fine while `verify_credentials` was a hardcoded string comparison that never touched the database. Once verification became DB-backed, every test in that file started failing with `no such table: users`. Fixed by removing the redundant local fixture so the file falls back to `conftest.py`'s isolated, lifespan-triggering `client` fixture (the same one every other test file already uses).

### Checklist

- [x] Add `email`, `password_hash` columns to the `users` schema plus an idempotent migration for existing databases
- [x] Add `db.create_user()` (hash password, insert user, create board + seed columns) and `db.get_user_by_username()`
- [x] Backfill the seeded demo user's `password_hash`/`email` on `init_db()`
- [x] Replace `auth.verify_credentials`'s hardcoded check with a DB lookup + `bcrypt.checkpw`
- [x] Add `POST /api/signup` (duplicate check -> 409, validation -> 422, success -> creates the account only, no session)
- [x] Add `bcrypt` and `pydantic[email]` to `backend/requirements.txt`
- [x] Add a `signin`/`signup` mode toggle to `LoginForm`, with an email field shown only in sign up mode
- [x] Wire `useAuth.signup()` and `App.tsx` through to the new toggle
- [x] Add backend tests: successful signup, isolated per-user boards, duplicate username/email -> 409, weak password/bad email -> 422, demo login still works
- [x] Add a migration test that upgrades a simulated old-shape `users` table without losing data
- [x] Add frontend tests: mode toggle shows the email field, signup submits all three fields, signup error renders, signup returns to sign-in with a confirmation, full signup-then-login flow
- [x] Manually verify in a running instance: sign up a new user, confirm it returns to the sign-in form (not auto-logged in), log in with the new account and land on an empty board, confirm the demo login still works, confirm two signed-up users see only their own boards, confirm an old pre-migration `kanban.db` upgrades cleanly on startup

### Tests / success criteria

- [x] Backend test suite passes (53/53), including new `test_signup.py` and the `test_db.py` migration/`create_user` tests
- [x] Frontend test suite passes (38/38), including the new `LoginForm`/`App` signup tests
- [x] `npm run build` compiles with no TypeScript errors
- [x] Manual verification of the signup flow and the pre-existing-database migration path in a real running instance - signup returns to sign-in (not auto-login), isolated per-user boards, duplicate-username error, demo login, and a simulated pre-migration `kanban.db` all verified via a real browser and direct API calls, zero console/page errors

---

## Part 12: Shared projects alongside personal boards

**Goal:** Let any signed-in user switch between their private personal board and shared "projects" via a dropdown under the "Kanban Board" heading. Projects are visible to and editable by every signed-in user, but only the seeded demo account (`user`) can create one.

### Design decisions

- `boards` gets `type TEXT NOT NULL DEFAULT 'personal'` and `name TEXT`, migrated the same way as the `users` table in [[part 11]] - existing rows get `type='personal'` automatically via the `ALTER TABLE ADD COLUMN ... DEFAULT` clause, no data loss. Project name uniqueness uses a partial unique index (`WHERE type = 'project'`) so personal boards' `NULL` names never collide.
- No membership/join table: a board is accessible if it's `type='personal'` and owned by the caller, or `type='project'` (open to everyone signed in). `board._assert_board_access` is the single authorization primitive for both cases.
- Project creation is server-side gated to `username == db.HARDCODED_USERNAME` (403 otherwise) - this is the actual access-control boundary, not just a hidden UI control.
- Almost the entire existing API surface needed no `board_id` parameter at all: `PATCH /api/columns/{id}`, `POST /api/cards`, `PATCH`/`DELETE /api/cards/{id}` already resolve their board from the column/card id in the URL, so only their authorization check changed. Only `GET /api/board`, `GET /api/messages`, and `POST /api/chat` gained an **optional** `board_id`, defaulting to the caller's personal board when omitted - this kept the entire pre-existing test suite and every old frontend call site working unchanged.
- `chat.py`'s `chat()` resolves the personal board when `board_id` is omitted, then threads the resolved id through every board.py call it makes - so chatting while a project is selected reads/writes that project. Since `messages` was already keyed by `board_id` (not `user_id`), a project's chat history is naturally shared with no schema change.
- No client-side routing exists (static export, single-page state machine per `frontend/AGENTS.md`), so board switching is React state: a new `useBoards()` hook loads `GET /api/boards` once, `Board.tsx` holds `activeBoardId` (defaulting to the personal board once resolved) and passes it into `useKanbanBoard(boardId)` and `useChat(boardId, applyBoard)`, both of which now refetch/reset on `boardId` change.
- No project rename/delete, no per-card "created by" attribution - out of scope, matching the existing "fixed columns, no add/remove" precedent.
- **Real bug found before running any tests, fixed**: the original `_seed()` looked up the demo user's board via `WHERE user_id = ?` with no `type` filter. Once `user` could own more than one board (their personal board plus any projects they create), a later `init_db()` run could have matched a project board instead of the personal one and silently stopped re-seeding missing columns on the actual personal board. Fixed by scoping that lookup to `type = 'personal'`.
- **Real bug found via manual review before running tests, fixed**: `chat_route`'s broad `except Exception` (justified for the external Anthropic API boundary) would have also swallowed the deliberate `HTTPException(400)` raised by invalid `board_id` parsing and reported it as a misleading 500. Fixed by re-raising `HTTPException` before the generic catch.

### Checklist

- [x] Add `type`, `name` to the `boards` schema plus an idempotent migration for existing databases (partial unique index for project names)
- [x] Generalize board-creation to `db._create_board_with_columns(conn, user_id, board_type, name)`; add `db.create_project()`
- [x] Replace `board._get_board_id_for_user` with `board._assert_board_access` + `board.resolve_personal_board_id`/`get_personal_board_id`; thread explicit `board_id` through `get_board`, `rename_column`, `create_card`, `update_card`, `delete_card`, `get_column_id_by_key`, `get_recent_messages`, `add_message`
- [x] Add `board.list_boards()` (personal + all projects)
- [x] Add `GET /api/boards`, `POST /api/projects` (403 for non-demo users, 409 on duplicate name); make `board_id` optional on `GET /api/board`, `GET /api/messages`, `POST /api/chat`
- [x] Thread `board_id` through `chat.py`'s system prompt + update-application helpers
- [x] Add `useBoards()`, extend `useKanbanBoard`/`useChat` to accept and react to `boardId`
- [x] Build `BoardSwitcher` (username entry, project list, "+ New project" gated on `username === "user"`); wire into `Board.tsx`/`App.tsx` (`useAuth` now also exposes `username`)
- [x] Add backend tests: schema migration, `create_project`, project cards visible/editable by a second user, personal-board access denied cross-user, default (`board_id` omitted) behavior unchanged, project creation 403/409, chat scoped to a project's `board_id`
- [x] Add frontend tests: `BoardSwitcher` rendering/selection/creation, `useKanbanBoard`/`useChat` refetch-on-`boardId`-change, full switch-board-and-see-different-cards flow in `App.test.tsx`
- [x] Manually verify in a running instance: `user` creates `project1` and adds a card; a second signed-up account switches to `project1`, sees that card, and adds their own; both accounts' personal boards stay private and unaffected; the "+ New project" control is absent for the second account; AI chat scoping to a project verified via the mocked-client backend test (`test_projects.py`), not a live-key browser smoke test, to avoid touching the user's own running container/API key

### Tests / success criteria

- [x] Backend test suite passes (66/66), including new `test_projects.py` and the `test_db.py`/`test_board.py` additions
- [x] Frontend test suite passes (47/47), including the new `BoardSwitcher.test.tsx` and hook/integration additions
- [x] `npm run build` compiles with no TypeScript errors
- [x] Manual verification of the full shared-project flow (creation, cross-user visibility, access control) via a real browser against a fresh database, plus a separate `boards`-table migration check against a simulated pre-Part-12 database with real card data - both clean, zero console/page errors

---

## Part 13: Card due dates

**Goal:** Let a due date be set on any card, editable both inline on the card face and in the existing edit modal, using the browser's native calendar picker.

### Design decisions

- `cards` gets one new nullable column, `due_date TEXT` (ISO `YYYY-MM-DD`), migrated the same way as every prior schema addition in `db.py` - existing cards get `NULL` (no due date), no data loss.
- No new UI library: a plain `<input type="date">` already opens the browser's native calendar picker on click and round-trips `YYYY-MM-DD` strings directly, so no date-picker dependency or custom calendar component was needed.
- Inline field lives directly on `KanbanCard`, requested at "the bottom of each card" - not just in the modal. Since the whole card is a clickable + draggable surface (`onClick` opens the edit modal, dnd-kit listeners are spread on the same element), the date input stops click/pointerdown propagation so picking a date neither opens the modal nor is mistaken for a drag start.
- Update semantics distinguish three states through the same optional field: omitted (`None`) leaves the due date untouched, an empty string clears it (stored as SQL `NULL`, not `""`, so a cleared date matches a never-set date), and any other value sets it. This mirrors the existing `title`/`description` optional-update pattern in `board.update_card`.
- The edit modal also gained a due date field for a consistent full-edit experience, since it already edits title/description together - not explicitly requested, but a natural, low-cost complement to the inline field.
- **Revised after initial ship**: `due_date` was first left out of the AI chat's `board_update` schema ([[part 9]]) as "out of scope" - but that meant the AI had no field to express a due-date change in at all, which surfaced immediately as "why can't the AI set the due date?" Added `CardUpdate.due_date` (same optional/empty-string/set semantics as the REST API) plus a `Today's date` line in the system prompt, since without a reference date the model can't resolve relative requests like "due next Friday." Verified with a real Anthropic API call, not just the mocked-client tests: the model correctly resolved "next Friday" against the injected date and both set and cleared a due date via chat.

### Checklist

- [x] Add `due_date` to the `cards` schema plus an idempotent migration (`_migrate_cards_table`) for existing databases
- [x] Thread `due_date` through `board.create_card`/`update_card`/`_row_to_card` (empty string clears to `NULL`, omitted leaves unchanged)
- [x] Add `due_date` to `CardCreateRequest`/`CardUpdateRequest` and wire the routes
- [x] Add `dueDate` to the frontend `Card` type, `api.ts`, `board-utils.ts`, and `useKanbanBoard.updateCard`
- [x] Add the inline `<input type="date">` to `KanbanCard.tsx` (stops click/pointerdown propagation) wired through `KanbanColumn`/`Board.tsx` to `updateCard`
- [x] Add a due date field to `CardModal.tsx`, pre-filled from the card and saved alongside title/description
- [x] Add backend tests: create/update with a due date, clearing via empty string, omitting leaves it unchanged, migration test with real pre-existing card data
- [x] Add frontend tests: new `KanbanCard.test.tsx` (renders/pre-fills the field, calls back without opening the card), `CardModal.test.tsx` due date save/clear, `board-utils.test.ts`/`useKanbanBoard.test.ts` due-date-only update
- [x] Manually verify in a running instance: set a due date inline without the modal opening, reload and confirm it persisted, open the modal and confirm it shows/edits the same value, clear it inline; separately verify the migration against a simulated pre-Part-13 database with a real pre-existing card
- [x] Add `due_date` to the AI chat's `CardUpdate` schema and a `Today's date` line to the system prompt; add mocked-client tests (create with a due date, set on an existing card, clear via empty string, omitted leaves it unchanged) and manually verify with a real Anthropic API call that natural-language relative dates ("next Friday") resolve correctly and both set and clear round-trip through chat

### Tests / success criteria

- [x] Backend test suite passes (76/76), including the due-date, migration, and AI-chat due-date tests
- [x] Frontend test suite passes (55/55), including new `KanbanCard.test.tsx` and the due-date additions across existing suites
- [x] `npm run build` compiles with no TypeScript errors
- [x] Manual verification via a real browser: inline field doesn't open the modal, due date persists across reload, modal and card face stay in sync, clearing works, and the migration path preserves a real pre-existing card while adding `due_date = NULL`
- [x] Manual verification with a real Anthropic API call: "set the due date to next Friday" and "remove the due date" both correctly read/wrote the card's `due_date` through chat
