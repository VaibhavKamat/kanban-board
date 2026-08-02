<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Frontend codebase

Next.js 16 (App Router, TypeScript, Tailwind CSS v4), configured for static export (`output: "export"` in `next.config.ts`). There is no Next.js server at runtime - `npm run build` produces `out/`, which the FastAPI backend serves as static files at `/` (see the root `Dockerfile` and `backend/main.py`). The board is now backed by the real SQLite-persisted API (Part 7) - there is no mock data left in the app.

## Structure

- `src/app/` - App Router shell: `layout.tsx` (fonts, metadata), `page.tsx` (renders `<App />`), `globals.css` (Tailwind + theme colors).
- `src/types/kanban.ts` - `Column`, `Card`, and `BoardSummary` types, matching the database schema field names and the backend's response shapes exactly.
- `src/lib/api.ts` - the only place that calls `fetch` for board data. Wraps `GET /api/board`, `GET /api/boards`, `POST /api/projects`, `PATCH /api/columns/{id}`, `POST /api/cards`, `PATCH /api/cards/{id}`, `DELETE /api/cards/{id}`, all with `credentials: "include"`. Every mutation endpoint returns the full fresh board, which callers apply wholesale rather than patching local state piecemeal. `getBoard`, `getMessages`, `sendChatMessage` all take an optional `boardId` (appended as `?board_id=`/a body field) - omitting it means "my personal board", matching the backend's default.
- `src/lib/board-utils.ts` - pure, network-free state-transform functions (`cardsByColumn`, `renameColumnLocally`, `updateCardLocally`, `moveCardLocally`, `removeCardLocally`) used for optimistic UI updates before the server confirms. Unit-tested directly (`board-utils.test.ts`) without mocking `fetch`.
- `src/hooks/useKanbanBoard.ts` - takes an optional `boardId`; loads that board on mount and whenever `boardId` changes (`loading`/`error` state), and for every mutation applies the optimistic local change immediately, then either replaces state with the server's authoritative response or rolls back to the pre-mutation snapshot on failure. Mutations (rename/create/update/move/delete) don't need `boardId` themselves - the backend derives it from the column/card id being mutated.
- `src/hooks/useBoards.ts` - loads the current user's accessible boards (`GET /api/boards`: their personal board plus every shared project) on mount, and exposes `createProject(name)` for the demo `user` account.
- `src/hooks/useAuth.ts` - auth status (`loading`/`authenticated`/`unauthenticated`) plus the current `username`, `login`/`signup`/`logout`, backed by `/api/login`, `/api/signup`, `/api/logout`, `/api/me`. Checks session on mount via `/api/me`. `signup()` only creates the account (no session) - `LoginForm` switches back to sign-in mode afterward rather than auto-logging in.
- `src/components/App.tsx` - top-level auth gate: renders `LoginForm` or `Board` (passing `username`) based on `useAuth`'s status.
- `src/components/LoginForm.tsx` - a single form with a `signin`/`signup` mode toggle (no separate page, since the app has no client-side routing). Sign-up mode adds an email field; a successful sign-up clears the password field, switches back to sign-in mode, and shows a "Account created. Please sign in." notice instead of logging in automatically.
- `src/components/Board.tsx` - board orchestrator: owns `useBoards()` and `activeBoardId` state (defaults to the personal board once `useBoards` resolves), renders `BoardSwitcher` under the heading, the `DndContext`/columns for whichever board is active, opens the edit modal (closed automatically on board switch), has the header logout button, shows a loading state while the board fetch is in flight and an inline error banner on any mutation failure.
- `src/components/BoardSwitcher.tsx` - dropdown under the "Kanban Board" heading: a trigger showing the active board's name (the username for the personal board, the project's name otherwise), a menu listing the personal board and every project, and - only for the `user` account - an inline "+ New project" text input.
- `src/components/KanbanColumn.tsx` - one column: fixed name/key, inline rename (click to edit, Enter/blur to commit, empty names are rejected), droppable + sortable card list, and a "+ Add card" button that creates a card with a default title via `createCard`. Its `useDroppable` id is prefixed (`column-${column.id}`, see Known gotcha below) - always read the real id back from `data.columnId`, never the raw dnd-kit id.
- `src/components/KanbanCard.tsx` - one card, draggable via `@dnd-kit/sortable`. Exports `KanbanCardContent` (title/description markup only) separately so `Board.tsx`'s `DragOverlay` can render the same visual without also attaching `useSortable` to it. Also renders an inline `<input type="date">` at the bottom of the card for the due date - it stops click/pointerdown propagation so picking a date doesn't open the edit modal or get mistaken for the start of a drag.
- `src/components/CardModal.tsx` - edit modal for a card's title, description, and due date, plus a "Delete" button that calls `deleteCard` and closes the modal.
- `src/hooks/useChat.ts` - takes an optional `boardId`; loads that board's chat history on mount and whenever `boardId` changes (clearing local messages first, since switching boards means switching histories entirely), and on `send()`: appends the user's message optimistically, calls `POST /api/chat` with the same `boardId`, appends the reply, then hands the response's `board` field to `useKanbanBoard`'s `applyBoard` - no separate `GET /api/board` call, no polling. The history load *merges* (`[...history, ...prev]`) rather than overwrites, so a message sent before history finishes loading isn't silently dropped - this was a real race caught by `useChat.test.ts`, not a hypothetical.
- `src/components/ChatSidebar.tsx` - message list + input + send button, styled per the color scheme (purple secondary send button, blue-primary user bubbles). Purely presentational - all state lives in `useChat`.
- `src/components/Board.tsx` also renders `ChatSidebar` alongside the board (toggleable via a header button, open by default) and owns the `useChat(activeBoardId, applyBoard)` wiring, so AI chat always acts on whichever board is currently selected.

