import { ChannelTags } from "@/components/ChannelTags";
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
    </div>
  );
}
