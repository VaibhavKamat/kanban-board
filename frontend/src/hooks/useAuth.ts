import { useEffect, useState } from "react";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export function useAuth() {
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    fetch("/api/me", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setStatus(data.authenticated ? "authenticated" : "unauthenticated"))
      .catch(() => setStatus("unauthenticated"));
  }, []);

  async function login(username: string, password: string): Promise<string | null> {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      return "Invalid username or password";
    }

    setStatus("authenticated");
    return null;
  }

  async function signup(username: string, email: string, password: string): Promise<string | null> {
    const response = await fetch("/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, email, password }),
    });

    if (!response.ok) {
      if (response.status === 409) return "Username or email already taken";
      if (response.status === 422) return "Please check your username, email, and password (min 8 characters)";
      return "Sign up failed";
    }

    return null;
  }

  async function logout() {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    setStatus("unauthenticated");
  }

  return { status, login, signup, logout };
}
