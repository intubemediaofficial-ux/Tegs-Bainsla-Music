import { getCurrentUser } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Trending } from "@/components/Trending";

export default async function TrendingPage() {
  const user = await getCurrentUser();
  return (
    <div className="space-y-5">
      <PageHeader
        icon="🔥"
        title="Trending / Viral Monitor"
        subtitle={"What's blowing up right now per category — and why."}
      />
      <Trending isAdmin={user?.role === "admin"} />
    </div>
  );
}