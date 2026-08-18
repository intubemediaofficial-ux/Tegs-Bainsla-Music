import { ChannelTags } from "@/components/ChannelTags";
import { CompetitorTags } from "@/components/CompetitorTags";
import { PageHeader } from "@/components/PageHeader";

export default function ChannelPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        icon="📺"
        title="Channel Tags"
        subtitle="Paste any channel link — see its channel keywords with rank, plus every video's own tags."
      />
      <ChannelTags />

      <div className="card space-y-4">
        <div>
          <h2 className="text-lg font-black text-slate-100">Or check one video link</h2>
          <p className="mt-1 text-xs text-slate-500">
            Paste a video link to instantly see the exact tags on it, plus stronger tags you
            could use instead.
          </p>
        </div>
        <CompetitorTags compact />
      </div>
    </div>
  );
}
