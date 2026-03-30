"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type ScanResult =
  | { kind: "idle" }
  | { kind: "success"; awbNumber: string }
  | { kind: "error"; message: string };

export default function ScanPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<ScanResult>({ kind: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!barcode.trim()) {
      return;
    }

    setIsSubmitting(true);
    setResult({ kind: "idle" });

    try {
      const orderLookup = await fetch(
        `/api/orders?barcode=${encodeURIComponent(barcode.trim())}&limit=1`
      );
      const lookupJson = await orderLookup.json();

      if (!lookupJson.success || !lookupJson.data?.orders?.[0]) {
        setResult({ kind: "error", message: "Order not found for barcode." });
        return;
      }

      const orderId = lookupJson.data.orders[0].id as string;
      const response = await fetch("/api/awb/single", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ orderId })
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        setResult({
          kind: "error",
          message: json.error ?? "Print failed. Please retry."
        });
        return;
      }

      setResult({
        kind: "success",
        awbNumber: json.data.awbNumber as string
      });
      setBarcode("");
    } catch (error) {
      setResult({
        kind: "error",
        message:
          error instanceof Error ? error.message : "Unexpected scan error."
      });
    } finally {
      setIsSubmitting(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-2xl rounded-3xl border bg-white/85 p-8 shadow-xl shadow-slate-200/60 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-steel/70">
              Scan Mode
            </p>
            <h1 className="text-3xl font-semibold text-brand-ink">
              Barcode to print
            </h1>
            <p className="text-sm text-slate-600">
              Scan a barcode and this page will look up the order, acquire a
              lock, and trigger the 1:1 AWB print path.
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
            Barcode value
          </label>
          <input
            ref={inputRef}
            value={barcode}
            onChange={(event) => setBarcode(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-brand-ink outline-none ring-0 transition focus:border-brand-blue"
            placeholder="Scan barcode here"
          />

          <button
            className="rounded-full bg-brand-blue px-5 py-3 text-sm font-medium text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "Printing..." : "Print AWB"}
          </button>
        </form>

        <div className="mt-6 rounded-2xl border bg-slate-50 p-5">
          {result.kind === "idle" ? (
            <p className="text-sm text-slate-500">
              Ready for the next scan. Press Enter on the scanner to submit.
            </p>
          ) : null}

          {result.kind === "success" ? (
            <p className="text-sm font-medium text-brand-green">
              Print succeeded. AWB: {result.awbNumber}
            </p>
          ) : null}

          {result.kind === "error" ? (
            <p className="text-sm font-medium text-brand-red">{result.message}</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
