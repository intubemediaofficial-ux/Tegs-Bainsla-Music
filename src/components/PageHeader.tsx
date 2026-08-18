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
    <div className="rounded-2xl border border-ink-line bg-gradient-to-br from-brand-600/20 via-ink-card to-ink-card p-5">
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
