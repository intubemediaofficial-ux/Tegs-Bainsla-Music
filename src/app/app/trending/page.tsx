import { getCurrentUser } from "@/lib/auth";
import { Trending } from "@/components/Trending";

export default async function TrendingPage() {
  const user = await getCurrentUser();
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Trending / Viral Monitor</h1>
        <p className="text-sm text-slate-400">
          What&apos;s blowing up right now per category — and why.
        </p>
      </div>
      <Trending isAdmin={user?.role === "admin"} />
    </div>
  );
}
