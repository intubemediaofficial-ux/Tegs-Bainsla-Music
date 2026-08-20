import { PLANS, isUnlimited, type PlanId } from "@/lib/plans";
import { FEATURES } from "@/lib/access";

const ORDER: PlanId[] = ["free", "starter", "creator", "unlimited", "admin"];

function fmt(n: number): string {
  return isUnlimited(n) ? "∞" : String(n);
}

export default function AdminPlansPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black">Plans &amp; limits</h1>
        <p className="mt-1 text-sm text-slate-400">
          These are the defaults every account inherits from its plan. Anything you type into a
          user&apos;s gen/res box in Users &amp; access wins over the plan.
        </p>
      </header>

      <section className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-2">Plan</th>
              <th>Price</th>
              <th>Generations / day</th>
              <th>Research / day</th>
              <th>Artist presets</th>
              <th>Max tags</th>
            </tr>
          </thead>
          <tbody>
            {ORDER.map((id) => {
              const p = PLANS[id];
              return (
                <tr key={id} className="border-t border-ink-line">
                  <td className="py-2">
                    <div className="font-semibold text-slate-100">{p.name}</div>
                    <div className="text-xs text-slate-500">{p.blurb}</div>
                  </td>
                  <td>{p.price ? `$${p.price}/mo` : "—"}</td>
                  <td>{fmt(p.limits.generations)}</td>
                  <td>{fmt(p.limits.research)}</td>
                  <td>{fmt(p.limits.artists)}</td>
                  <td>{p.limits.maxTags}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="card space-y-3 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          How the limits are decided
        </h2>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            <strong>Admin role</strong> — no limits at all and no feature can be switched off.
          </li>
          <li>
            <strong>Unlimited ∞ switch</strong> — daily generation and research caps are ignored
            for that user, whatever their plan says.
          </li>
          <li>
            <strong>Per-user override</strong> — a number typed in the gen/res box replaces the
            plan value for that user. Clear the box to fall back to the plan.
          </li>
          <li>
            <strong>Plan default</strong> — the table above.
          </li>
        </ol>
        <p className="text-xs text-slate-500">
          Counters reset at 00:00 UTC. Generations = Full Package, Tag Generator, Title Analyzer
          and extension reports. Research = Keyword Research, Rank Checker, Channel and Competitor
          tags.
        </p>
      </section>

      <section className="card space-y-3 text-sm text-slate-300">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          Feature switches (per user)
        </h2>
        <ul className="space-y-2">
          {FEATURES.map((f) => (
            <li key={f.id}>
              <span className="font-semibold text-slate-100">{f.label}</span>{" "}
              <span className="text-xs text-slate-500">— {f.hint}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500">
          A switched-off feature makes its API return 403 “disabled for your account”, so the
          matching page and extension call stop working for that user only.
        </p>
      </section>
    </div>
  );
}
