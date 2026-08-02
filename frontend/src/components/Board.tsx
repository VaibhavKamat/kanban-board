"use client";

import { useEffect, useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import { BoardSwitcher } from "@/components/BoardSwitcher";
import { CardModal } from "@/components/CardModal";
import { ChatSidebar } from "@/components/ChatSidebar";
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
    createCard,
    deleteCard,
    applyBoard,
  } = useKanbanBoard(activeBoardId);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chat = useChat(activeBoardId, applyBoard);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleSelectBoard(boardId: string) {
    setActiveBoardId(boardId);
    setActiveCard(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const overData = over.data.current as
      | { type: "column" }
      | { type: "card"; columnId: string }
      | undefined;

    let targetColumnId: string;
    let targetIndex: number;

    if (overData?.type === "column") {
      targetColumnId = over.id as string;
      targetIndex = cardsByColumn(cards, targetColumnId).length;
    } else if (overData?.type === "card") {
      targetColumnId = overData.columnId;
      const list = cardsByColumn(cards, targetColumnId);
      const index = list.findIndex((card) => card.id === over.id);
      targetIndex = index === -1 ? list.length : index;
    } else {
      return;
    }

    moveCard(active.id as string, targetColumnId, targetIndex);
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
            onDragEnd={handleDragEnd}
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
