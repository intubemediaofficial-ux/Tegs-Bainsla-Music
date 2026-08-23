"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function AuthForm({
  mode,
  next,
}: {
  mode: "login" | "register";
  next?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register" ? { email, name, password } : { email, password }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      const fallback = data.user?.role === "admin" ? "/admin" : "/app";
      router.push(next && next.startsWith("/") ? next : fallback);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const googleHref = `/api/auth/google/login/start${
    next && next.startsWith("/") ? `?next=${encodeURIComponent(next)}` : ""
  }`;

  return (
    <form onSubmit={submit} className="space-y-3">
      <a
        href={googleHref}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 font-semibold text-slate-800 hover:bg-slate-100"
      >
        <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
          <path
            fill="#EA4335"
            d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.2 17.7 9.5 24 9.5z"
          />
          <path
            fill="#4285F4"
            d="M46.5 24.5c0-1.6-.1-2.8-.4-4.1H24v8.2h12.7c-.3 2.1-1.6 5.2-4.7 7.3l7.6 5.9c4.5-4.1 6.9-10.2 6.9-17.3z"
          />
          <path
            fill="#FBBC05"
            d="M10.4 28.7A14.6 14.6 0 019.6 24c0-1.6.3-3.2.8-4.7l-7.8-6.1A24 24 0 000 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z"
          />
          <path
            fill="#34A853"
            d="M24 48c6.5 0 11.9-2.1 15.6-5.8l-7.6-5.9c-2 1.4-4.7 2.4-8 2.4-6.3 0-11.7-3.7-13.6-9.1l-7.8 6.1C6.5 42.6 14.6 48 24 48z"
          />
        </svg>
        Continue with Google
      </a>
      <div className="flex items-center gap-3 text-xs uppercase text-slate-500">
        <span className="h-px flex-1 bg-white/10" />
        or email
        <span className="h-px flex-1 bg-white/10" />
      </div>
      {mode === "register" && (
        <div>
          <label className="label">Name</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
          />
        </div>
      )}
      <div>
        <label className="label">Email</label>
        <input
          className="input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
      </div>
      <div>
        <label className="label">Password</label>
        <input
          className="input"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button className="btn-primary w-full" disabled={loading}>
        {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}
