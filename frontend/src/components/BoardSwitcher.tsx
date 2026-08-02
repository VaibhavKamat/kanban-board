import { useState, type FormEvent } from "react";

import type { BoardSummary } from "@/types/kanban";

interface BoardSwitcherProps {
  boards: BoardSummary[];
  activeBoardId: string | null;
  username: string;
  onSelect: (boardId: string) => void;
  onCreateProject: (name: string) => Promise<string | null>;
}

export function BoardSwitcher({
  boards,
  activeBoardId,
  username,
  onSelect,
  onCreateProject,
}: BoardSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const personal = boards.find((b) => b.type === "personal");
  const projects = boards.filter((b) => b.type === "project");
  const active = boards.find((b) => b.id === activeBoardId);
  const activeLabel = active ? (active.type === "personal" ? username : active.name) : username;

  function select(boardId: string) {
    onSelect(boardId);
    setOpen(false);
    setCreating(false);
  }

  async function handleCreateSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = projectName.trim();
    if (!trimmed) return;

    const result = await onCreateProject(trimmed);
    if (result) {
      setError(result);
      return;
    }
    setProjectName("");
    setCreating(false);
    setError(null);
    setOpen(false);
  }

  return (
    <div className="relative mb-4 inline-block">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 rounded border border-gray-300 px-3 py-1.5 text-sm text-dark-navy hover:bg-gray-100"
      >
        {activeLabel}
        <span aria-hidden="true">▾</span>
      </button>

      {open && (
        <div className="absolute z-10 mt-1 w-56 rounded border border-gray-200 bg-white py-1 shadow-lg">
          {personal && (
            <button
              type="button"
              onClick={() => select(personal.id)}
              className="block w-full px-3 py-2 text-left text-sm text-dark-navy hover:bg-gray-100"
            >
              {username}
            </button>
          )}

          {projects.length > 0 && (
            <div className="border-t border-gray-100 px-3 py-1 text-xs uppercase text-gray-text">
              Projects
            </div>
          )}
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => select(project.id)}
              className="block w-full px-3 py-2 text-left text-sm text-dark-navy hover:bg-gray-100"
            >
              {project.name}
            </button>
          ))}

          {username === "user" && (
            <div className="border-t border-gray-100 p-2">
              {creating ? (
                <form onSubmit={handleCreateSubmit}>
                  <input
                    autoFocus
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="Project name"
                    aria-label="Project name"
                    className="mb-2 w-full rounded border border-gray-300 px-2 py-1 text-sm"
                  />
                  {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
                  <button
                    type="submit"
                    className="w-full rounded bg-purple-secondary px-2 py-1 text-sm text-white hover:opacity-90"
                  >
                    Create
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="block w-full px-1 py-1 text-left text-sm text-blue-primary hover:underline"
                >
                  + New project
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
