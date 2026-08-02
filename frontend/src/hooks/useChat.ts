import { useEffect, useState } from "react";

import * as api from "@/lib/api";
import type { Board, ChatMessage } from "@/lib/api";

export function useChat(boardId: string | null | undefined, onBoardUpdate: (board: Board) => void) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Switching boards means switching chat histories entirely - clear first,
    // then load the newly selected board's history.
    setMessages([]);
    setError(null);
    api
      .getMessages(boardId)
      // Merge (not overwrite): if the user sends a message before this
      // resolves, `prev` already holds that optimistic message - history is
      // always older, so prepending it keeps chronological order without
      // dropping anything sent during the race.
      .then((history) => setMessages((prev) => [...history, ...prev]))
      .catch(() => setError("Failed to load chat history"));
  }, [boardId]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: trimmed },
    ]);
    setLoading(true);
    setError(null);

    try {
      const { reply, board } = await api.sendChatMessage(trimmed, boardId);
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: "assistant", content: reply },
      ]);
      onBoardUpdate(board);
    } catch {
      setError("Failed to send message");
    } finally {
      setLoading(false);
    }
  }

  return { messages, loading, error, send };
}
