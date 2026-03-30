type PageSkeletonProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PageSkeleton({
  eyebrow,
  title,
  description
}: PageSkeletonProps) {
  return (
    <main className="min-h-screen animate-pulse px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-3xl border bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
          <div className="h-4 w-32 rounded-full bg-slate-200" />
          <div className="mt-4 h-10 w-80 rounded-2xl bg-slate-200" />
          <div className="mt-3 h-4 w-[32rem] max-w-full rounded-full bg-slate-100" />
          <div className="mt-2 h-4 w-72 rounded-full bg-slate-100" />
          <div className="mt-8 flex flex-wrap gap-3">
            <div className="h-11 w-32 rounded-full bg-slate-200" />
            <div className="h-11 w-32 rounded-full bg-slate-100" />
          </div>
        </section>

        <section className="rounded-3xl border bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-steel/60">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-brand-ink">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">{description}</p>

          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            <div className="h-14 rounded-2xl bg-slate-100" />
            <div className="h-14 rounded-2xl bg-slate-100" />
            <div className="h-14 rounded-2xl bg-slate-100" />
          </div>

          <div className="mt-6 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-16 rounded-2xl border border-slate-100 bg-slate-50"
              />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
