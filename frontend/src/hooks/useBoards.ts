import { useEffect, useState } from "react";

import * as api from "@/lib/api";
import type { BoardSummary } from "@/types/kanban";

export function useBoards() {
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function refresh() {
    return api
      .listBoards()
      .then(setBoards)
      .catch(() => setError("Failed to load boards"));
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function createProject(name: string): Promise<string | null> {
    try {
      const created = await api.createProject(name);
      setBoards((prev) => [...prev, created]);
      return null;
    } catch {
      return "Failed to create project (name may already be taken)";
    }
  }

  return { boards, loading, error, createProject, refresh };
}
