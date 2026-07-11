import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { PLANS } from "@/lib/plans";

const NAV = [
  { href: "/app", label: "Full Package" },
  { href: "/app/tags", label: "Tag Generator" },
  { href: "/app/titles", label: "Title Analyzer" },
  { href: "/app/research", label: "Keyword Research" },
  { href: "/app/rank", label: "Rank Checker" },
  { href: "/app/tags-viewer", label: "Competitor Tags" },
  { href: "/app/trending", label: "Trending / Viral" },
  { href: "/app/artists", label: "Artist Presets" },
  { href: "/app/settings", label: "Settings" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const plan = PLANS[user.plan];

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-ink-line bg-ink-soft p-4 md:flex">
        <Link href="/app" className="mb-6 text-lg font-black">
          Bainsla<span className="text-brand-400">Tags</span>
        </Link>
        <nav className="flex-1 space-y-1">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-ink-card hover:text-white"
            >
              {n.label}
            </Link>
          ))}
          {user.role === "admin" && (
            <Link
              href="/admin"
              className="block rounded-lg px-3 py-2 text-sm font-semibold text-brand-300 hover:bg-ink-card"
            >
              Admin Panel
            </Link>
          )}
        </nav>
        <div className="mt-4 rounded-lg border border-ink-line bg-ink-card p-3 text-xs">
          <div className="font-semibold text-slate-200">{user.name}</div>
          <div className="mb-2 text-slate-400">{plan.name} plan</div>
          <LogoutButton />
        </div>
      </aside>

      <div className="flex-1">
        <header className="flex items-center justify-between border-b border-ink-line px-5 py-3 md:hidden">
          <Link href="/app" className="font-black">
            Bainsla<span className="text-brand-400">Tags</span>
          </Link>
          <Link href="/app/settings" className="text-sm text-slate-300">
            {user.name}
          </Link>
        </header>
        <main className="mx-auto max-w-5xl px-5 py-6">{children}</main>
      </div>
    </div>
  );
}
