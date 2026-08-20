"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "./LogoutButton";

interface NavItem {
  href: string;
  label: string;
  icon: string;
  hint: string;
}

interface NavGroup {
  group: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    group: "Create",
    items: [
      { href: "/app", label: "Full Package", icon: "🎯", hint: "Tags + titles + playlists" },
      { href: "/app/tags", label: "Tag Generator", icon: "🏷️", hint: "500-char tag box" },
      { href: "/app/titles", label: "Title Analyzer", icon: "✍️", hint: "Score + build titles" },
    ],
  },
  {
    group: "Research",
    items: [
      { href: "/app/research", label: "Keyword Research", icon: "🔍", hint: "Ranked keywords" },
      { href: "/app/channel", label: "Channel Tags", icon: "📺", hint: "Any channel's tags" },
      { href: "/app/tags-viewer", label: "Competitor Tags", icon: "🕵️", hint: "Tags of any video" },
      { href: "/app/rank", label: "Rank Checker", icon: "📊", hint: "Where you rank" },
    ],
  },
  {
    group: "Trends",
    items: [
      {
        href: "/app/trending",
        label: "Trending / Viral",
        icon: "🔥",
        hint: "What's hot right now",
      },
    ],
  },
  {
    group: "Account",
    items: [
      { href: "/app/artists", label: "Artist Presets", icon: "⭐", hint: "Saved artists" },
      { href: "/app/settings", label: "Settings", icon: "⚙️", hint: "Plan + API key" },
    ],
  },
];

function itemClasses(active: boolean) {
  return `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-semibold transition ${
    active
      ? "bg-gradient-to-r from-brand-600/40 to-accent-pink/20 text-white shadow-lg shadow-brand-900/40 ring-1 ring-brand-400/60"
      : "text-slate-300 hover:bg-ink-card/80 hover:text-white"
  }`;
}

function NavList({
  pathname,
  onNavigate,
  isAdmin,
}: {
  pathname: string;
  onNavigate?: () => void;
  isAdmin: boolean;
}) {
  return (
    <nav className="space-y-5">
      {NAV_GROUPS.map((g) => (
        <div key={g.group}>
          <div className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {g.group}
          </div>
          <div className="space-y-1">
            {g.items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={onNavigate}
                className={itemClasses(pathname === n.href)}
              >
                <span className="text-lg leading-none">{n.icon}</span>
                <span className="min-w-0">
                  <span className="block truncate">{n.label}</span>
                  <span className="block truncate text-[11px] font-normal text-slate-500">
                    {n.hint}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
      {isAdmin && (
        <div>
          <div className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
            Admin
          </div>
          <Link
            href="/admin"
            onClick={onNavigate}
            className={itemClasses(pathname.startsWith("/admin"))}
          >
            <span className="text-lg leading-none">🛡️</span>
            <span>Admin Panel</span>
          </Link>
        </div>
      )}
    </nav>
  );
}

export function AppSidebar({
  name,
  planName,
  isAdmin,
}: {
  name: string;
  planName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-line bg-gradient-to-b from-brand-900/40 via-ink-soft/90 to-ink-soft/90 p-4 backdrop-blur-md md:flex">
      <Link href="/app" className="mb-6 block text-xl font-black tracking-tight">
        Bainsla<span className="grad-text">Tags</span>
      </Link>
      <div className="flex-1 overflow-y-auto">
        <NavList pathname={pathname} isAdmin={isAdmin} />
      </div>
      <div className="mt-4 rounded-xl border border-brand-500/30 bg-gradient-to-br from-brand-600/25 to-accent-cyan/10 p-3 text-xs">
        <div className="text-sm font-bold text-slate-100">{name}</div>
        <div className="mb-2 text-slate-400">{planName} plan</div>
        <LogoutButton />
      </div>
    </aside>
  );
}

/** Mobile top bar + slide-in menu (the sidebar is hidden under md). */
export function AppMobileNav({ name, isAdmin }: { name: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const current = NAV_GROUPS.flatMap((g) => g.items).find((n) => n.href === pathname);

  return (
    <div className="md:hidden">
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-brand-500/25 bg-gradient-to-r from-brand-900/70 via-ink/90 to-accent-pink/15 px-4 py-3 backdrop-blur">
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setOpen(true)}
          className="btn-ghost px-3 py-2 text-lg leading-none"
        >
          ☰
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="truncate text-base font-black">
            {current ? `${current.icon} ${current.label}` : "BainslaTags"}
          </div>
        </div>
        <Link href="/app/settings" className="max-w-[6rem] truncate text-xs text-slate-400">
          {name}
        </Link>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setOpen(false)}>
          <div
            className="h-full w-[80%] max-w-xs overflow-y-auto border-r border-ink-line bg-gradient-to-b from-brand-900/60 via-ink-soft to-ink-soft p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <span className="text-xl font-black tracking-tight">
                Bainsla<span className="grad-text">Tags</span>
              </span>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="btn-ghost px-2 py-1 text-lg leading-none"
              >
                ×
              </button>
            </div>
            <NavList pathname={pathname} isAdmin={isAdmin} onNavigate={() => setOpen(false)} />
            <div className="mt-6">
              <LogoutButton />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
