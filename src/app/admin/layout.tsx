import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LogoutButton } from "@/components/LogoutButton";
import { AdminNav } from "@/components/admin/AdminNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/app");

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-ink-line bg-gradient-to-b from-brand-900/50 via-ink-soft/85 to-ink-soft/85 backdrop-blur-md lg:min-h-screen lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4">
          <Link href="/admin" className="font-black">
            Admin <span className="grad-text">Panel</span>
          </Link>
        </div>
        <AdminNav />
        <div className="space-y-2 px-5 py-4 text-xs text-slate-500">
          <div className="truncate">{user.email}</div>
          <Link href="/app" className="block hover:text-white">
            ← Back to app
          </Link>
          <LogoutButton />
        </div>
      </aside>
      <main className="mx-auto w-full max-w-6xl px-5 py-6">{children}</main>
    </div>
  );
}
