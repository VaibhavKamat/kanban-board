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
- Sidebar: always visible on desktop widths, toggleable on narrow widths; message list + input + send button, styled per the CLAUDE.md palette (e.g. purple secondary for the send button).
- Chat history loads via a new `GET /api/messages` (or equivalent) on app load, so the sidebar isn't empty after a refresh - reusing the history Part 9 already persists.
- Minimal loading/error states: a loading indicator while awaiting a reply, an inline error on failure - no retry queue.

### Checklist

- [ ] Add `GET /api/messages` returning persisted chat history for the current user's board
- [ ] Build the sidebar component (message list + input + send button), styled per the color scheme
- [ ] Load and render existing chat history on app load
- [ ] Wire send to `POST /api/chat`, optimistically appending the user's message, then appending the AI reply on response
- [ ] On receiving a chat response, replace board state with the response's `board` field (no separate `GET /api/board` call)
- [ ] Add a loading indicator while awaiting the AI response
- [ ] Add inline error handling for failed chat requests
- [ ] Add frontend tests: sending a message appends it, a response with a board update visibly updates the board, a response without one leaves the board unchanged, error state renders correctly
- [ ] Full manual end-to-end check in the running container: log in, use chat to create/move/edit a card, watch the board update live without a manual refresh, refresh the page and confirm both board and chat history persisted

### Tests / success criteria

- Frontend tests pass (mocking `/api/chat` responses)
- A board-changing chat instruction updates the visible board within the same interaction, no manual refresh
- A page refresh after a chat session shows both the persisted board and the persisted chat history
- Sidebar visually matches the CLAUDE.md color palette
