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
  onAddCard: () => void;
}

export function KanbanColumn({
  column,
  cards,
  onRename,
  onCardClick,
  onAddCard,
}: KanbanColumnProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(column.name);

  // Prefixed so this never collides with a card's dnd-kit id - both are raw
  // DB primary keys from separate sequences, so a card and a column can
  // easily share the same numeric id (e.g. card "1" and column "1"), which
  // silently confuses dnd-kit's single id-keyed droppable registry.
  const { setNodeRef } = useDroppable({
    id: `column-${column.id}`,
    data: { type: "column", columnId: column.id },
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
    <div className="flex min-w-[150px] flex-1 flex-col rounded-lg border-t-4 border-accent-yellow bg-gray-100 p-3">
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

      <div ref={setNodeRef} className="flex min-h-[4rem] flex-1 flex-col gap-2 overflow-y-auto">
        <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          {cards.map((card) => (
            <KanbanCard key={card.id} card={card} onClick={() => onCardClick(card)} />
          ))}
        </SortableContext>
      </div>

      <button
        onClick={onAddCard}
        className="mt-2 rounded px-2 py-1 text-left text-sm text-gray-text hover:bg-gray-200"
      >
        + Add card
      </button>
    </div>
  );
}
