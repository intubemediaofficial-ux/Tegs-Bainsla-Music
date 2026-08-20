import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Bainsla Music Tags",
  description:
    "What the Bainsla Music Tags dashboard and Chrome extension store, and how connected YouTube channel data is used.",
};

const UPDATED = "18 August 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-slate-200">
      <Link href="/" className="text-xs text-brand-400">
        ← Back to Bainsla Music Tags
      </Link>
      <h1 className="mt-4 text-3xl font-black text-white">
        Privacy <span className="grad-text">Policy</span>
      </h1>
      <p className="mt-1 text-xs text-slate-500">Last updated: {UPDATED}</p>

      <Section title="Who we are">
        Bainsla Music Tags (“the service”) is a YouTube SEO dashboard at{" "}
        <span className="text-slate-100">tag.bainslamusic.com</span> with an optional Chrome
        extension that shows the same research while you browse YouTube.
      </Section>

      <Section title="What we store">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Account data:</b> your name, email, a hashed password, plan and daily usage counters.
          </li>
          <li>
            <b>Your saved work:</b> artist presets and the keywords you research, so results can be
            reused.
          </li>
          <li>
            <b>Public YouTube data:</b> titles, tags, view counts, thumbnails and channel stats
            fetched from the public YouTube Data API, cached to save quota. This is the same data
            anyone can see on YouTube.
          </li>
          <li>
            <b>API key:</b> a key you can regenerate at any time, used only to link the extension to
            your account.
          </li>
        </ul>
      </Section>

      <Section title="If you connect your YouTube channel">
        Connecting is optional. When you sign in with Google we request read-only access (
        <span className="font-mono text-xs">yt-analytics.readonly</span>,{" "}
        <span className="font-mono text-xs">youtube.readonly</span>) and we store a refresh token on
        our server so we can load analytics for <b>the channel you connected and nothing else</b>.
        We use it only to show you your own numbers — views, watch time, average viewed percentage,
        subscribers gained, traffic sources and the search terms bringing you views. We never post,
        edit, delete or upload anything on your channel, and we never sell or share this data. Google
        user data is not used for advertising or transferred to third parties, and it is not used to
        train any model.
        <p className="mt-2">
          You can disconnect at any time from{" "}
          <span className="text-slate-100">Settings → My YouTube channel → Disconnect</span>, which
          deletes the stored token immediately, or revoke access from your{" "}
          <a
            className="text-brand-400 underline"
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noreferrer"
          >
            Google account permissions
          </a>
          .
        </p>
      </Section>

      <Section title="What the extension does on YouTube">
        The extension reads the video id of the page you are on so it can request that video&apos;s
        public stats and your own analytics if you own it. It does not read your YouTube password,
        does not track your browsing on other sites, and stores only your dashboard address and API
        key in Chrome&apos;s extension storage.
      </Section>

      <Section title="Retention and deletion">
        Sampled public view counts are kept for eight days to draw the short-term trend graph.
        Account data stays until you ask for deletion — email{" "}
        <span className="text-slate-100">intubemediaofficial@gmail.com</span> and we remove your
        account, tokens and saved research.
      </Section>

      <Section title="Contact">
        Questions about this policy: <span className="text-slate-100">intubemediaofficial@gmail.com</span>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card mt-5">
      <h2 className="mb-2 text-lg font-bold text-brand-200">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}
