"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

function mapLoginError(error?: string) {
  switch (error) {
    case "invalid_request":
      return "The login request could not be parsed. Try again.";
    case "invalid_password":
      return "The shared password is incorrect.";
    case "password_config_missing":
      return "The password hash is missing from app_config.";
    case "too_many_requests":
      return "Too many login attempts. Please wait a moment.";
    default:
      return error ?? "Unable to sign in.";
  }
}

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        setError(mapLoginError(json.error));
        return;
      }

      router.replace("/");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unexpected login error."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-8 pt-2" onSubmit={handleSubmit}>
      {/* Password field */}
      <div className="space-y-3">
        <label
          className="block text-[10px] font-black uppercase tracking-widest text-brand-ink-400"
          htmlFor="password"
        >
          Password
        </label>
        <div className="relative">
          <input
            autoComplete="current-password"
            className="w-full bg-brand-ink-50 border-none rounded-xl px-6 py-5 text-xl tracking-[0.4em] text-brand-ink-900 placeholder:text-brand-ink-200 placeholder:tracking-widest outline-none focus:ring-2 focus:ring-brand-red-100 transition-all duration-150"
            id="password"
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            type="password"
            value={password}
          />
          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
            <svg
              className="w-5 h-5 text-brand-ink-300"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Error */}
      {error ? (
        <p className="rounded-xl border border-brand-red-100 bg-brand-red-50 px-4 py-3 text-sm font-medium text-brand-red-700">
          {error}
        </p>
      ) : null}

      {/* Submit */}
      <button
        className="w-full bg-gradient-to-b from-brand-red-500 to-brand-red-700 text-white py-5 rounded-xl font-bold uppercase tracking-[0.2em] text-sm shadow-xl shadow-brand-red-200/40 hover:scale-[1.01] active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
