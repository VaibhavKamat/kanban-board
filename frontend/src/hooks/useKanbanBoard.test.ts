import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useKanbanBoard } from "@/hooks/useKanbanBoard";

describe("useKanbanBoard", () => {
  it("renames a column", () => {
    const { result } = renderHook(() => useKanbanBoard());

    act(() => {
      result.current.renameColumn("col-1", "Icebox");
    });

    expect(result.current.columns.find((c) => c.id === "col-1")?.name).toBe(
      "Icebox"
    );
  });

  it("updates a card's title and description", () => {
    const { result } = renderHook(() => useKanbanBoard());

    act(() => {
      result.current.updateCard("card-1", {
        title: "New title",
        description: "New description",
      });
    });

    const card = result.current.cards.find((c) => c.id === "card-1");
    expect(card?.title).toBe("New title");
    expect(card?.description).toBe("New description");
  });

  it("reorders a card within the same column", () => {
    const { result } = renderHook(() => useKanbanBoard());

    // card-1 and card-2 both start in col-1, card-1 at order 0, card-2 at order 1
    act(() => {
      result.current.moveCard("card-1", "col-1", 1);
    });

    const col1Cards = result.current
      .cardsByColumn(result.current.cards, "col-1")
      .map((c) => c.id);
    expect(col1Cards).toEqual(["card-2", "card-1"]);
  });

  it("moves a card to a different column", () => {
    const { result } = renderHook(() => useKanbanBoard());

    act(() => {
      result.current.moveCard("card-1", "col-2", 0);
    });

    const movedCard = result.current.cards.find((c) => c.id === "card-1");
    expect(movedCard?.columnId).toBe("col-2");
    expect(movedCard?.order).toBe(0);

    // card that was previously at order 0 in col-2 should now be order 1
    const col2Cards = result.current.cardsByColumn(result.current.cards, "col-2");
    expect(col2Cards.map((c) => c.id)).toEqual(["card-1", "card-3"]);

    // the source column should have its remaining card resequenced from 0
    const col1Cards = result.current.cardsByColumn(result.current.cards, "col-1");
    expect(col1Cards.map((c) => c.order)).toEqual([0]);
  });
});
