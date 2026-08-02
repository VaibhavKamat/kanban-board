import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "@/components/App";

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response);
}

describe("App", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows the login form, then the board after a successful login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/me") return jsonResponse({ authenticated: false, username: null });
        if (url === "/api/login") return jsonResponse({ username: "user" });
        if (url === "/api/boards")
          return jsonResponse({ boards: [{ id: "1", type: "personal", name: null }] });
        if (url.startsWith("/api/board")) return jsonResponse({ columns: [], cards: [] });
        if (url.startsWith("/api/messages")) return jsonResponse({ messages: [] });
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "user" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Kanban Board")).toBeInTheDocument();
  });

  it("returns to the sign in form after a successful sign up, then logs in from there", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/me") return jsonResponse({ authenticated: false, username: null });
        if (url === "/api/signup") return jsonResponse({ username: "alice" });
        if (url === "/api/login") return jsonResponse({ username: "alice" });
        if (url === "/api/boards")
          return jsonResponse({ boards: [{ id: "1", type: "personal", name: null }] });
        if (url.startsWith("/api/board")) return jsonResponse({ columns: [], cards: [] });
        if (url.startsWith("/api/messages")) return jsonResponse({ messages: [] });
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    render(<App />);

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Don't have an account? Sign up"));

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correcthorse" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Account created. Please sign in.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correcthorse" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Kanban Board")).toBeInTheDocument();
  });

  it("returns to the login form after logout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/me") return jsonResponse({ authenticated: true, username: "user" });
        if (url === "/api/logout") return jsonResponse({ ok: true });
        if (url === "/api/boards")
          return jsonResponse({ boards: [{ id: "1", type: "personal", name: null }] });
        if (url.startsWith("/api/board")) return jsonResponse({ columns: [], cards: [] });
        if (url.startsWith("/api/messages")) return jsonResponse({ messages: [] });
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    render(<App />);

    expect(await screen.findByText("Kanban Board")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Log out"));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("switches to a project board and shows its own cards", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/me") return jsonResponse({ authenticated: true, username: "user" });
        if (url === "/api/boards")
          return jsonResponse({
            boards: [
              { id: "1", type: "personal", name: null },
              { id: "2", type: "project", name: "project1" },
            ],
          });
        if (url === "/api/board?board_id=2")
          return jsonResponse({
            columns: [{ id: "col", key: "backlog", name: "Backlog", order: 0 }],
            cards: [
              { id: "c2", columnId: "col", title: "Project card", description: "", order: 0 },
            ],
          });
        if (url.startsWith("/api/board"))
          return jsonResponse({
            columns: [{ id: "col", key: "backlog", name: "Backlog", order: 0 }],
            cards: [
              { id: "c1", columnId: "col", title: "Personal card", description: "", order: 0 },
            ],
          });
        if (url.startsWith("/api/messages")) return jsonResponse({ messages: [] });
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    render(<App />);

    expect(await screen.findByText("Personal card")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /user/ }));
    fireEvent.click(screen.getByText("project1"));

    expect(await screen.findByText("Project card")).toBeInTheDocument();
    expect(screen.queryByText("Personal card")).not.toBeInTheDocument();
  });
});
