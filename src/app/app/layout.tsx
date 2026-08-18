import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppSidebar, AppMobileNav } from "@/components/AppNav";
import { PLANS } from "@/lib/plans";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const plan = PLANS[user.plan];
  const isAdmin = user.role === "admin";

  return (
    <div className="flex min-h-screen">
      <AppSidebar name={user.name} planName={plan.name} isAdmin={isAdmin} />
      <div className="min-w-0 flex-1">
        <AppMobileNav name={user.name} isAdmin={isAdmin} />
        <main className="mx-auto max-w-5xl px-4 py-5 sm:px-5 sm:py-6">{children}</main>
      </div>
    </div>
  );
}
