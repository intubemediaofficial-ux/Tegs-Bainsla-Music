import { Settings } from "@/components/Settings";
import { PageHeader } from "@/components/PageHeader";

export default function SettingsPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        icon="⚙️"
        title="Settings"
        subtitle={"Account, usage and your extension API key."}
      />
      <Settings />
    </div>
  );
}