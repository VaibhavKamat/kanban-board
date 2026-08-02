import { useState, type FormEvent } from "react";

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<string | null>;
  onSignup: (username: string, email: string, password: string) => Promise<string | null>;
}

export function LoginForm({ onLogin, onSignup }: LoginFormProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function toggleMode() {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setNotice(null);

    if (mode === "signin") {
      const result = await onLogin(username, password);
      setSubmitting(false);
      if (result) setError(result);
      return;
    }

    const result = await onSignup(username, email, password);
    setSubmitting(false);
    if (result) {
      setError(result);
      return;
    }

    setEmail("");
    setPassword("");
    setMode("signin");
    setNotice("Account created. Please sign in.");
  }

  const isSignup = mode === "signup";

  return (
    <div className="flex min-h-screen items-center justify-center bg-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-gray-200 p-6 shadow-sm"
      >
        <h1 className="mb-6 inline-block border-b-4 border-accent-yellow pb-1 text-2xl font-bold text-dark-navy">
          {isSignup ? "Sign up" : "Sign in"}
        </h1>

        <label className="mb-1 block text-sm text-gray-text" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2"
        />

        {isSignup && (
          <>
            <label className="mb-1 block text-sm text-gray-text" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded border border-gray-300 px-3 py-2"
            />
          </>
        )}

        <label className="mb-1 block text-sm text-gray-text" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded border border-gray-300 px-3 py-2"
        />

        {notice && <p className="mb-4 text-sm text-green-600">{notice}</p>}
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded bg-purple-secondary px-4 py-2 text-white hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? (isSignup ? "Signing up..." : "Signing in...") : isSignup ? "Sign up" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={toggleMode}
          className="mt-4 w-full text-center text-sm text-blue-primary hover:underline"
        >
          {isSignup ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
        </button>
      </form>
    </div>
  );
}
