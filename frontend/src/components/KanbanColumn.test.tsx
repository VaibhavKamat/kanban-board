import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KanbanColumn } from "@/components/KanbanColumn";
import type { Column } from "@/types/kanban";

const column: Column = { id: "col-1", key: "backlog", name: "Backlog", order: 0 };

describe("KanbanColumn", () => {
  it("renders card titles", () => {
    render(
      <KanbanColumn
        column={column}
        cards={[
          {
            id: "card-1",
            columnId: "col-1",
            title: "Task one",
            description: "",
            dueDate: null,
            order: 0,
          },
        ]}
        onRename={vi.fn()}
        onCardClick={vi.fn()}
        onCardDueDateChange={vi.fn()}
        onAddCard={vi.fn()}
      />
    );

    expect(screen.getByText("Task one")).toBeInTheDocument();
  });

  it("commits a rename on Enter", () => {
    const onRename = vi.fn();
    render(
      <KanbanColumn
        column={column}
        cards={[]}
        onRename={onRename}
        onCardClick={vi.fn()}
        onCardDueDateChange={vi.fn()}
        onAddCard={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Backlog"));
    const input = screen.getByDisplayValue("Backlog");
    fireEvent.change(input, { target: { value: "Icebox" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onRename).toHaveBeenCalledWith("Icebox");
  });

  it("does not rename to an empty name", () => {
    const onRename = vi.fn();
    render(
      <KanbanColumn
        column={column}
        cards={[]}
        onRename={onRename}
        onCardClick={vi.fn()}
        onCardDueDateChange={vi.fn()}
        onAddCard={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("Backlog"));
    const input = screen.getByDisplayValue("Backlog");
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);

    expect(onRename).not.toHaveBeenCalled();
  });
});
