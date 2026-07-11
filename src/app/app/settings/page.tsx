import { Settings } from "@/components/Settings";

export default function SettingsPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-black">Settings</h1>
        <p className="text-sm text-slate-400">Account, usage and your extension API key.</p>
      </div>
      <Settings />
    </div>
  );
}
