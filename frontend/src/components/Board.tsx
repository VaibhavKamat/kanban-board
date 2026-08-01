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

export function Board() {
  const { columns, cards, cardsByColumn, renameColumn, updateCard, moveCard } =
    useKanbanBoard();
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
      <h1 className="mb-6 inline-block border-b-4 border-accent-yellow pb-1 text-2xl font-bold text-dark-navy">
        Kanban Board
      </h1>

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
              />
            ))}
        </div>
      </DndContext>

      {activeCard && (
        <CardModal
          card={activeCard}
          onSave={(updates) => updateCard(activeCard.id, updates)}
          onClose={() => setActiveCard(null)}
        />
      )}
    </div>
  );
}