## Data model

Columns are fixed and only renamable - there is no add/remove-column UI, by design (see CLAUDE.md). Each `Column` has a stable `key` (e.g. `todo`) that never changes, and an editable `name`. Cards belong to a column via `columnId` and carry an `order` used for both within-column and cross-column positioning. IDs are always strings, matching the backend's response shape (which stringifies its integer primary keys).

A card's `dueDate` is `string | null` - `null` means no due date, otherwise an ISO `YYYY-MM-DD` string (what `<input type="date">` natively produces/consumes, so no format conversion happens anywhere). When *sending* an update, the convention is plain strings only, never `null`: omit `dueDate` to leave it unchanged, or send `""` to clear it - `useKanbanBoard.updateCard`'s update payload type is deliberately `{ dueDate?: string }`, not reusing `Card`'s own `string | null` field type, to keep that distinction explicit at the boundary.

Every user has exactly one private personal board. Shared "projects" are additional boards visible to and editable by every signed-in user, but only creatable by the `user` account - see `BoardSwitcher.tsx` and `useBoards.ts`. There's no URL/route per board; which board is "active" is plain React state in `Board.tsx`, threaded into `useKanbanBoard`/`useChat`.

## Commands

- `npm run dev` - dev server at `http://localhost:3000`. API calls only succeed if something is also serving the backend on the same origin - there is no dev proxy configured, so `npm run dev` alone shows a permanent loading/error state for board data unless run against a build served by FastAPI (see `docs/PLAN.md` Part 2/3 for the static-serving setup).
- `npm run build` - static export to `out/`. Required before the Docker image can serve real content (the multi-stage `Dockerfile` runs this automatically).
- `npm test` - Vitest + React Testing Library. `board-utils.test.ts` covers the pure state-transform logic directly; `useKanbanBoard.test.ts` mocks `@/lib/api` to test loading, error, and optimistic-update/rollback behavior; component tests cover rename/edit/delete interactions, not full drag-and-drop simulation.
- `npm run lint` - ESLint.

## Styling

Tailwind v4's CSS-first config (`@theme` block in `src/app/globals.css`) - no `tailwind.config.js`. The CLAUDE.md brand palette is registered there as `--color-accent-yellow`, `--color-blue-primary`, `--color-purple-secondary`, `--color-dark-navy`, `--color-gray-text`, usable as `bg-accent-yellow`, `text-dark-navy`, etc.

## Known gotchas

- `DndContext` must be given a fixed `id` prop (`id="kanban-board"` in `Board.tsx`). Without it, `@dnd-kit` generates `aria-describedby` IDs from a module-level counter that differs between the server and client render passes, causing a React hydration mismatch. Don't remove the `id` prop.
- dnd-kit requires every draggable/droppable `id` to be unique *within a `DndContext`*, across all types - but card ids and column ids are both raw DB primary keys from separate sequences, so card `"1"` and column `"1"` can (and, on a fresh seeded board, do) collide. Column droppables are prefixed (`column-${column.id}`) to avoid this; `Board.tsx` always reads the real id from `over.data.current.columnId`, never `over.id` directly. This was a real, previously-undetected bug: same-column card reordering could silently target the wrong drop position whenever a card's id matched a column's id.
- Cross-column drag movement is handled in `onDragOver` (`Board.tsx`), not `onDragEnd`: dnd-kit's `SortableContext` already animates same-column reordering previews on its own, but moving a card's data into a *different* column's array is app state, not something the library tracks - so `onDragOver` calls `useKanbanBoard`'s `moveCardLocal` (state-only, no API call) to move the card into the new column live as the drag crosses into it, appending at the end for now; `onDragEnd` resolves the precise final index and persists. A `<DragOverlay>` renders the actual moving card (via `KanbanCardContent`) so it visibly floats between columns, while the card's original slot goes fully transparent (`opacity: 0`) rather than dimmed, avoiding a duplicate/ghost look. Dropping outside any column, or cancelling the drag (Escape), reverts to the pre-drag snapshot captured in `Board.tsx`'s `dragStartCardsRef` via `useKanbanBoard`'s `resetCards`.

## Persistence

`kanban.db` lives in a named Docker volume (`kanban-data`, mounted at `/app/data`) in the containerized app, not in the container's own writable layer - see `backend/db.py`'s `KANBAN_DB_PATH` env var and `scripts/start.sh`/`start.ps1`. This matters because `scripts/stop.*` fully removes the container (`docker rm -f`); without the volume, every stop/start cycle would silently reset the board to its seeded state.
