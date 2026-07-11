import { Artists } from "@/components/Artists";

export default function ArtistsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Artist Presets</h1>
        <p className="text-sm text-slate-400">
          Save singers/songs and jump straight to a full package.
        </p>
      </div>
      <Artists />
    </div>
  );
}
