import { Artists } from "@/components/Artists";
import { PageHeader } from "@/components/PageHeader";

export default function ArtistsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        icon="⭐"
        title="Artist Presets"
        subtitle={"Save singers/songs and jump straight to a full package."}
      />
      <Artists />
    </div>
  );
}