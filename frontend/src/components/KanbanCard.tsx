import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Card } from "@/types/kanban";

interface KanbanCardProps {
  card: Card;
  onClick: () => void;
  onDueDateChange: (dueDate: string) => void;
}

export function KanbanCardContent({ card }: { card: Card }) {
  return (
    <>
      <p className="font-medium text-dark-navy">{card.title}</p>
      <p className="mt-1 text-sm text-gray-text line-clamp-2">{card.description}</p>
    </>
  );
}

export function KanbanCard({ card, onClick, onDueDateChange }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: "card", columnId: card.columnId } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    // Fully hidden while dragging - the DragOverlay renders the visible,
    // cursor-following copy instead, so there's no duplicate/ghost card.
    opacity: isDragging ? 0 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="cursor-pointer rounded-md border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md"
    >
      <KanbanCardContent card={card} />
      <input
        type="date"
        value={card.dueDate ?? ""}
        onChange={(e) => onDueDateChange(e.target.value)}
        // Stop this from also opening the card modal (onClick) or being
        // mistaken for the start of a drag (dnd-kit's pointer listeners are
        // spread on the outer div and would otherwise pick up this click).
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label="Due date"
        className="mt-2 w-full rounded border border-gray-200 px-1.5 py-1 text-xs text-gray-text"
      />
    </div>
  );
}
