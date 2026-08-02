"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { BoardSwitcher } from "@/components/BoardSwitcher";
import { CardModal } from "@/components/CardModal";
import { ChatSidebar } from "@/components/ChatSidebar";
import { KanbanCardContent } from "@/components/KanbanCard";
import { KanbanColumn } from "@/components/KanbanColumn";
import { useBoards } from "@/hooks/useBoards";
import { useChat } from "@/hooks/useChat";
import { useKanbanBoard } from "@/hooks/useKanbanBoard";
import type { Card } from "@/types/kanban";

interface BoardProps {
  username: string;
  onLogout: () => void;
}

export function Board({ username, onLogout }: BoardProps) {
  const { boards, createProject } = useBoards();
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);

  useEffect(() => {
    if (activeBoardId !== null || boards.length === 0) return;
    const personal = boards.find((b) => b.type === "personal");
    if (personal) setActiveBoardId(personal.id);
  }, [boards, activeBoardId]);

  const {
    columns,
    cards,
    cardsByColumn,
    loading,
    error,
    renameColumn,
    updateCard,
    moveCard,
    moveCardLocal,
    resetCards,
    createCard,
    deleteCard,
    applyBoard,
  } = useKanbanBoard(activeBoardId);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [draggingCard, setDraggingCard] = useState<Card | null>(null);
  const dragStartCardsRef = useRef<Card[] | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chat = useChat(activeBoardId, applyBoard);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleSelectBoard(boardId: string) {
    setActiveBoardId(boardId);
    setActiveCard(null);
  }

  // Resolves what column a drag is currently over, from either hovering
  // directly over the (empty) column area or over one of its cards. Always
  // read the real column id from `data.columnId`, never the raw dnd-kit
  // registry id - a column's dnd-kit id is prefixed (see KanbanColumn) to
  // avoid colliding with card ids, which are separate DB primary keys that
  // can easily share the same numeric value.
  function overColumnId(over: DragOverEvent["over"]): string | undefined {
    const overData = over?.data.current as
      | { type: "column"; columnId: string }
      | { type: "card"; columnId: string }
      | undefined;
    return overData?.columnId;
  }

  function handleDragStart(event: DragStartEvent) {
    dragStartCardsRef.current = cards;
    setDraggingCard(cards.find((c) => c.id === event.active.id) ?? null);
  }

  // Cross-column moves aren't something dnd-kit tracks on its own (unlike
  // same-column reordering, which SortableContext already previews visually
  // without any state change from us) - so this is the one case we move the
  // card between columns live, appending it at the end of the new column for
  // now. onDragEnd resolves the precise final index within that column.
  function handleDragOver(event: DragOverEvent) {
    const activeId = event.active.id as string;
    const movingCard = cards.find((c) => c.id === activeId);
    const targetColumnId = overColumnId(event.over);
    if (!movingCard || !targetColumnId || targetColumnId === movingCard.columnId) return;

    moveCardLocal(activeId, targetColumnId, cardsByColumn(cards, targetColumnId).length);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const startSnapshot = dragStartCardsRef.current ?? undefined;
    dragStartCardsRef.current = null;
    setDraggingCard(null);

    const overData = over?.data.current as
      | { type: "column"; columnId: string }
      | { type: "card"; columnId: string }
      | undefined;
    const targetColumnId = overColumnId(over);

    let targetIndex: number;

    if (!targetColumnId) {
      // Dropped somewhere invalid - undo onDragOver's live preview.
      if (startSnapshot) resetCards(startSnapshot);
      return;
    } else if (overData?.type === "card") {
      const list = cardsByColumn(cards, targetColumnId);
      const index = list.findIndex((card) => card.id === over!.id);
      targetIndex = index === -1 ? list.length : index;
    } else {
      targetIndex = cardsByColumn(cards, targetColumnId).length;
    }

    moveCard(active.id as string, targetColumnId, targetIndex, startSnapshot);
  }

  function handleDragCancel(_event: DragCancelEvent) {
    const startSnapshot = dragStartCardsRef.current;
    dragStartCardsRef.current = null;
    setDraggingCard(null);
    if (startSnapshot) resetCards(startSnapshot);
  }

  return (
    <div className="flex h-screen bg-white">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden p-4">
        <div className="mb-2 flex items-center justify-between">
          <h1 className="inline-block border-b-4 border-accent-yellow pb-1 text-2xl font-bold text-dark-navy">
            Kanban Board
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((open) => !open)}
              className="rounded px-4 py-2 text-gray-text hover:bg-gray-100"
            >
              {sidebarOpen ? "Hide assistant" : "Show assistant"}
            </button>
            <button
              onClick={onLogout}
              className="rounded px-4 py-2 text-gray-text hover:bg-gray-100"
            >
              Log out
            </button>
          </div>
        </div>

        <BoardSwitcher
          boards={boards}
          activeBoardId={activeBoardId}
          username={username}
          onSelect={handleSelectBoard}
          onCreateProject={createProject}
        />

        {error && (
          <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
        )}

        {loading ? (
          <p className="text-gray-text">Loading board...</p>
        ) : (
          <DndContext
            id="kanban-board"
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-4">
              {[...columns]
                .sort((a, b) => a.order - b.order)
                .map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    cards={cardsByColumn(cards, column.id)}
                    onRename={(name) => renameColumn(column.id, name)}
                    onCardClick={setActiveCard}
                    onAddCard={() => createCard(column.id, "New card")}
                  />
                ))}
            </div>

            <DragOverlay>
              {draggingCard ? (
                <div className="cursor-grabbing rounded-md border border-gray-200 bg-white p-3 shadow-lg">
                  <KanbanCardContent card={draggingCard} />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      {sidebarOpen && (
        <ChatSidebar
          messages={chat.messages}
          loading={chat.loading}
          error={chat.error}
          onSend={chat.send}
        />
      )}

      {activeCard && (
        <CardModal
          card={activeCard}
          onSave={(updates) => updateCard(activeCard.id, updates)}
          onDelete={() => deleteCard(activeCard.id)}
          onClose={() => setActiveCard(null)}
        />
      )}
    </div>
  );
}
