import { FullPackage } from "@/components/FullPackage";

export default function TagsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Tag Generator</h1>
        <p className="text-sm text-slate-400">
          Premium 500-char tag set merging autocomplete with real tags from ranking videos.
        </p>
      </div>
      <FullPackage />
    </div>
  );
}
