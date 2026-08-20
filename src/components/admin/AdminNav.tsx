"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview", hint: "Users, usage and system status" },
  { href: "/admin/users", label: "Users & access", hint: "Plans, limits, feature access" },
  { href: "/admin/plans", label: "Plans & limits", hint: "What each plan allows" },
  { href: "/admin/integrations", label: "API & keys", hint: "YouTube key, Google OAuth, cron" },
  { href: "/admin/trending", label: "Trending & cron", hint: "Categories and refresh" },
  { href: "/admin/settings", label: "App settings", hint: "Sign-ups, default plan, notice" },
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
            className={`rounded-lg px-3 py-2 text-sm ${
              active
                ? "bg-brand-500/15 font-semibold text-brand-300"
                : "text-slate-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <span className="whitespace-nowrap">{l.label}</span>
            <span className="hidden text-xs text-slate-500 lg:block">{l.hint}</span>
          </Link>
        );
      })}
    </nav>
  );
}
