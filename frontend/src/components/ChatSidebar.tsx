import { useState, type FormEvent } from "react";

import type { ChatMessage } from "@/lib/api";

interface ChatSidebarProps {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  onSend: (message: string) => void;
}

export function ChatSidebar({ messages, loading, error, onSend }: ChatSidebarProps) {
  const [input, setInput] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || loading) return;
    onSend(trimmed);
    setInput("");
  }

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-gray-200 bg-white">
      <h2 className="border-b border-gray-200 px-4 py-3 font-semibold text-dark-navy">
        AI Assistant
      </h2>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`mb-3 max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              message.role === "user"
                ? "ml-auto bg-blue-primary text-white"
                : "bg-gray-100 text-dark-navy"
            }`}
          >
            {message.content}
          </div>
        ))}
        {loading && <p className="text-sm text-gray-text">Thinking...</p>}
      </div>

      {error && <p className="px-4 pb-2 text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="flex gap-2 border-t border-gray-200 p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask the assistant..."
          aria-label="Chat message"
          className="min-w-0 flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-purple-secondary px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </aside>
  );
}
