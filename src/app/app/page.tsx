import { FullPackage } from "@/components/FullPackage";

export default async function AppHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Full Package</h1>
        <p className="text-sm text-slate-400">
          One click → best titles, 500-char tags, hashtags & thumbnails that rank right now.
        </p>
      </div>
      <FullPackage initialQuery={q ?? ""} />
    </div>
  );
}
