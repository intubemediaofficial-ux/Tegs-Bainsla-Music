import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/app");

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-ink-line px-5 py-3">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="font-black">
            Admin <span className="text-brand-400">Panel</span>
          </Link>
          <Link href="/app" className="text-sm text-slate-400 hover:text-white">
            ← Back to app
          </Link>
        </div>
        <div className="w-28">
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-6">{children}</main>
    </div>
  );
}
