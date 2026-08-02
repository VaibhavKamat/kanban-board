import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BoardSwitcher } from "@/components/BoardSwitcher";
import type { BoardSummary } from "@/types/kanban";

const boards: BoardSummary[] = [
  { id: "1", type: "personal", name: null },
  { id: "2", type: "project", name: "project1" },
];

describe("BoardSwitcher", () => {
  it("shows the username as the trigger label for the personal board", () => {
    render(
      <BoardSwitcher
        boards={boards}
        activeBoardId="1"
        username="alice"
        onSelect={vi.fn()}
        onCreateProject={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /alice/ })).toBeInTheDocument();
  });

  it("shows the project name as the trigger label when a project is active", () => {
    render(
      <BoardSwitcher
        boards={boards}
        activeBoardId="2"
        username="alice"
        onSelect={vi.fn()}
        onCreateProject={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /project1/ })).toBeInTheDocument();
  });

  it("lists the username and every project in the menu, and selects on click", () => {
    const onSelect = vi.fn();
    render(
      <BoardSwitcher
        boards={boards}
        activeBoardId="1"
        username="alice"
        onSelect={onSelect}
        onCreateProject={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /alice/ }));
    expect(screen.getByText("project1")).toBeInTheDocument();

    fireEvent.click(screen.getByText("project1"));
    expect(onSelect).toHaveBeenCalledWith("2");
  });

  it("hides the new project control for non-'user' accounts", () => {
    render(
      <BoardSwitcher
        boards={boards}
        activeBoardId="1"
        username="alice"
        onSelect={vi.fn()}
        onCreateProject={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /alice/ }));
    expect(screen.queryByText("+ New project")).not.toBeInTheDocument();
  });

  it("shows the new project control for the 'user' account and creates a project", async () => {
    const onCreateProject = vi.fn().mockResolvedValue(null);
    render(
      <BoardSwitcher
        boards={boards}
        activeBoardId="1"
        username="user"
        onSelect={vi.fn()}
        onCreateProject={onCreateProject}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /user/ }));
    fireEvent.click(screen.getByText("+ New project"));

    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "project2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onCreateProject).toHaveBeenCalledWith("project2"));
  });

  it("shows an error if project creation fails", async () => {
    const onCreateProject = vi.fn().mockResolvedValue("A project with that name already exists");
    render(
      <BoardSwitcher
        boards={boards}
        activeBoardId="1"
        username="user"
        onSelect={vi.fn()}
        onCreateProject={onCreateProject}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /user/ }));
    fireEvent.click(screen.getByText("+ New project"));
    fireEvent.change(screen.getByLabelText("Project name"), {
      target: { value: "project1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByText("A project with that name already exists")).toBeInTheDocument();
  });
});
