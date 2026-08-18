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
    </div>
  );
}