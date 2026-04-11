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
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-brand-ink-700" htmlFor="password">
          App password
        </label>
        <input
          autoComplete="current-password"
          className="input-field"
          id="password"
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter shared password"
          required
          type="password"
          value={password}
        />
      </div>

      {error ? (
        <p className="rounded-xl border border-brand-red-100 bg-brand-red-50 px-4 py-3 text-sm font-medium text-brand-red-700">
          {error}
        </p>
      ) : null}

      <button className="btn-primary w-full" disabled={isSubmitting} type="submit">
        {isSubmitting ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
