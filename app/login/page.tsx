import Link from "next/link";
import { ClientErrorBoundary } from "@/components/client-error-boundary";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-red-50 bg-white p-8 shadow-2xl shadow-red-100/60">
        <div className="space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="rounded-lg bg-brand-red px-2.5 py-1 text-sm font-black tracking-wide text-white shadow-sm shadow-red-200">
              SiS
            </span>
            <span className="text-2xl font-bold tracking-tight text-brand-ink">
              Warehouse
            </span>
          </div>
          <h1 className="text-3xl font-bold text-brand-ink">
            Warehouse access
          </h1>
          <p className="text-sm text-slate-500">
            Sign in with the shared app password to manage orders and print
            labels.
          </p>
        </div>

        <div className="mt-8">
          <ClientErrorBoundary
            description="The login form hit an unexpected runtime issue. Retry this screen before checking the password hash configuration."
            homeHref="/login"
            title="Login form needs recovery"
          >
            <LoginForm />
          </ClientErrorBoundary>
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
