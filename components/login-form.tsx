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
        headers: {
          "Content-Type": "application/json"
        },
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
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700" htmlFor="password">
          App password
        </label>
        <input
          autoComplete="current-password"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-brand-ink outline-none transition focus:border-brand-blue"
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter shared password"
          required
          type="password"
          value={password}
        />
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-brand-red">
          {error}
        </p>
      ) : null}

      <button
        className="w-full rounded-full bg-brand-red px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-200 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={isSubmitting}
        type="submit"
      >
        {isSubmitting ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
