"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview", icon: "📈", hint: "Users, usage and system status" },
  { href: "/admin/users", label: "Users & access", icon: "👥", hint: "Plans, limits, feature access" },
  { href: "/admin/plans", label: "Plans & limits", icon: "🧾", hint: "What each plan allows" },
  {
    href: "/admin/integrations",
    label: "API & keys",
    icon: "🔑",
    hint: "YouTube key, Google OAuth, cron",
  },
  { href: "/admin/trending", label: "Trending & cron", icon: "🔥", hint: "Categories and refresh" },
  {
    href: "/admin/settings",
    label: "App settings",
    icon: "⚙️",
    hint: "Sign-ups, default plan, notice",
  },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
      {LINKS.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`rounded-xl px-3 py-2 text-sm transition ${
              active
                ? "bg-gradient-to-r from-brand-600/45 to-accent-pink/20 font-semibold text-white shadow-lg shadow-brand-900/40 ring-1 ring-brand-400/60"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="whitespace-nowrap">
              <span className="mr-2">{l.icon}</span>
              {l.label}
            </span>
            <span className="hidden text-xs text-slate-500 lg:block">{l.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
