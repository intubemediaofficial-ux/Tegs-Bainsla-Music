"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { FEATURES, type FeatureId } from "@/lib/access";
import { isUnlimited } from "@/lib/plans";
import { Section, apiSend, errText, useFlash } from "./shared";

const PLAN_OPTS = ["free", "starter", "creator", "unlimited", "admin"] as const;

interface AdminUser {
  id: string;
  name: string;
  email: string;
  plan: (typeof PLAN_OPTS)[number];
  role: "user" | "admin";
  apiKey: string;
  createdAt: string;
  banned?: boolean;
  unlimited?: boolean;
  access?: Partial<Record<FeatureId, boolean>>;
  limitOverrides?: { generations?: number; research?: number };
  usage: { generations: number; research: number };
  limits: { generations: number; research: number; artists: number; maxTags: number };
}

export function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const flash = useFlash();

  async function load() {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(id: string, body: Record<string, unknown>, okText = "Saved") {
    setBusy(true);
    const { ok, data } = await apiSend(`/api/admin/users/${id}`, "PATCH", body);
    flash.show(ok, ok ? okText : errText(data));
    await load();
    setBusy(false);
  }

  async function setLimit(u: AdminUser, kind: "generations" | "research", raw: string) {
    const trimmed = raw.trim();
    const value = trimmed === "" ? null : Number(trimmed);
    if (value !== null && (!Number.isFinite(value) || value < 0)) return;
    await patch(
      u.id,
      { limitOverrides: { [kind]: value } },
      value === null ? "Back to the plan default" : `Daily ${kind} set to ${value}`
    );
  }

  async function bulkUnlimited(unlimited: boolean) {
    if (!confirm(unlimited ? "Give unlimited daily usage to every user?" : "Put every user back on their plan limits?"))
      return;
    setBusy(true);
    const { ok, data } = await apiSend("/api/admin/users/bulk", "POST", { unlimited });
    flash.show(ok, ok ? `Updated ${data.updated ?? 0} users` : errText(data));
    await load();
    setBusy(false);
  }

  async function deleteUser(u: AdminUser) {
    if (!confirm(`Delete ${u.email}? This cannot be undone.`)) return;
    setBusy(true);
    const { ok, data } = await apiSend(`/api/admin/users/${u.id}`, "DELETE");
    flash.show(ok, ok ? "User deleted" : errText(data, "Could not delete"));
    await load();
    setBusy(false);
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(needle) ||
        u.name.toLowerCase().includes(needle) ||
        u.plan.includes(needle)
    );
  }, [users, q]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black">Users &amp; access</h1>
          <p className="mt-1 text-sm text-slate-400">
            Every change here applies to the live account immediately.
          </p>
        </div>
        {flash.node}
      </header>

      <NewUserForm
        onCreated={async (msg) => {
          flash.show(true, msg);
          await load();
        }}
        onError={(msg) => flash.show(false, msg)}
      />

      <Section
        title={`Users (${users.length})`}
        hint="Plan sets the default daily limits. “Unlimited ∞” ignores every daily cap. Typing a number in gen/res overrides the plan for that user only — clear the box to go back to the plan. Open “access” to switch individual features off."
        action={
          <div className="flex gap-2">
            <button onClick={() => bulkUnlimited(true)} disabled={busy} className="btn-ghost">
              Unlimited for everyone
            </button>
            <button onClick={() => bulkUnlimited(false)} disabled={busy} className="btn-ghost">
              Reset to plan limits
            </button>
          </div>
        }
      >
        <input
          className="input mb-3 sm:w-72"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email or plan"
        />
        <div className="overflow-x-auto">
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
              {filtered.map((u) => (
                <Fragment key={u.id}>
                  <tr className="border-t border-ink-line align-top">
                    <td className="py-2">
                      <div className="font-medium text-slate-100">{u.name}</div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td>
                      <select
                        className="input w-32 py-1"
                        value={u.plan}
                        onChange={(e) =>
                          patch(u.id, { plan: e.target.value }, `Plan set to ${e.target.value}`)
                        }
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
                          patch(u.id, { role: u.role === "admin" ? "user" : "admin" }, "Role changed")
                        }
                        title="Admins can open this panel and bypass every limit"
                      >
                        {u.role}
                      </button>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <button
                          className={`chip ${u.unlimited ? "text-green-300" : "text-slate-400"}`}
                          onClick={() =>
                            patch(u.id, { unlimited: !u.unlimited }, "Daily cap switched")
                          }
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
                        onClick={() =>
                          patch(u.id, { banned: !u.banned }, u.banned ? "Unbanned" : "Banned")
                        }
                        title="Banned users cannot log in or use the extension"
                      >
                        {u.banned ? "banned" : "active"}
                      </button>
                    </td>
                    <td className="whitespace-nowrap text-right">
                      <button
                        className="text-xs text-brand-300 hover:underline"
                        onClick={() => setOpenId(openId === u.id ? null : u.id)}
                      >
                        {openId === u.id ? "close" : "access"}
                      </button>
                    </td>
                  </tr>
                  {openId === u.id && (
                    <tr className="border-t border-ink-line bg-white/[0.02]">
                      <td colSpan={7} className="p-4">
                        <UserDetail
                          user={u}
                          busy={busy}
                          onPatch={patch}
                          onDelete={() => deleteUser(u)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
    </div>
  );
}

function UserDetail({
  user,
  busy,
  onPatch,
  onDelete,
}: {
  user: AdminUser;
  busy: boolean;
  onPatch: (id: string, body: Record<string, unknown>, okText?: string) => Promise<void>;
  onDelete: () => void;
}) {
  const [password, setPassword] = useState("");

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Feature access
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          Switch a feature off and the matching API returns “disabled for your account” (403) for
          this user. Admins always keep everything.
        </p>
        <div className="space-y-2">
          {FEATURES.map((f) => {
            const enabled = user.access?.[f.id] !== false;
            return (
              <label key={f.id} className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={enabled}
                  disabled={busy}
                  onChange={() =>
                    onPatch(
                      user.id,
                      { access: { [f.id]: enabled ? false : null } },
                      `${f.label} ${enabled ? "disabled" : "enabled"}`
                    )
                  }
                />
                <span>
                  <span className="text-slate-200">{f.label}</span>
                  <span className="block text-xs text-slate-500">{f.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Extension API key
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <code className="rounded bg-black/40 px-2 py-1 text-xs text-slate-300">
              {user.apiKey}
            </code>
            <button
              className="btn-ghost"
              disabled={busy}
              onClick={() =>
                confirm("Regenerate the API key? The old key stops working immediately.") &&
                onPatch(user.id, { regenerateApiKey: true }, "New API key generated")
              }
            >
              Regenerate
            </button>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            The user pastes this in the Chrome extension options.
          </p>
        </div>

        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (password.length < 6) return;
            await onPatch(user.id, { password }, "Password changed");
            setPassword("");
          }}
        >
          <input
            className="input w-48"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="New password (6+)"
          />
          <button className="btn-ghost" disabled={busy || password.length < 6}>
            Set password
          </button>
        </form>

        <div className="text-xs text-slate-500">
          Joined {new Date(user.createdAt).toLocaleDateString()} · artists{" "}
          {user.limits.artists} · max tags {user.limits.maxTags}
        </div>

        <button onClick={onDelete} className="text-xs text-red-400 hover:underline">
          Delete this user
        </button>
      </div>
    </div>
  );
}

function NewUserForm({
  onCreated,
  onError,
}: {
  onCreated: (msg: string) => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState<(typeof PLAN_OPTS)[number]>("unlimited");
  const [unlimited, setUnlimited] = useState(true);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + Add user
      </button>
    );
  }

  return (
    <Section
      title="Add a user"
      hint="Creates the account right away and gives them an extension API key. Share the email + password with them; they can change the password later."
      action={
        <button className="btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      }
    >
      <form
        className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const { ok, data } = await apiSend("/api/admin/users", "POST", {
            email,
            name,
            password,
            plan,
            unlimited,
          });
          if (ok) {
            setEmail("");
            setName("");
            setPassword("");
            await onCreated(`${email} created`);
          } else {
            onError(errText(data, "Could not create the user"));
          }
          setBusy(false);
        }}
      >
        <input
          className="input"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
        />
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (optional)"
        />
        <input
          className="input"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (6+)"
        />
        <select
          className="input"
          value={plan}
          onChange={(e) => setPlan(e.target.value as (typeof PLAN_OPTS)[number])}
        >
          {PLAN_OPTS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-xs text-slate-400">
            <input
              type="checkbox"
              checked={unlimited}
              onChange={(e) => setUnlimited(e.target.checked)}
            />
            unlimited
          </label>
          <button className="btn-primary" disabled={busy}>
            {busy ? "Creating…" : "Create"}
          </button>
        </div>
      </form>
    </Section>
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
