import Link from "next/link";
import { getInvite } from "@/lib/invites";
import { InviteForm } from "@/components/InviteForm";

export const metadata = { title: "Accept your invite — Bainsla Music Tags" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await getInvite(token);

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center text-2xl font-black">
          Bainsla<span className="grad-text">Tags</span>
        </Link>
        <div className="card bg-gradient-to-br from-brand-600/20 via-ink-card/80 to-accent-cyan/10">
          {invite ? (
            <>
              <h1 className="mb-1 text-xl font-bold">Set your password</h1>
              <p className="mb-5 text-sm text-slate-400">
                Invite for{" "}
                <span className="text-slate-200">{invite.email}</span>. Choose a
                password and you are in — the dashboard and the Chrome extension
                both use it.
              </p>
              <InviteForm token={token} />
            </>
          ) : (
            <>
              <h1 className="mb-1 text-xl font-bold">Link expired</h1>
              <p className="text-sm text-slate-400">
                This invite has already been used or is older than 14 days. Ask
                the admin for a fresh link, or{" "}
                <Link href="/login" className="text-brand-400 hover:underline">
                  sign in
                </Link>{" "}
                if you already set a password.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
