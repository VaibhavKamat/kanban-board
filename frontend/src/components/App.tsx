"use client";

import { Board } from "@/components/Board";
import { LoginForm } from "@/components/LoginForm";
import { useAuth } from "@/hooks/useAuth";

export function App() {
  const { status, login, signup, logout } = useAuth();

  if (status === "loading") return null;
  if (status === "unauthenticated") return <LoginForm onLogin={login} onSignup={signup} />;
  return <Board onLogout={logout} />;
}
