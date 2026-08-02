import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LoginForm } from "@/components/LoginForm";

describe("LoginForm", () => {
  it("submits the entered username and password", async () => {
    const onLogin = vi.fn().mockResolvedValue(null);
    const onSignup = vi.fn();
    render(<LoginForm onLogin={onLogin} onSignup={onSignup} />);

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "user" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "password" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(onLogin).toHaveBeenCalledWith("user", "password"));
  });

  it("shows an error message when login fails", async () => {
    const onLogin = vi.fn().mockResolvedValue("Invalid username or password");
    const onSignup = vi.fn();
    render(<LoginForm onLogin={onLogin} onSignup={onSignup} />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid username or password")).toBeInTheDocument();
  });

  it("switches to sign up mode and shows an email field", () => {
    const onLogin = vi.fn();
    const onSignup = vi.fn();
    render(<LoginForm onLogin={onLogin} onSignup={onSignup} />);

    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Don't have an account? Sign up"));

    expect(screen.getByRole("heading", { name: "Sign up" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("submits username, email, and password in sign up mode", async () => {
    const onLogin = vi.fn();
    const onSignup = vi.fn().mockResolvedValue(null);
    render(<LoginForm onLogin={onLogin} onSignup={onSignup} />);

    fireEvent.click(screen.getByText("Don't have an account? Sign up"));

    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correcthorse" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() =>
      expect(onSignup).toHaveBeenCalledWith("alice", "alice@example.com", "correcthorse")
    );
  });

  it("returns to sign in mode with a confirmation after a successful sign up", async () => {
    const onLogin = vi.fn();
    const onSignup = vi.fn().mockResolvedValue(null);
    render(<LoginForm onLogin={onLogin} onSignup={onSignup} />);

    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    fireEvent.change(screen.getByLabelText("Username"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "alice@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correcthorse" } });
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Account created. Please sign in.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
  });

  it("shows an error message when sign up fails", async () => {
    const onLogin = vi.fn();
    const onSignup = vi.fn().mockResolvedValue("Username or email already taken");
    render(<LoginForm onLogin={onLogin} onSignup={onSignup} />);

    fireEvent.click(screen.getByText("Don't have an account? Sign up"));
    fireEvent.click(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByText("Username or email already taken")).toBeInTheDocument();
  });
});
