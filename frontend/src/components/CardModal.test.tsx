import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CardModal } from "@/components/CardModal";
import type { Card } from "@/types/kanban";

const card: Card = {
  id: "card-1",
  columnId: "col-1",
  title: "Original title",
  description: "Original description",
  order: 0,
};

describe("CardModal", () => {
  it("saves edited title and description", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(<CardModal card={card} onSave={onSave} onClose={onClose} />);

    fireEvent.change(screen.getByDisplayValue("Original title"), {
      target: { value: "Updated title" },
    });
    fireEvent.change(screen.getByDisplayValue("Original description"), {
      target: { value: "Updated description" },
    });
    fireEvent.click(screen.getByText("Save"));

    expect(onSave).toHaveBeenCalledWith({
      title: "Updated title",
      description: "Updated description",
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("closes without saving on cancel", () => {
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(<CardModal card={card} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByText("Cancel"));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
