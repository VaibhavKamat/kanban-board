import type { Card, Column } from "@/types/kanban";

export function cardsByColumn(cards: Card[], columnId: string): Card[] {
  return cards
    .filter((card) => card.columnId === columnId)
    .sort((a, b) => a.order - b.order);
}

export function renameColumnLocally(
  columns: Column[],
  columnId: string,
  name: string
): Column[] {
  return columns.map((column) =>
    column.id === columnId ? { ...column, name } : column
  );
}

export function updateCardLocally(
  cards: Card[],
  cardId: string,
  updates: Pick<Card, "title" | "description">
): Card[] {
  return cards.map((card) => (card.id === cardId ? { ...card, ...updates } : card));
}

export function removeCardLocally(cards: Card[], cardId: string): Card[] {
  return cards.filter((card) => card.id !== cardId);
}

export function moveCardLocally(
  cards: Card[],
  cardId: string,
  targetColumnId: string,
  targetIndex: number
): Card[] {
  const movingCard = cards.find((card) => card.id === cardId);
  if (!movingCard) return cards;

  const sourceColumnId = movingCard.columnId;
  const targetList = cardsByColumn(cards, targetColumnId).filter(
    (card) => card.id !== cardId
  );
  const clampedIndex = Math.max(0, Math.min(targetIndex, targetList.length));
  targetList.splice(clampedIndex, 0, { ...movingCard, columnId: targetColumnId });

  const updates = new Map<string, { columnId: string; order: number }>();
  targetList.forEach((card, index) => {
    updates.set(card.id, { columnId: targetColumnId, order: index });
  });

  if (sourceColumnId !== targetColumnId) {
    const sourceList = cardsByColumn(cards, sourceColumnId).filter(
      (card) => card.id !== cardId
    );
    sourceList.forEach((card, index) => {
      updates.set(card.id, { columnId: sourceColumnId, order: index });
    });
  }

  return cards.map((card) => {
    const update = updates.get(card.id);
    return update ? { ...card, ...update } : card;
  });
}
