"use client";

import { useState } from "react";
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import { CardModal } from "@/components/CardModal";
import { KanbanColumn } from "@/components/KanbanColumn";
import { useKanbanBoard } from "@/hooks/useKanbanBoard";
import type { Card } from "@/types/kanban";

interface BoardProps {
  onLogout: () => void;
}

export function Board({ onLogout }: BoardProps) {
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
  } = useKanbanBoard();
  const [activeCard, setActiveCard] = useState<Card | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

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
    <div className="min-h-screen bg-white p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="inline-block border-b-4 border-accent-yellow pb-1 text-2xl font-bold text-dark-navy">
          Kanban Board
        </h1>
        <button
          onClick={onLogout}
          className="rounded px-4 py-2 text-gray-text hover:bg-gray-100"
        >
          Log out
        </button>
      </div>

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
          <div className="flex gap-4 overflow-x-auto pb-4">
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
