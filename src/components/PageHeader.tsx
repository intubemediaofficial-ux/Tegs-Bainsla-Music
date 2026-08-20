export function PageHeader({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-600/35 via-ink-card/80 to-accent-cyan/15 p-5 shadow-xl shadow-brand-900/30 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <span className="text-3xl leading-none">{icon}</span>
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight text-slate-50 sm:text-3xl">
            {title}
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-300">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}
