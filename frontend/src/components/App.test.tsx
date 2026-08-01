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

  it("returns to the login form after logout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        if (url === "/api/me") return jsonResponse({ authenticated: true, username: "user" });
        if (url === "/api/logout") return jsonResponse({ ok: true });
        throw new Error(`Unexpected fetch: ${url}`);
      })
    );

    render(<App />);

    expect(await screen.findByText("Kanban Board")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Log out"));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });
});
