import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";

import { KanbanCard } from "@/components/KanbanCard";
import type { Card, Column } from "@/types/kanban";

interface KanbanColumnProps {
  column: Column;
  cards: Card[];
  onRename: (name: string) => void;
  onCardClick: (card: Card) => void;
}

export function KanbanColumn({ column, cards, onRename, onCardClick }: KanbanColumnProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(column.name);

  const { setNodeRef } = useDroppable({
    id: column.id,
    data: { type: "column" },
  });

  function commitRename() {
    const trimmed = draftName.trim();
    if (trimmed) {
      onRename(trimmed);
    } else {
      setDraftName(column.name);
    }
    setIsEditing(false);
  }

  return (
    <div className="flex w-72 shrink-0 flex-col rounded-lg border-t-4 border-accent-yellow bg-gray-100 p-3">
      {isEditing ? (
        <input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") {
              setDraftName(column.name);
              setIsEditing(false);
            }
          }}
          className="mb-3 rounded border border-blue-primary px-2 py-1 font-semibold text-dark-navy"
        />
      ) : (
        <h2
          onClick={() => setIsEditing(true)}
          className="mb-3 cursor-text px-2 py-1 font-semibold text-dark-navy"
        >
          {column.name}
        </h2>
      )}

      <div ref={setNodeRef} className="flex min-h-[4rem] flex-col gap-2">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard key={card.id} card={card} onClick={() => onCardClick(card)} />
          ))}
        </SortableContext>
      </div>
    </div>
  );
}
