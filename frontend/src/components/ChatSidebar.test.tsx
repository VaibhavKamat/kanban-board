import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ChatSidebar } from "@/components/ChatSidebar";
import type { ChatMessage } from "@/lib/api";

const messages: ChatMessage[] = [
  { id: "1", role: "user", content: "Move the card to Done" },
  { id: "2", role: "assistant", content: "Moved it to Done." },
];

describe("ChatSidebar", () => {
  it("renders existing messages", () => {
    render(<ChatSidebar messages={messages} loading={false} error={null} onSend={vi.fn()} />);

    expect(screen.getByText("Move the card to Done")).toBeInTheDocument();
    expect(screen.getByText("Moved it to Done.")).toBeInTheDocument();
  });

  it("sends the typed message and clears the input", () => {
    const onSend = vi.fn();
    render(<ChatSidebar messages={[]} loading={false} error={null} onSend={onSend} />);

    const input = screen.getByLabelText("Chat message");
    fireEvent.change(input, { target: { value: "hello there" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).toHaveBeenCalledWith("hello there");
    expect(input).toHaveValue("");
  });

  it("does not send an empty or whitespace-only message", () => {
    const onSend = vi.fn();
    render(<ChatSidebar messages={[]} loading={false} error={null} onSend={onSend} />);

    fireEvent.change(screen.getByLabelText("Chat message"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSend).not.toHaveBeenCalled();
  });

  it("shows a loading indicator while waiting for a reply", () => {
    render(<ChatSidebar messages={[]} loading={true} error={null} onSend={vi.fn()} />);
    expect(screen.getByText("Thinking...")).toBeInTheDocument();
  });

  it("shows an inline error message", () => {
    render(
      <ChatSidebar messages={[]} loading={false} error="Failed to send message" onSend={vi.fn()} />
    );
    expect(screen.getByText("Failed to send message")).toBeInTheDocument();
  });
});
