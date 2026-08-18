import { KeywordResearch } from "@/components/KeywordResearch";
import { PageHeader } from "@/components/PageHeader";

export default function ResearchPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        icon="🔍"
        title="Keyword Research"
        subtitle={"Difficulty, volume, competition, related keywords, questions & top videos."}
      />
      <KeywordResearch />
    </div>
  );
}