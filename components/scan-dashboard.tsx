"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mapScanError, summarizeItems } from "@/lib/scan";
import type { OrderWithStore } from "@/lib/types";

type ScanResult =
  | { kind: "idle" }
  | { kind: "success"; awbNumber: string; order: OrderWithStore }
  | { kind: "error"; message: string };

export function ScanDashboard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [barcode, setBarcode] = useState("");
  const [activeOrder, setActiveOrder] = useState<OrderWithStore | null>(null);
  const [result, setResult] = useState<ScanResult>({ kind: "idle" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        router.push("/");
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (focusTimerRef.current) {
        clearTimeout(focusTimerRef.current);
      }
    };
  }, [router]);

  function refocusScannerInput() {
    if (focusTimerRef.current) {
      clearTimeout(focusTimerRef.current);
    }

    focusTimerRef.current = setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  }

  async function submitPrint(order: OrderWithStore) {
    setActiveOrder(order);
    setIsSubmitting(true);
    setResult({ kind: "idle" });

    try {
      const response = await fetch("/api/awb/single", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ orderId: order.id })
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        setResult({
          kind: "error",
          message: mapScanError(json.error)
        });
        return;
      }

      setResult({
        kind: "success",
        awbNumber: json.data.awbNumber as string,
        order
      });
      setBarcode("");
    } catch (error) {
      setResult({
        kind: "error",
        message: error instanceof Error ? error.message : "Unexpected scan error."
      });
    } finally {
      setIsSubmitting(false);
      refocusScannerInput();
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!barcode.trim()) {
      return;
    }

    setIsSubmitting(true);
    setActiveOrder(null);
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

      const order = lookupJson.data.orders[0] as OrderWithStore;
      await submitPrint(order);
    } catch (error) {
      setResult({
        kind: "error",
        message: error instanceof Error ? error.message : "Unexpected scan error."
      });
    } finally {
      setIsSubmitting(false);
      refocusScannerInput();
    }
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center px-6 py-12"
      onClick={refocusScannerInput}
    >
      <section className="w-full max-w-3xl rounded-3xl border bg-white/85 p-8 shadow-xl shadow-slate-200/60 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-steel/70">
              Scan Mode
            </p>
            <h1 className="text-3xl font-semibold text-brand-ink">
              Barcode to print
            </h1>
            <p className="text-sm text-slate-600">
              Keep the scanner pointed at the hidden capture field. Enter from
              the scanner will trigger lookup and the 1:1 print path automatically.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50"
          >
            Back
          </Link>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            aria-label="Scanner input"
            autoCapitalize="off"
            autoCorrect="off"
            className="pointer-events-none absolute left-[-9999px] top-auto h-px w-px opacity-0"
            onBlur={refocusScannerInput}
            onChange={(event) => setBarcode(event.target.value)}
            value={barcode}
          />

          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/80 p-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-steel/60">
              Scanner capture
            </p>
            <p className="mt-3 text-4xl font-semibold tracking-[0.2em] text-brand-ink">
              {barcode || "READY"}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Click anywhere on the page to refocus the scanner. Press
              <span className="mx-1 rounded bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
                Esc
              </span>
              to return to the dashboard.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-full bg-brand-blue px-5 py-3 text-sm font-medium text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
              disabled={isSubmitting || !barcode.trim()}
              type="submit"
            >
              {isSubmitting ? "Printing..." : "Print AWB"}
            </button>
            <button
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() => {
                setBarcode("");
                setActiveOrder(null);
                setResult({ kind: "idle" });
                refocusScannerInput();
              }}
              type="button"
            >
              Clear
            </button>
            {activeOrder && result.kind === "error" ? (
              <button
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting}
                onClick={() => void submitPrint(activeOrder)}
                type="button"
              >
                Retry print
              </button>
            ) : null}
          </div>
        </form>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-2xl border bg-slate-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-steel/60">
              Order preview
            </p>
            {activeOrder ? (
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Order
                  </p>
                  <p className="mt-1 text-base font-semibold text-brand-ink">
                    {activeOrder.platform_order_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Store
                  </p>
                  <p className="mt-1">{activeOrder.store?.name ?? "Unknown store"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Buyer
                  </p>
                  <p className="mt-1">{activeOrder.buyer_name ?? "-"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Items
                  </p>
                  <p className="mt-1">{summarizeItems(activeOrder.items_json)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                    Current status
                  </p>
                  <p className="mt-1 capitalize">{activeOrder.awb_status}</p>
                </div>
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Scan a barcode to preview the order before print executes.
              </p>
            )}
          </div>

          <div className="rounded-2xl border bg-slate-50 p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-steel/60">
              Print status
            </p>

            {result.kind === "idle" ? (
              <p className="mt-4 text-sm text-slate-500">
                Ready for the next scan. Press Enter on the scanner to submit.
              </p>
            ) : null}

            {result.kind === "success" ? (
              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                <p className="text-sm font-medium text-brand-green">
                  Print succeeded. AWB: {result.awbNumber}
                </p>
                <p className="mt-2 text-sm text-emerald-800">
                  {result.order.platform_order_id} is ready for packing.
                </p>
              </div>
            ) : null}

            {result.kind === "error" ? (
              <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4">
                <p className="text-sm font-medium text-brand-red">{result.message}</p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
