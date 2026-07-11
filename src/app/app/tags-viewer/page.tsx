import { CompetitorTags } from "@/components/CompetitorTags";

export default function TagsViewerPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Competitor Tags</h1>
        <p className="text-sm text-slate-400">
          Read the real tags on any public YouTube video.
        </p>
      </div>
      <CompetitorTags />
    </div>
  );
}
