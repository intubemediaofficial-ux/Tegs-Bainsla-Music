"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteForm({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not accept the invite");
      router.push(data.user?.role === "admin" ? "/admin" : "/connect");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not accept the invite",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="label">Name</label>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name (optional)"
        />
      </div>
      <div>
        <label className="label">Password</label>
        <input
          className="input"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 6 characters"
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        className="btn-primary w-full"
        disabled={loading || password.length < 6}
      >
        {loading ? "Saving…" : "Set password & continue"}
      </button>
    </form>
  );
}
