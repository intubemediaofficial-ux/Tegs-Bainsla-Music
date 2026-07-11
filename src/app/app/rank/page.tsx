import { RankChecker } from "@/components/RankChecker";

export default function RankPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Rank Checker</h1>
        <p className="text-sm text-slate-400">Find where your video ranks for any keyword.</p>
      </div>
      <RankChecker />
    </div>
  );
}
