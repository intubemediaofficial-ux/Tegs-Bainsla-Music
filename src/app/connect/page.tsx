import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ConnectExtension } from "@/components/ConnectExtension";

export const metadata = { title: "Connect the extension — Bainsla Music Tags" };

export default async function ConnectPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/connect");

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-lg">
        <Link href="/" className="mb-6 block text-center text-2xl font-black">
          Bainsla<span className="grad-text">Tags</span>
        </Link>
        <ConnectExtension email={user.email} />
        <p className="mt-4 text-center text-sm text-slate-400">
          <Link href="/app" className="text-brand-400 hover:underline">
            Open the dashboard →
          </Link>
        </p>
      </div>
    </div>
  );
}
