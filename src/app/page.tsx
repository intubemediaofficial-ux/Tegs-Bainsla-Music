import Link from "next/link";
import { PLANS } from "@/lib/plans";

const FEATURES = [
  {
    title: "Full Package in 1 click",
    body: "Enter a singer or song → get best titles, a 500-char premium tag box, hashtags and top thumbnails together, ready to paste.",
  },
  {
    title: "Real high-rank titles",
    body: "Titles pulled from the actual top-ranking videos (not AI guesses) plus optimized variations, each scored /100.",
  },
  {
    title: "Premium tags",
    body: "Merges YouTube autocomplete with the real tags used by videos already ranking for your keyword.",
  },
  {
    title: "Keyword research",
    body: "Difficulty, volume, competition and opportunity scores, related keywords, questions and top videos.",
  },
  {
    title: "Video rank checker",
    body: "See exactly where your video ranks for any keyword across the top 50 results.",
  },
  {
    title: "Viral trend monitor",
    body: "Auto-tracks new videos per category, scores virality and explains WHY a song is blowing up — which tags, hashtags and title patterns to copy.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="text-lg font-black tracking-tight">
          Bainsla<span className="text-brand-400">Tags</span>
        </div>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/#pricing" className="text-slate-300 hover:text-white">
            Pricing
          </Link>
          <Link href="/login" className="text-slate-300 hover:text-white">
            Sign in
          </Link>
          <Link href="/register" className="btn-primary">
            Start free
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-10 pt-16 text-center">
        <div className="mx-auto mb-4 inline-flex rounded-full border border-ink-line bg-ink-card px-3 py-1 text-xs text-brand-300">
          vidIQ + RapidTags + TubeBuddy — merged, for music creators
        </div>
        <h1 className="mx-auto max-w-3xl text-4xl font-black leading-tight sm:text-6xl">
          Get more views with the right{" "}
          <span className="text-brand-400">titles, tags & trends</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-slate-300">
          Enter a singer, song or keyword and instantly get the titles, 500-char tags, hashtags and
          thumbnails that are actually ranking on YouTube right now — plus a live viral-trend
          monitor. Works in a web dashboard and as a Chrome extension.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/register" className="btn-primary px-6 py-3">
            Get started for free
          </Link>
          <Link href="/#pricing" className="btn-ghost px-6 py-3">
            See plans
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 py-10 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="card">
            <h3 className="mb-2 font-bold text-brand-300">{f.title}</h3>
            <p className="text-sm text-slate-300">{f.body}</p>
          </div>
        ))}
      </section>

      <section id="pricing" className="mx-auto max-w-6xl px-5 py-14">
        <h2 className="mb-2 text-center text-3xl font-black">Simple pricing</h2>
        <p className="mb-8 text-center text-slate-400">
          Start free. Upgrade for higher daily limits and power features.
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {(["free", "starter", "creator"] as const).map((id) => {
            const plan = PLANS[id];
            return (
              <div
                key={id}
                className={`card ${id === "creator" ? "border-brand-500 ring-1 ring-brand-500" : ""}`}
              >
                <div className="text-sm text-slate-400">{plan.name}</div>
                <div className="my-2 text-4xl font-black">
                  ${plan.price}
                  <span className="text-base font-normal text-slate-400">/mo</span>
                </div>
                <p className="mb-4 text-sm text-slate-400">{plan.blurb}</p>
                <ul className="mb-5 space-y-2 text-sm text-slate-300">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-brand-400">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className="btn-primary w-full">
                  Choose {plan.name}
                </Link>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t border-ink-line py-8 text-center text-sm text-slate-500">
        <p>
          © {new Date().getFullYear()} Bainsla Music Tags. Uses YouTube public data. Not affiliated
          with YouTube.
        </p>
        <p className="mt-2 flex justify-center gap-4 text-xs">
          <Link href="/support" className="hover:text-slate-300">
            Support
          </Link>
          <Link href="/privacy" className="hover:text-slate-300">
            Privacy Policy
          </Link>
        </p>
      </footer>
    </div>
  );
}
