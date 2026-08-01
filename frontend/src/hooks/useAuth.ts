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

  async function logout() {
    await fetch("/api/logout", { method: "POST", credentials: "include" });
    setStatus("unauthenticated");
  }

  return { status, login, logout };
}
