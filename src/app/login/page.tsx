import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-6 block text-center text-lg font-black">
          Bainsla<span className="text-brand-400">Tags</span>
        </Link>
        <div className="card">
          <h1 className="mb-1 text-xl font-bold">Sign in</h1>
          <p className="mb-5 text-sm text-slate-400">Welcome back.</p>
          <AuthForm mode="login" />
        </div>
        <p className="mt-4 text-center text-sm text-slate-400">
          No account?{" "}
          <Link href="/register" className="text-brand-400 hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
