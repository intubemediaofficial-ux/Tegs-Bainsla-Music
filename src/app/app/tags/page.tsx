import { CompetitorTags } from "@/components/CompetitorTags";
import { FullPackage } from "@/components/FullPackage";
import { PageHeader } from "@/components/PageHeader";

export default function TagsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        icon="🏷️"
        title="Tag Generator"
        subtitle={"Premium 500-char tag set merging autocomplete with real tags from ranking videos."}
      />
      <FullPackage />

      <div className="card space-y-4">
        <div>
          <h2 className="text-lg font-black text-slate-100">Tags from a video link</h2>
          <p className="mt-1 text-xs text-slate-500">
            Paste any video link — its exact tags show up with rank, and below them the stronger
            tags you should use instead.
          </p>
        </div>
        <CompetitorTags compact />
      </div>
    </div>
  );
}