"use client";

import { useState } from "react";
import Link from "next/link";

export default function BatchPage() {
  const [payload, setPayload] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const orderIds = payload
      .split(/\r?\n|,/)
      .map((value) => value.trim())
      .filter(Boolean);

    if (orderIds.length === 0) {
      setMessage("Add at least one order ID.");
      return;
    }

    setIsSubmitting(true);
    setMessage("Starting batch print...");

    try {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const response = await fetch("/api/awb/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ orderIds })
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        setMessage(json.error ?? "Batch print failed.");
        return;
      }

      const printed = (json.data.results as Array<{ status: string }>).filter(
        (entry) => entry.status === "printed"
      ).length;
      const failed = (json.data.results as Array<{ status: string }>).length - printed;
      setMessage(`Batch finished. ${printed} printed, ${failed} failed.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Batch print failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-2xl rounded-3xl border bg-white/85 p-8 shadow-xl shadow-slate-200/60 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-steel/70">
              Batch Print
            </p>
            <h1 className="text-3xl font-semibold text-brand-ink">
              Sequential batch execution
            </h1>
            <p className="text-sm text-slate-600">
              This first implementation reuses the same backend print pipeline and
              keeps execution sequential for safety.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50"
          >
            Back
          </Link>
        </div>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-700">
            Order IDs
          </label>
          <textarea
            className="min-h-40 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-brand-ink outline-none transition focus:border-brand-blue"
            onChange={(event) => setPayload(event.target.value)}
            placeholder="Paste one order ID per line"
            value={payload}
          />

          <button
            className="rounded-full bg-brand-amber px-5 py-3 text-sm font-medium text-white shadow-lg shadow-amber-200 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Processing..." : "Print Selected"}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border bg-slate-50 p-5 text-sm text-slate-600">
          {message ?? "A 2-second countdown happens before the request is sent."}
        </div>
      </section>
    </main>
  );
}
