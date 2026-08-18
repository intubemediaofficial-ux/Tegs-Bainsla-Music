import { RankChecker } from "@/components/RankChecker";
import { PageHeader } from "@/components/PageHeader";

export default function RankPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        icon="📊"
        title="Rank Checker"
        subtitle={"Find where your video ranks for any keyword."}
      />
      <RankChecker />
    </div>
  );
}