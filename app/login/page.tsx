import Link from "next/link";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-white/50 bg-white/85 p-8 shadow-xl shadow-slate-200/70 backdrop-blur">
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-steel/70">
            Unified AWB Platform
          </p>
          <h1 className="text-3xl font-semibold text-brand-ink">
            Warehouse access
          </h1>
          <p className="text-sm text-slate-600">
            Sign in with the shared app password to manage orders and print
            labels.
          </p>
        </div>

        <div className="mt-8">
          <LoginForm />
        </div>

        <div className="mt-8 rounded-2xl border bg-slate-50/80 p-4 text-sm text-slate-600">
          <p>
            First run default password hash is seeded in Supabase. Change it
            from the admin page after setup.
          </p>
          <Link
            className="mt-3 inline-flex text-sm font-medium text-brand-blue hover:text-blue-700"
            href="https://n8n.nongkoko.cloud"
            target="_blank"
          >
            Open n8n dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
