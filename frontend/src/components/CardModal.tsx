import { useState } from "react";

import type { Card } from "@/types/kanban";

interface CardModalProps {
  card: Card;
  onSave: (updates: { title: string; description: string; dueDate: string }) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function CardModal({ card, onSave, onDelete, onClose }: CardModalProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [dueDate, setDueDate] = useState(card.dueDate ?? "");

  function handleSave() {
    onSave({ title: title.trim() || card.title, description, dueDate });
    onClose();
  }

  function handleDelete() {
    onDelete();
    onClose();
  }

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h3 className="mb-4 text-lg font-semibold text-dark-navy">Edit card</h3>

        <label className="mb-1 block text-sm text-gray-text">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2"
        />

        <label className="mb-1 block text-sm text-gray-text">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2"
        />

        <label className="mb-1 block text-sm text-gray-text">Due date</label>
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Due date"
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2"
        />

        <div className="flex items-center justify-between">
          <button
            onClick={handleDelete}
            className="rounded px-4 py-2 text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded px-4 py-2 text-gray-text hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="rounded bg-purple-secondary px-4 py-2 text-white hover:opacity-90"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
