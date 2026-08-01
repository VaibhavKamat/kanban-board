import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useChat } from "@/hooks/useChat";
import * as api from "@/lib/api";

vi.mock("@/lib/api");

const mockedApi = vi.mocked(api);

beforeEach(() => {
  vi.resetAllMocks();
  mockedApi.getMessages.mockResolvedValue([]);
});

describe("useChat", () => {
  it("loads existing chat history on mount", async () => {
    mockedApi.getMessages.mockResolvedValue([
      { id: "1", role: "user", content: "hi" },
      { id: "2", role: "assistant", content: "hello!" },
    ]);
    const onBoardUpdate = vi.fn();

    const { result } = renderHook(() => useChat(onBoardUpdate));

    await waitFor(() => expect(result.current.messages).toHaveLength(2));
    expect(result.current.messages[0].content).toBe("hi");
  });

  it("appends the user message immediately, then the reply, and applies the board update", async () => {
    const onBoardUpdate = vi.fn();
    const board = { columns: [], cards: [] };
    mockedApi.sendChatMessage.mockResolvedValue({ reply: "Done!", board });

    const { result } = renderHook(() => useChat(onBoardUpdate));
    // Flush the mount effect's getMessages() resolution before sending, so it
    // can't race with (and overwrite) the optimistic message below.
    await act(async () => {});

    await act(async () => {
      await result.current.send("move the card");
    });

    expect(result.current.messages.map((m) => m.content)).toEqual([
      "move the card",
      "Done!",
    ]);
    expect(onBoardUpdate).toHaveBeenCalledWith(board);
    expect(result.current.loading).toBe(false);
  });

  it("sets an error and keeps the optimistic user message if the request fails", async () => {
    const onBoardUpdate = vi.fn();
    mockedApi.sendChatMessage.mockRejectedValue(new Error("network error"));

    const { result } = renderHook(() => useChat(onBoardUpdate));
    await act(async () => {});

    await act(async () => {
      await result.current.send("hello");
    });

    expect(result.current.error).toBe("Failed to send message");
    expect(result.current.messages).toHaveLength(1);
    expect(onBoardUpdate).not.toHaveBeenCalled();
  });

  it("does not drop a message sent before history has finished loading", async () => {
    // Simulates the race: history resolves AFTER the user has already sent a
    // message. The mount effect's setMessages must merge, not overwrite.
    let resolveHistory: (history: Awaited<ReturnType<typeof api.getMessages>>) => void;
    mockedApi.getMessages.mockReturnValue(
      new Promise((resolve) => {
        resolveHistory = resolve;
      })
    );
    mockedApi.sendChatMessage.mockResolvedValue({
      reply: "Got it.",
      board: { columns: [], cards: [] },
    });
    const onBoardUpdate = vi.fn();

    const { result } = renderHook(() => useChat(onBoardUpdate));

    // Send before history has resolved at all.
    await act(async () => {
      await result.current.send("do this now");
    });
    expect(result.current.messages.map((m) => m.content)).toEqual([
      "do this now",
      "Got it.",
    ]);

    // History arrives late - it must prepend, not replace.
    await act(async () => {
      resolveHistory([{ id: "old-1", role: "user", content: "earlier question" }]);
    });

    expect(result.current.messages.map((m) => m.content)).toEqual([
      "earlier question",
      "do this now",
      "Got it.",
    ]);
  });

  it("ignores empty messages", async () => {
    const onBoardUpdate = vi.fn();
    const { result } = renderHook(() => useChat(onBoardUpdate));
    await act(async () => {});

    await act(async () => {
      await result.current.send("   ");
    });

    expect(result.current.messages).toHaveLength(0);
    expect(mockedApi.sendChatMessage).not.toHaveBeenCalled();
  });
});
