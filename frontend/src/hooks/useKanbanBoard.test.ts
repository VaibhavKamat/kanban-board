import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useKanbanBoard } from "@/hooks/useKanbanBoard";
import * as api from "@/lib/api";

vi.mock("@/lib/api");

const mockedApi = vi.mocked(api);

const initialBoard: api.Board = {
  columns: [{ id: "col-1", key: "todo", name: "To Do", order: 0 }],
  cards: [{ id: "card-1", columnId: "col-1", title: "First", description: "d", order: 0 }],
};

beforeEach(() => {
  vi.resetAllMocks();
  mockedApi.getBoard.mockResolvedValue(initialBoard);
});

describe("useKanbanBoard", () => {
  it("loads the board on mount", async () => {
    const { result } = renderHook(() => useKanbanBoard());
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.columns).toEqual(initialBoard.columns);
    expect(result.current.cards).toEqual(initialBoard.cards);
  });

  it("sets an error if the initial load fails", async () => {
    mockedApi.getBoard.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useKanbanBoard());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to load board");
  });

  it("renames a column optimistically then applies the server response", async () => {
    const { result } = renderHook(() => useKanbanBoard());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockedApi.renameColumn.mockResolvedValue({
      columns: [{ id: "col-1", key: "todo", name: "Icebox", order: 0 }],
      cards: initialBoard.cards,
    });

    await act(async () => {
      await result.current.renameColumn("col-1", "Icebox");
    });

    expect(mockedApi.renameColumn).toHaveBeenCalledWith("col-1", "Icebox");
    expect(result.current.columns[0].name).toBe("Icebox");
  });

  it("rolls back a column rename if the request fails", async () => {
    const { result } = renderHook(() => useKanbanBoard());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockedApi.renameColumn.mockRejectedValue(new Error("failed"));

    await act(async () => {
      await result.current.renameColumn("col-1", "Icebox");
    });

    expect(result.current.columns[0].name).toBe("To Do");
    expect(result.current.error).toBe("Failed to rename column");
  });

  it("rolls back a card move if the request fails", async () => {
    const { result } = renderHook(() => useKanbanBoard());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockedApi.updateCard.mockRejectedValue(new Error("failed"));

    await act(async () => {
      await result.current.moveCard("card-1", "col-1", 0);
    });

    expect(result.current.cards).toEqual(initialBoard.cards);
    expect(result.current.error).toBe("Failed to move card");
  });

  it("creates a card and applies the returned board", async () => {
    const { result } = renderHook(() => useKanbanBoard());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockedApi.createCard.mockResolvedValue({
      columns: initialBoard.columns,
      cards: [
        ...initialBoard.cards,
        { id: "card-2", columnId: "col-1", title: "New card", description: "", order: 1 },
      ],
    });

    await act(async () => {
      await result.current.createCard("col-1", "New card");
    });

    expect(result.current.cards).toHaveLength(2);
  });

  it("deletes a card optimistically then confirms with the server response", async () => {
    const { result } = renderHook(() => useKanbanBoard());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockedApi.deleteCard.mockResolvedValue({ columns: initialBoard.columns, cards: [] });

    await act(async () => {
      await result.current.deleteCard("card-1");
    });

    expect(result.current.cards).toEqual([]);
  });

  it("refetches when boardId changes", async () => {
    const { result, rerender } = renderHook(({ boardId }) => useKanbanBoard(boardId), {
      initialProps: { boardId: "board-1" as string | null },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockedApi.getBoard).toHaveBeenCalledWith("board-1");

    const otherBoard: api.Board = {
      columns: [{ id: "col-2", key: "todo", name: "To Do", order: 0 }],
      cards: [],
    };
    mockedApi.getBoard.mockResolvedValue(otherBoard);

    rerender({ boardId: "board-2" });

    await waitFor(() => expect(result.current.columns).toEqual(otherBoard.columns));
    expect(mockedApi.getBoard).toHaveBeenCalledWith("board-2");
  });
});
