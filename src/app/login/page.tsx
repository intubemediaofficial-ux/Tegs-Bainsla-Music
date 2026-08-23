import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

const GOOGLE_ERRORS: Record<string, string> = {
  google_not_configured: "Google sign-in is not set up yet — use your email and password.",
  google_cancelled: "Google sign-in was cancelled.",
  google_missing_code: "Google did not complete the sign-in. Try again.",
  google_expired: "That sign-in link expired. Try again.",
  google_failed: "Google sign-in failed. Try again.",
  signups_closed: "Sign-ups are closed. Ask the admin for an invite.",
  banned: "This account is blocked.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const message = error ? (GOOGLE_ERRORS[error] ?? "Sign-in failed. Try again.") : null;
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center text-2xl font-black">
          Bainsla<span className="grad-text">Tags</span>
        </Link>
        <div className="card bg-gradient-to-br from-brand-600/20 via-ink-card/80 to-accent-cyan/10">
          <h1 className="mb-1 text-xl font-bold">Sign in</h1>
          <p className="mb-5 text-sm text-slate-400">Welcome back.</p>
          {message && <p className="mb-4 text-sm text-red-400">{message}</p>}
          <AuthForm mode="login" next={next} />
        </div>
        <p className="mt-4 text-center text-sm text-slate-400">
          No account?{" "}
          <Link
            href={next ? `/register?next=${encodeURIComponent(next)}` : "/register"}
            className="text-brand-400 hover:underline"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
