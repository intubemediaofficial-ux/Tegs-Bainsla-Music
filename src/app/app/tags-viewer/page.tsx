import { CompetitorTags } from "@/components/CompetitorTags";
import { PageHeader } from "@/components/PageHeader";

export default function TagsViewerPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        icon="🕵️"
        title="Competitor Tags"
        subtitle={"Read the real tags on any public YouTube video, ranked by live search demand."}
      />
      <CompetitorTags />
    </div>
  );
}