import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center text-2xl font-black">
          Bainsla<span className="grad-text">Tags</span>
        </Link>
        <div className="card bg-gradient-to-br from-brand-600/20 via-ink-card/80 to-accent-cyan/10">
          <h1 className="mb-1 text-xl font-bold">Sign in</h1>
          <p className="mb-5 text-sm text-slate-400">Welcome back.</p>
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
