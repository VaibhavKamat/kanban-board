import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/LoginForm";

describe("LoginForm", () => {
  it("submits the entered username and password", async () => {
    const onLogin = vi.fn().mockResolvedValue(null);
    render(<LoginForm onLogin={onLogin} />);

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "user" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith("user", "password"));
  });

  it("shows an error message when login fails", async () => {
    const onLogin = vi.fn().mockResolvedValue("Invalid username or password");
    render(<LoginForm onLogin={onLogin} />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid username or password")).toBeInTheDocument();
  });
});
