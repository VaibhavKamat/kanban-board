import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import type { Card } from "@/types/kanban";

interface KanbanCardProps {
  card: Card;
  onClick: () => void;
}

export function KanbanCard({ card, onClick }: KanbanCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: card.id, data: { type: "card", columnId: card.columnId } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
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
      <p className="font-medium text-dark-navy">{card.title}</p>
      <p className="mt-1 text-sm text-gray-text line-clamp-2">{card.description}</p>
    </div>
  );
}
