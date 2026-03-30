"use client";

import Link from "next/link";

type RouteErrorViewProps = {
  title: string;
  description: string;
  digest?: string;
  homeHref?: string;
  reset: () => void;
};

export function RouteErrorView({
  title,
  description,
  digest,
  homeHref = "/",
  reset
}: RouteErrorViewProps) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-2xl rounded-3xl border border-red-100 bg-white/90 p-8 shadow-xl shadow-red-100/40 backdrop-blur">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-red/80">
          Route Error
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-brand-ink">{title}</h1>
        <p className="mt-3 text-sm text-slate-600">{description}</p>
        {digest ? (
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-400">
            Error digest {digest}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded-full bg-brand-ink px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800"
            onClick={reset}
            type="button"
          >
            Retry route
          </button>
          <Link
            className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50"
            href={homeHref}
          >
            Back to dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
