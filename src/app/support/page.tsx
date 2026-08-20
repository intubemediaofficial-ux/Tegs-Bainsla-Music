import Link from "next/link";

export const metadata = {
  title: "Support — Bainsla Music Tags",
  description:
    "Get help with the Bainsla Music Tags dashboard, Chrome extension, API key, YouTube channel connection or your account.",
};

const EMAIL = "intubemediaofficial@gmail.com";

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-slate-200">
      <Link href="/" className="text-xs text-brand-400">
        ← Back to Bainsla Music Tags
      </Link>
      <h1 className="mt-4 text-3xl font-black text-white">
        Bainsla Music Tags <span className="grad-text">Support</span>
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        Need help with Bainsla Music Tags, the Chrome extension, your account, API key, YouTube
        connection, billing, or another feature?
      </p>

      <Section title="Support email">
        <p>
          <a className="text-brand-400 underline" href={`mailto:${EMAIL}`}>
            {EMAIL}
          </a>
        </p>
        <p>We aim to respond to support requests as soon as possible.</p>
      </Section>

      <Section title="When contacting support, please include">
        <ul className="list-disc space-y-1 pl-5">
          <li>Your registered email address</li>
          <li>A brief description of the issue</li>
          <li>Screenshot of the error, if applicable</li>
          <li>Chrome version and extension version, if the issue is related to the extension</li>
        </ul>
      </Section>

      <Section title="Common help">
        <ul className="list-disc space-y-1 pl-5">
          <li>Extension not working on YouTube</li>
          <li>API key or account connection issues</li>
          <li>Google / YouTube channel connection</li>
          <li>Tags, rankings or analytics questions</li>
          <li>Account or subscription issues</li>
          <li>Privacy or account deletion requests</li>
        </ul>
      </Section>

      <Section title="Privacy">
        <p>
          <Link className="text-brand-400 underline" href="/privacy">
            https://tag.bainslamusic.com/privacy
          </Link>
        </p>
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
