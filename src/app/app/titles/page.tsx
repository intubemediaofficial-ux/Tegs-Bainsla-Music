import { TitleAnalyzer } from "@/components/TitleAnalyzer";

export default function TitlesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Title Analyzer</h1>
        <p className="text-sm text-slate-400">Score any title /100 and get concrete fixes.</p>
      </div>
      <TitleAnalyzer />
    </div>
  );
}
