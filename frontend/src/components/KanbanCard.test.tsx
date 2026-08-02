import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { KanbanCard } from "@/components/KanbanCard";
import type { Card } from "@/types/kanban";

const card: Card = {
  id: "card-1",
  columnId: "col-1",
  title: "Task one",
  description: "Some details",
  dueDate: null,
  order: 0,
};

describe("KanbanCard", () => {
  it("renders an empty due date field when the card has none", () => {
    render(<KanbanCard card={card} onClick={vi.fn()} onDueDateChange={vi.fn()} />);
    expect(screen.getByLabelText("Due date")).toHaveValue("");
  });

  it("pre-fills the due date field from the card", () => {
    render(
      <KanbanCard
        card={{ ...card, dueDate: "2026-05-01" }}
        onClick={vi.fn()}
        onDueDateChange={vi.fn()}
      />
    );
    expect(screen.getByLabelText("Due date")).toHaveValue("2026-05-01");
  });

  it("calls onDueDateChange when a date is picked, without opening the card", () => {
    const onClick = vi.fn();
    const onDueDateChange = vi.fn();
    render(<KanbanCard card={card} onClick={onClick} onDueDateChange={onDueDateChange} />);

    fireEvent.change(screen.getByLabelText("Due date"), {
      target: { value: "2026-06-15" },
    });

    expect(onDueDateChange).toHaveBeenCalledWith("2026-06-15");
    expect(onClick).not.toHaveBeenCalled();
  });

  it("opens the card when clicking elsewhere on it", () => {
    const onClick = vi.fn();
    render(<KanbanCard card={card} onClick={onClick} onDueDateChange={vi.fn()} />);

    fireEvent.click(screen.getByText("Task one"));

    expect(onClick).toHaveBeenCalled();
  });
});
