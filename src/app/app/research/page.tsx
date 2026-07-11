import { KeywordResearch } from "@/components/KeywordResearch";

export default function ResearchPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Keyword Research</h1>
        <p className="text-sm text-slate-400">
          Difficulty, volume, competition, related keywords, questions & top videos.
        </p>
      </div>
      <KeywordResearch />
    </div>
  );
}
