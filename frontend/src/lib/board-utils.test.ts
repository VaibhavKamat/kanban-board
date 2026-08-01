import { describe, expect, it } from "vitest";

import {
  cardsByColumn,
  moveCardLocally,
  removeCardLocally,
  renameColumnLocally,
  updateCardLocally,
} from "@/lib/board-utils";
import type { Card, Column } from "@/types/kanban";

const columns: Column[] = [
  { id: "col-1", key: "todo", name: "To Do", order: 0 },
  { id: "col-2", key: "done", name: "Done", order: 1 },
];

const cards: Card[] = [
  { id: "card-1", columnId: "col-1", title: "First", description: "", order: 0 },
  { id: "card-2", columnId: "col-1", title: "Second", description: "", order: 1 },
  { id: "card-3", columnId: "col-2", title: "Third", description: "", order: 0 },
];

describe("cardsByColumn", () => {
  it("returns only the cards for the given column, ordered", () => {
    expect(cardsByColumn(cards, "col-1").map((c) => c.id)).toEqual(["card-1", "card-2"]);
  });
});

describe("renameColumnLocally", () => {
  it("renames the matching column and leaves others untouched", () => {
    const result = renameColumnLocally(columns, "col-1", "Icebox");
    expect(result.find((c) => c.id === "col-1")?.name).toBe("Icebox");
    expect(result.find((c) => c.id === "col-2")?.name).toBe("Done");
  });
});

describe("updateCardLocally", () => {
  it("updates title and description of the matching card", () => {
    const result = updateCardLocally(cards, "card-1", {
      title: "New title",
      description: "New description",
    });
    const card = result.find((c) => c.id === "card-1");
    expect(card?.title).toBe("New title");
    expect(card?.description).toBe("New description");
  });
});

describe("removeCardLocally", () => {
  it("removes the matching card and leaves the rest", () => {
    const result = removeCardLocally(cards, "card-1");
    expect(result.map((c) => c.id)).toEqual(["card-2", "card-3"]);
  });
});

describe("moveCardLocally", () => {
  it("reorders a card within the same column", () => {
    const result = moveCardLocally(cards, "card-1", "col-1", 1);
    expect(cardsByColumn(result, "col-1").map((c) => c.id)).toEqual(["card-2", "card-1"]);
  });

  it("moves a card to a different column and resequences both columns", () => {
    const result = moveCardLocally(cards, "card-1", "col-2", 0);

    const movedCard = result.find((c) => c.id === "card-1");
    expect(movedCard?.columnId).toBe("col-2");
    expect(movedCard?.order).toBe(0);

    expect(cardsByColumn(result, "col-2").map((c) => c.id)).toEqual(["card-1", "card-3"]);
    expect(cardsByColumn(result, "col-1").map((c) => c.order)).toEqual([0]);
  });
});
