import { FullPackage } from "@/components/FullPackage";
import { PageHeader } from "@/components/PageHeader";

export default async function AppHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <div className="space-y-5">
      <PageHeader
        icon="🎯"
        title="Full Package"
        subtitle={"One click → best titles, 500-char tags, hashtags & thumbnails that rank right now."}
      />
      <FullPackage initialQuery={q ?? ""} />
    </div>
  );
}