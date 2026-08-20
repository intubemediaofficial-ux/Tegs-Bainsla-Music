import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppSidebar, AppMobileNav } from "@/components/AppNav";
import { PLANS } from "@/lib/plans";
import { getSettings } from "@/lib/settings";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const plan = PLANS[user.plan];
  const isAdmin = user.role === "admin";
  const { announcement } = await getSettings();

  return (
    <div className="flex min-h-screen">
      <AppSidebar name={user.name} planName={plan.name} isAdmin={isAdmin} />
      <div className="min-w-0 flex-1">
        <AppMobileNav name={user.name} isAdmin={isAdmin} />
        {announcement && (
          <div className="border-b border-amber-400/30 bg-amber-400/10 px-4 py-2 text-sm text-amber-200">
            {announcement}
          </div>
        )}
        <main className="mx-auto max-w-5xl px-4 py-5 sm:px-5 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
