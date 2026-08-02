import { useEffect, useState } from "react";

import * as api from "@/lib/api";
import {
  cardsByColumn,
  moveCardLocally,
  removeCardLocally,
  renameColumnLocally,
  updateCardLocally,
} from "@/lib/board-utils";
import type { Card, Column } from "@/types/kanban";

export function useKanbanBoard(boardId?: string | null) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getBoard(boardId)
      .then((board) => {
        setColumns(board.columns);
        setCards(board.cards);
        setError(null);
      })
      .catch(() => setError("Failed to load board"))
      .finally(() => setLoading(false));
  }, [boardId]);

  function applyBoard(board: api.Board) {
    setColumns(board.columns);
    setCards(board.cards);
    setError(null);
  }

  async function renameColumn(columnId: string, name: string) {
    const previous = columns;
    setColumns(renameColumnLocally(columns, columnId, name));
    try {
      applyBoard(await api.renameColumn(columnId, name));
    } catch {
      setColumns(previous);
      setError("Failed to rename column");
    }
  }

  async function updateCard(cardId: string, updates: Pick<Card, "title" | "description">) {
    const previous = cards;
    setCards(updateCardLocally(cards, cardId, updates));
    try {
      applyBoard(await api.updateCard(cardId, updates));
    } catch {
      setCards(previous);
      setError("Failed to update card");
    }
  }

  async function moveCard(cardId: string, targetColumnId: string, targetIndex: number) {
    const previous = cards;
    setCards(moveCardLocally(cards, cardId, targetColumnId, targetIndex));
    try {
      applyBoard(
        await api.updateCard(cardId, { columnId: targetColumnId, order: targetIndex })
      );
    } catch {
      setCards(previous);
      setError("Failed to move card");
    }
  }

  async function createCard(columnId: string, title: string) {
    try {
      applyBoard(await api.createCard(columnId, title));
    } catch {
      setError("Failed to create card");
    }
  }

  async function deleteCard(cardId: string) {
    const previous = cards;
    setCards(removeCardLocally(cards, cardId));
    try {
      applyBoard(await api.deleteCard(cardId));
    } catch {
      setCards(previous);
      setError("Failed to delete card");
    }
  }

  return {
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
  };
}
