import { TitleAnalyzer } from "@/components/TitleAnalyzer";
import { PageHeader } from "@/components/PageHeader";

export default function TitlesPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        icon="✍️"
        title="Title Analyzer"
        subtitle={"Score any title /100, then build a full title from song + singer."}
      />
      <TitleAnalyzer />
    </div>
  );
}