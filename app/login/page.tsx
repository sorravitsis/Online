import Link from "next/link";
import { ClientErrorBoundary } from "@/components/client-error-boundary";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md animate-fade-in glass-card-elevated rounded-3xl p-8">
        <div className="space-y-4">
          <div className="wordmark">
            <span className="wordmark-badge">SiS</span>
            <span className="wordmark-text">Warehouse</span>
          </div>
          <h1 className="text-3xl font-bold text-brand-ink-900">
            Warehouse access
          </h1>
          <p className="text-sm text-brand-ink-500">
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

        <div className="mt-8 rounded-2xl border border-brand-ink-100 bg-brand-ink-50 p-4 text-sm text-brand-ink-600">
          <p>
            First run default password hash is seeded in Supabase. Change it
            from the admin page after setup.
          </p>
          <Link
            className="mt-3 inline-flex text-sm font-medium text-brand-red-600 transition hover:text-brand-red-700"
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
