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

  return (
    <form onSubmit={submit} className="space-y-3">
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
