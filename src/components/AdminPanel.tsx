"use client";

import { useEffect, useState } from "react";

interface Stats {
  totalUsers: number;
  byPlan: Record<string, number>;
  generationsToday: number;
  researchToday: number;
}
interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: "free" | "starter" | "creator" | "admin";
  role: "user" | "admin";
  banned?: boolean;
  usage: { generations: number; research: number };
}
interface Category {
  id: string;
  label: string;
  query: string;
}

const PLAN_OPTS = ["free", "starter", "creator", "admin"] as const;

export function AdminPanel() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [label, setLabel] = useState("");
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  async function loadAll() {
    const [s, u, c] = await Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()),
      fetch("/api/admin/users").then((r) => r.json()),
      fetch("/api/admin/categories").then((r) => r.json()),
    ]);
    setStats(s);
    setUsers(u.users ?? []);
    setCategories(c.categories ?? []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  async function updateUser(id: string, patch: Record<string, unknown>) {
    await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await loadAll();
  }

  async function deleteUser(id: string) {
    if (!confirm("Delete this user?")) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    await loadAll();
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim() || !query.trim()) return;
    await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, query }),
    });
    setLabel("");
    setQuery("");
    await loadAll();
  }

  async function removeCategory(id: string) {
    await fetch(`/api/admin/categories?id=${id}`, { method: "DELETE" });
    await loadAll();
  }

  async function refreshTrending() {
    setRefreshing(true);
    try {
      await fetch("/api/cron/refresh", { method: "POST" });
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black">Dashboard</h1>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Total users" value={stats.totalUsers} />
          <Stat label="Generations today" value={stats.generationsToday} />
          <Stat label="Research today" value={stats.researchToday} />
          <Stat
            label="Paid users"
            value={(stats.byPlan.starter ?? 0) + (stats.byPlan.creator ?? 0)}
          />
        </div>
      )}

      <div className="card overflow-x-auto">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
          Users
        </h2>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">User</th>
              <th>Plan</th>
              <th>Role</th>
              <th>Today</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-ink-line">
                <td className="py-2">
                  <div className="font-medium text-slate-100">{u.name}</div>
                  <div className="text-xs text-slate-500">{u.email}</div>
                </td>
                <td>
                  <select
                    className="input w-28 py-1"
                    value={u.plan}
                    onChange={(e) => updateUser(u.id, { plan: e.target.value })}
                  >
                    {PLAN_OPTS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <button
                    className="chip"
                    onClick={() =>
                      updateUser(u.id, { role: u.role === "admin" ? "user" : "admin" })
                    }
                  >
                    {u.role}
                  </button>
                </td>
                <td className="text-xs text-slate-400">
                  {u.usage.generations}g / {u.usage.research}r
                </td>
                <td>
                  <button
                    className={`chip ${u.banned ? "text-red-300" : "text-green-300"}`}
                    onClick={() => updateUser(u.id, { banned: !u.banned })}
                  >
                    {u.banned ? "banned" : "active"}
                  </button>
                </td>
                <td className="text-right">
                  <button
                    onClick={() => deleteUser(u.id)}
                    className="text-xs text-red-400 hover:underline"
                  >
                    delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Tracked categories (trending monitor)
          </h2>
          <button onClick={refreshTrending} disabled={refreshing} className="btn-ghost">
            {refreshing ? "Refreshing…" : "Refresh trending now"}
          </button>
        </div>
        <form onSubmit={addCategory} className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input
            className="input"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label e.g. Punjabi Music"
          />
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search query e.g. new punjabi song"
          />
          <button className="btn-primary">Add</button>
        </form>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <span key={c.id} className="chip">
              {c.label} — “{c.query}”
              <button
                onClick={() => removeCategory(c.id)}
                className="ml-1 text-red-400 hover:text-red-300"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card text-center">
      <div className="text-3xl font-black">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
