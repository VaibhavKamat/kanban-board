<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Frontend codebase

Next.js 16 (App Router, TypeScript, Tailwind CSS v4), configured for static export (`output: "export"` in `next.config.ts`). There is no Next.js server at runtime - `npm run build` produces `out/`, which the FastAPI backend serves as static files at `/` (see the root `Dockerfile` and `backend/main.py`). The board is now backed by the real SQLite-persisted API (Part 7) - there is no mock data left in the app.

## Structure

- `src/app/` - App Router shell: `layout.tsx` (fonts, metadata), `page.tsx` (renders `<App />`), `globals.css` (Tailwind + theme colors).
- `src/types/kanban.ts` - `Column` and `Card` types, matching the database schema field names (`docs/PLAN.md` Part 5) and the backend's `GET /api/board` response shape exactly.
- `src/lib/api.ts` - the only place that calls `fetch` for board data. Wraps `GET /api/board`, `PATCH /api/columns/{id}`, `POST /api/cards`, `PATCH /api/cards/{id}`, `DELETE /api/cards/{id}`, all with `credentials: "include"`. Every mutation endpoint returns the full fresh board, which callers apply wholesale rather than patching local state piecemeal.
- `src/lib/board-utils.ts` - pure, network-free state-transform functions (`cardsByColumn`, `renameColumnLocally`, `updateCardLocally`, `moveCardLocally`, `removeCardLocally`) used for optimistic UI updates before the server confirms. Unit-tested directly (`board-utils.test.ts`) without mocking `fetch`.
- `src/hooks/useKanbanBoard.ts` - orchestrates `api.ts` + `board-utils.ts`: loads the board on mount (`loading`/`error` state), and for every mutation applies the optimistic local change immediately, then either replaces state with the server's authoritative response or rolls back to the pre-mutation snapshot on failure.
- `src/hooks/useAuth.ts` - auth status (`loading`/`authenticated`/`unauthenticated`) plus `login`/`logout`, backed by `/api/login`, `/api/logout`, `/api/me` (Part 4). Checks session on mount via `/api/me`.
- `src/components/App.tsx` - top-level auth gate: renders `LoginForm` or `Board` based on `useAuth`'s status.
- `src/components/LoginForm.tsx` - username/password form with inline error display.
- `src/components/Board.tsx` - board orchestrator: owns the `DndContext`, renders columns, opens the edit modal, has the header logout button, shows a loading state while the initial board fetch is in flight and an inline error banner on any mutation failure.
- `src/components/KanbanColumn.tsx` - one column: fixed name/key, inline rename (click to edit, Enter/blur to commit, empty names are rejected), droppable + sortable card list, and a "+ Add card" button that creates a card with a default title via `createCard`.
- `src/components/KanbanCard.tsx` - one card, draggable via `@dnd-kit/sortable`.
- `src/components/CardModal.tsx` - edit modal for a card's title/description, plus a "Delete" button that calls `deleteCard` and closes the modal.
- `src/hooks/useChat.ts` - loads chat history on mount (`GET /api/messages`), and on `send()`: appends the user's message optimistically, calls `POST /api/chat`, appends the reply, then hands the response's `board` field to `useKanbanBoard`'s `applyBoard` - no separate `GET /api/board` call, no polling. The mount-time history load *merges* (`[...history, ...prev]`) rather than overwrites, so a message sent before history finishes loading isn't silently dropped - this was a real race caught by `useChat.test.ts`, not a hypothetical.
- `src/components/ChatSidebar.tsx` - message list + input + send button, styled per the color scheme (purple secondary send button, blue-primary user bubbles). Purely presentational - all state lives in `useChat`.
- `src/components/Board.tsx` also renders `ChatSidebar` alongside the board (toggleable via a header button, open by default) and owns the `useChat(applyBoard)` wiring.

## Data model

Columns are fixed and only renamable - there is no add/remove-column UI, by design (see CLAUDE.md). Each `Column` has a stable `key` (e.g. `todo`) that never changes, and an editable `name`. Cards belong to a column via `columnId` and carry an `order` used for both within-column and cross-column positioning. IDs are always strings, matching the backend's response shape (which stringifies its integer primary keys).

## Commands

- `npm run dev` - dev server at `http://localhost:3000`. API calls only succeed if something is also serving the backend on the same origin - there is no dev proxy configured, so `npm run dev` alone shows a permanent loading/error state for board data unless run against a build served by FastAPI (see `docs/PLAN.md` Part 2/3 for the static-serving setup).
- `npm run build` - static export to `out/`. Required before the Docker image can serve real content (the multi-stage `Dockerfile` runs this automatically).
- `npm test` - Vitest + React Testing Library. `board-utils.test.ts` covers the pure state-transform logic directly; `useKanbanBoard.test.ts` mocks `@/lib/api` to test loading, error, and optimistic-update/rollback behavior; component tests cover rename/edit/delete interactions, not full drag-and-drop simulation.
- `npm run lint` - ESLint.

## Styling

Tailwind v4's CSS-first config (`@theme` block in `src/app/globals.css`) - no `tailwind.config.js`. The CLAUDE.md brand palette is registered there as `--color-accent-yellow`, `--color-blue-primary`, `--color-purple-secondary`, `--color-dark-navy`, `--color-gray-text`, usable as `bg-accent-yellow`, `text-dark-navy`, etc.

## Known gotcha

`DndContext` must be given a fixed `id` prop (`id="kanban-board"` in `Board.tsx`). Without it, `@dnd-kit` generates `aria-describedby` IDs from a module-level counter that differs between the server and client render passes, causing a React hydration mismatch. Don't remove the `id` prop.

## Persistence

`kanban.db` lives in a named Docker volume (`kanban-data`, mounted at `/app/data`) in the containerized app, not in the container's own writable layer - see `backend/db.py`'s `KANBAN_DB_PATH` env var and `scripts/start.sh`/`start.ps1`. This matters because `scripts/stop.*` fully removes the container (`docker rm -f`); without the volume, every stop/start cycle would silently reset the board to its seeded state.
