import type { Card, Column } from "@/types/kanban";

export interface Board {
  columns: Column[];
  cards: Card[];
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}`);
  }

  return response.json();
}

export function getBoard(): Promise<Board> {
  return request<Board>("/api/board");
}

export function renameColumn(columnId: string, name: string): Promise<Board> {
  return request<Board>(`/api/columns/${columnId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export function createCard(
  columnId: string,
  title: string,
  description = ""
): Promise<Board> {
  return request<Board>("/api/cards", {
    method: "POST",
    body: JSON.stringify({ column_id: columnId, title, description }),
  });
}

export interface CardUpdate {
  title?: string;
  description?: string;
  columnId?: string;
  order?: number;
}

export function updateCard(cardId: string, updates: CardUpdate): Promise<Board> {
  return request<Board>(`/api/cards/${cardId}`, {
    method: "PATCH",
    body: JSON.stringify({
      title: updates.title,
      description: updates.description,
      column_id: updates.columnId,
      order: updates.order,
    }),
  });
}

export function deleteCard(cardId: string): Promise<Board> {
  return request<Board>(`/api/cards/${cardId}`, { method: "DELETE" });
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function getMessages(): Promise<ChatMessage[]> {
  return request<{ messages: ChatMessage[] }>("/api/messages").then((r) => r.messages);
}

export interface ChatResult {
  reply: string;
  board: Board;
}

export function sendChatMessage(message: string): Promise<ChatResult> {
  return request<ChatResult>("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message }),
  });
}
