<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Frontend codebase

Next.js 16 (App Router, TypeScript, Tailwind CSS v4), configured for static export (`output: "export"` in `next.config.ts`). There is no Next.js server at runtime - `npm run build` produces `out/`, which the FastAPI backend serves as static files at `/` (see the root `Dockerfile` and `backend/main.py`).

## Structure

- `src/app/` - App Router shell: `layout.tsx` (fonts, metadata), `page.tsx` (renders `<Board />`), `globals.css` (Tailwind + theme colors).
- `src/types/kanban.ts` - `Column` and `Card` types. These mirror the planned database schema field names (`docs/PLAN.md` Part 5) so wiring up the real backend in Part 7 doesn't require a translation layer.
- `src/lib/mock-data.ts` - hardcoded seed data (5 fixed columns, sample cards). This is what the board renders against until Part 7 replaces it with real API calls.
- `src/hooks/useKanbanBoard.ts` - all board state and mutation logic (`renameColumn`, `updateCard`, `moveCard`), kept separate from components so it's testable without rendering the DnD tree. `moveCard` resequences `order` within and across columns the same way the backend will (Part 6).
- `src/components/Board.tsx` - top-level orchestrator: owns the `DndContext`, renders columns, opens the edit modal.
- `src/components/KanbanColumn.tsx` - one column: fixed name/key, inline rename (click to edit, Enter/blur to commit, empty names are rejected), droppable + sortable card list.
- `src/components/KanbanCard.tsx` - one card, draggable via `@dnd-kit/sortable`.
- `src/components/CardModal.tsx` - edit modal for a card's title/description.

## Data model

Columns are fixed and only renamable - there is no add/remove-column UI, by design (see CLAUDE.md). Each `Column` has a stable `key` (e.g. `todo`) that never changes, and an editable `name`. Cards belong to a column via `columnId` and carry an `order` used for both within-column and cross-column positioning.

## Commands

- `npm run dev` - dev server at `http://localhost:3000`, mock data only.
- `npm run build` - static export to `out/`. Required before the Docker image can serve real content (the multi-stage `Dockerfile` runs this automatically).
- `npm test` - Vitest + React Testing Library. Tests cover the `useKanbanBoard` hook's state logic (rename/edit/reorder/move) and component-level interactions (rename commit, modal save/cancel), not full drag-and-drop simulation.
- `npm run lint` - ESLint.

## Styling

Tailwind v4's CSS-first config (`@theme` block in `src/app/globals.css`) - no `tailwind.config.js`. The CLAUDE.md brand palette is registered there as `--color-accent-yellow`, `--color-blue-primary`, `--color-purple-secondary`, `--color-dark-navy`, `--color-gray-text`, usable as `bg-accent-yellow`, `text-dark-navy`, etc.

## Known gotcha

`DndContext` must be given a fixed `id` prop (`id="kanban-board"` in `Board.tsx`). Without it, `@dnd-kit` generates `aria-describedby` IDs from a module-level counter that differs between the server and client render passes, causing a React hydration mismatch. Don't remove the `id` prop.

## Where the backend gets wired in (Part 7)

`src/lib/mock-data.ts` and the initial state in `useKanbanBoard` get replaced with real `fetch` calls to `/api/board`, `/api/cards`, `/api/columns` (see `docs/PLAN.md` Part 7). The hook's function signatures (`renameColumn`, `updateCard`, `moveCard`) are intended to stay the same shape - only their implementation changes from local `setState` to optimistic local update + API call.
