import { useState } from "react";

import { mockCards, mockColumns } from "@/lib/mock-data";
import type { Card, Column } from "@/types/kanban";

function cardsByColumn(cards: Card[], columnId: string): Card[] {
  return cards
    .filter((card) => card.columnId === columnId)
    .sort((a, b) => a.order - b.order);
}

export function useKanbanBoard() {
  const [columns, setColumns] = useState<Column[]>(mockColumns);
  const [cards, setCards] = useState<Card[]>(mockCards);

  function renameColumn(columnId: string, name: string) {
    setColumns((prev) =>
      prev.map((column) =>
        column.id === columnId ? { ...column, name } : column
      )
    );
  }

  function updateCard(cardId: string, updates: Pick<Card, "title" | "description">) {
    setCards((prev) =>
      prev.map((card) => (card.id === cardId ? { ...card, ...updates } : card))
    );
  }

  function moveCard(cardId: string, targetColumnId: string, targetIndex: number) {
    setCards((prev) => {
      const movingCard = prev.find((card) => card.id === cardId);
      if (!movingCard) return prev;

      const sourceColumnId = movingCard.columnId;
      const targetList = cardsByColumn(prev, targetColumnId).filter(
        (card) => card.id !== cardId
      );
      const clampedIndex = Math.max(0, Math.min(targetIndex, targetList.length));
      targetList.splice(clampedIndex, 0, { ...movingCard, columnId: targetColumnId });

      const updates = new Map<string, { columnId: string; order: number }>();
      targetList.forEach((card, index) => {
        updates.set(card.id, { columnId: targetColumnId, order: index });
      });

      if (sourceColumnId !== targetColumnId) {
        const sourceList = cardsByColumn(prev, sourceColumnId).filter(
          (card) => card.id !== cardId
        );
        sourceList.forEach((card, index) => {
          updates.set(card.id, { columnId: sourceColumnId, order: index });
        });
      }

      return prev.map((card) => {
        const update = updates.get(card.id);
        return update ? { ...card, ...update } : card;
      });
    });
  }

  return { columns, cards, cardsByColumn, renameColumn, updateCard, moveCard };
}
