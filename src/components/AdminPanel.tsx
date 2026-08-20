"use client";

import { useEffect, useState } from "react";
import { isUnlimited } from "@/lib/plans";

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
  unlimited?: boolean;
  usage: { generations: number; research: number };
  limits: { generations: number; research: number; artists: number; maxTags: number };
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
  const [bulkBusy, setBulkBusy] = useState(false);

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

  async function setLimit(u: AdminUser, kind: "generations" | "research", raw: string) {
    const trimmed = raw.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isFinite(value) || value < 0)) return;
    await updateUser(u.id, { limitOverrides: { [kind]: value } });
  }

  async function unlimitedForEveryone() {
    if (!confirm("Give unlimited daily usage to every user?")) return;
    setBulkBusy(true);
    try {
      await fetch("/api/admin/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unlimited: true }),
      });
      await loadAll();
    } finally {
      setBulkBusy(false);
    }
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Users
          </h2>
          <button onClick={unlimitedForEveryone} disabled={bulkBusy} className="btn-ghost">
            {bulkBusy ? "Applying…" : "Unlimited for everyone"}
          </button>
        </div>
        <p className="mb-3 text-xs text-slate-500">
          “Unlimited” switches off the daily cap for that user. Or type an exact daily number
          in the boxes — leave a box empty to fall back to the plan’s limit.
        </p>
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">User</th>
              <th>Plan</th>
              <th>Role</th>
              <th>Daily limit</th>
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
                <td>
                  <div className="flex items-center gap-2">
                    <button
                      className={`chip ${u.unlimited ? "text-green-300" : "text-slate-400"}`}
                      onClick={() => updateUser(u.id, { unlimited: !u.unlimited })}
                      title="Never run out of daily generations / research"
                    >
                      {u.unlimited ? "unlimited ∞" : "limited"}
                    </button>
                    {!u.unlimited && (
                      <>
                        <LimitInput
                          label="gen"
                          value={u.limits.generations}
                          onSave={(v) => setLimit(u, "generations", v)}
                        />
                        <LimitInput
                          label="res"
                          value={u.limits.research}
                          onSave={(v) => setLimit(u, "research", v)}
                        />
                      </>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap text-xs text-slate-400">
                  {u.usage.generations}
                  {isUnlimited(u.limits.generations) ? "" : `/${u.limits.generations}`}g /{" "}
                  {u.usage.research}
                  {isUnlimited(u.limits.research) ? "" : `/${u.limits.research}`}r
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

function LimitInput({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number;
  onSave: (raw: string) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <label className="flex items-center gap-1 text-xs text-slate-500">
      {label}
      <input
        className="input w-16 px-1 py-1 text-center"
        value={draft}
        inputMode="numeric"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => draft !== String(value) && onSave(draft)}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
    </label>
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
