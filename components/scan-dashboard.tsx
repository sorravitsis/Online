"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { readJsonResponse } from "@/lib/http";
import { extractOrderItems, mapScanError, mapScanSuccess } from "@/lib/scan";
import type { OrderWithStore, StoreRow } from "@/lib/types";

type ScanMode = "single" | "bulk";

type QueuedOrder = {
  order: OrderWithStore;
  printStatus: "queued" | "printing" | "printed" | "failed" | "printer_queue";
  awbNumber?: string;
  error?: string;
};

type SingleResult =
  | { kind: "idle" }
  | { kind: "success"; awbNumber: string; order: OrderWithStore; status: "printed" | "queued" }
  | { kind: "already_printed"; order: OrderWithStore; awbNumber?: string }
  | { kind: "locked"; order: OrderWithStore }
  | { kind: "error"; message: string };

type ScanDashboardProps = {
  stores: StoreRow[];
};

export function ScanDashboard({ stores }: ScanDashboardProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = useState<ScanMode>("single");
  const [barcode, setBarcode] = useState("");
  const [selectedStoreId, setSelectedStoreId] = useState<string>("all");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Single mode state
  const [activeOrder, setActiveOrder] = useState<OrderWithStore | null>(null);
  const [singleResult, setSingleResult] = useState<SingleResult>({ kind: "idle" });

  // Bulk mode state
  const [queue, setQueue] = useState<QueuedOrder[]>([]);
  const [bulkDone, setBulkDone] = useState(false);

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
      if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    };
  }, [router]);

  function refocusScannerInput() {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  }

  function switchMode(next: ScanMode) {
    setMode(next);
    setBarcode("");
    setActiveOrder(null);
    setSingleResult({ kind: "idle" });
    setQueue([]);
    setBulkDone(false);
    refocusScannerInput();
  }

  // ── lookup order by barcode ────────────────────────────────────────────────
  async function lookupOrder(barcodeValue: string): Promise<OrderWithStore | null> {
    const params = new URLSearchParams({
      barcode: barcodeValue.trim(),
      limit: "1"
    });
    if (selectedStoreId !== "all") {
      params.set("store_id", selectedStoreId);
    }
    const res = await fetch(`/api/orders?${params.toString()}`);
    const json = await readJsonResponse<{
      success: boolean;
      data?: { orders?: OrderWithStore[] };
      error?: string;
    }>(res);
    if (!json.success || !json.data?.orders?.[0]) return null;
    return json.data.orders[0] as OrderWithStore;
  }

  // ── Single mode: scan → immediate print ───────────────────────────────────
  async function submitSinglePrint(order: OrderWithStore) {
    setActiveOrder(order);
    setIsSubmitting(true);
    setSingleResult({ kind: "idle" });

    try {
      const response = await fetch("/api/awb/single", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id })
      });
      const json = await readJsonResponse<{
        success: boolean;
        data?: { awbNumber?: string; status?: "printed" | "queued" };
        error?: string;
      }>(response);

      if (!response.ok || !json.success) {
        setSingleResult({ kind: "error", message: mapScanError(json.error) });
        return;
      }
      const awbNumber = json.data?.awbNumber;
      if (!awbNumber) {
        setSingleResult({ kind: "error", message: "The print API did not return an AWB number." });
        return;
      }
      setSingleResult({ kind: "success", awbNumber, order, status: json.data?.status ?? "printed" });
      setBarcode("");
    } catch (error) {
      setSingleResult({ kind: "error", message: error instanceof Error ? error.message : "Unexpected scan error." });
    } finally {
      setIsSubmitting(false);
      refocusScannerInput();
    }
  }

  // ── Bulk mode: scan → add to queue ────────────────────────────────────────
  async function addToQueue(barcodeValue: string) {
    setIsSubmitting(true);
    try {
      const order = await lookupOrder(barcodeValue);
      if (!order) {
        // flash error briefly in barcode area — keep queue intact
        setBarcode("NOT FOUND");
        setTimeout(() => setBarcode(""), 1000);
        return;
      }

      // block non-printable statuses
      if (order.awb_status === "printed") {
        setBarcode("ALREADY PRINTED");
        setTimeout(() => setBarcode(""), 1500);
        return;
      }
      if (order.awb_status === "printing") {
        setBarcode("LOCKED");
        setTimeout(() => setBarcode(""), 1500);
        return;
      }

      // deduplicate
      if (queue.some((q) => q.order.id === order.id)) {
        setBarcode("ALREADY ADDED");
        setTimeout(() => setBarcode(""), 1000);
        return;
      }

      setQueue((prev) => [...prev, { order, printStatus: "queued" }]);
      setBarcode("");
      setBulkDone(false);
    } catch {
      setBarcode("ERROR");
      setTimeout(() => setBarcode(""), 1000);
    } finally {
      setIsSubmitting(false);
      refocusScannerInput();
    }
  }

  // ── Bulk mode: print all queued orders ────────────────────────────────────
  async function printAll() {
    const pendingIds = queue
      .filter((q) => q.printStatus === "queued")
      .map((q) => q.order.id);

    if (pendingIds.length === 0) return;

    setIsSubmitting(true);
    setQueue((prev) =>
      prev.map((q) =>
        q.printStatus === "queued" ? { ...q, printStatus: "printing" } : q
      )
    );

    try {
      const response = await fetch("/api/awb/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderIds: pendingIds })
      });
      const json = await readJsonResponse<{
        success: boolean;
        data?: {
          results?: { orderId: string; status: string; awbNumber?: string; error?: string }[];
        };
        error?: string;
      }>(response);

      if (!response.ok || !json.success) {
        setQueue((prev) =>
          prev.map((q) =>
            q.printStatus === "printing"
              ? { ...q, printStatus: "failed", error: json.error ?? "batch_failed" }
              : q
          )
        );
        return;
      }

      const results = json.data?.results ?? [];
      setQueue((prev) =>
        prev.map((q) => {
          const hit = results.find((r) => r.orderId === q.order.id);
          if (!hit) return q;
          if (hit.status === "printed") return { ...q, printStatus: "printed", awbNumber: hit.awbNumber };
          if (hit.status === "queued") return { ...q, printStatus: "printer_queue", awbNumber: hit.awbNumber };
          return { ...q, printStatus: "failed", error: hit.error };
        })
      );
      setBulkDone(true);
    } catch (error) {
      setQueue((prev) =>
        prev.map((q) =>
          q.printStatus === "printing"
            ? { ...q, printStatus: "failed", error: error instanceof Error ? error.message : "Unexpected error." }
            : q
        )
      );
    } finally {
      setIsSubmitting(false);
      refocusScannerInput();
    }
  }

  // ── Shared form submit ────────────────────────────────────────────────────
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!barcode.trim() || isSubmitting) return;

    if (mode === "bulk") {
      await addToQueue(barcode.trim());
      return;
    }

    setIsSubmitting(true);
    setActiveOrder(null);
    setSingleResult({ kind: "idle" });
    try {
      const order = await lookupOrder(barcode.trim());
      if (!order) {
        setSingleResult({ kind: "error", message: mapScanError("order_not_found") });
        return;
      }

      // Show order immediately so staff can see it
      setActiveOrder(order);

      if (order.awb_status === "printed") {
        setSingleResult({ kind: "already_printed", order, awbNumber: order.awb_number ?? undefined });
        setBarcode("");
        return;
      }

      if (order.awb_status === "printing") {
        setSingleResult({ kind: "locked", order });
        setBarcode("");
        return;
      }

      await submitSinglePrint(order);
    } catch (error) {
      setSingleResult({ kind: "error", message: error instanceof Error ? error.message : "Unexpected scan error." });
    } finally {
      setIsSubmitting(false);
      refocusScannerInput();
    }
  }

  const queuedCount = queue.filter((q) => q.printStatus === "queued").length;
  const printedCount = queue.filter((q) => q.printStatus === "printed" || q.printStatus === "printer_queue").length;
  const failedCount = queue.filter((q) => q.printStatus === "failed").length;

  return (
    <main
      className="flex min-h-screen items-start justify-center px-6 py-12"
      onClick={refocusScannerInput}
    >
      <section className="w-full max-w-3xl rounded-3xl border border-red-50 bg-white p-8 shadow-2xl shadow-red-100/40">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="rounded-lg bg-brand-red px-2.5 py-1 text-sm font-black tracking-wide text-white shadow-sm shadow-red-200">
                SiS
              </span>
              <span className="text-2xl font-bold tracking-tight text-brand-ink">Warehouse</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-ink">Scan to print</h1>
          </div>
          <Link
            href="/"
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50"
          >
            Back
          </Link>
        </div>

        {/* Mode toggle */}
        <div className="mt-6 flex gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => switchMode("single")}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
              mode === "single"
                ? "bg-white text-brand-ink shadow-sm"
                : "text-slate-500 hover:text-brand-ink"
            }`}
          >
            1:1 — Print each scan
          </button>
          <button
            type="button"
            onClick={() => switchMode("bulk")}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
              mode === "bulk"
                ? "bg-white text-brand-ink shadow-sm"
                : "text-slate-500 hover:text-brand-ink"
            }`}
          >
            Bulk — Queue then print
          </button>
        </div>

        {/* Store filter */}
        {stores.length > 1 && (
          <div className="mt-4 flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 shrink-0">
              Store
            </label>
            <select
              className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-brand-ink focus:outline-none focus:ring-2 focus:ring-brand-red/30"
              value={selectedStoreId}
              onChange={(e) => {
                setSelectedStoreId(e.target.value);
                refocusScannerInput();
              }}
            >
              <option value="all">All stores</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                  {" "}
                  <span className="capitalize">({store.platform})</span>
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Scanner capture form */}
        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
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
              {barcode || (mode === "bulk" ? `QUEUE (${queue.length})` : "READY")}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              {mode === "bulk"
                ? "Scan orders to add to queue. Press Enter after each scan."
                : "Scan to preview and print. Press Enter to submit."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {mode === "single" ? (
              <>
                <button
                  className="rounded-full bg-brand-red px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-200 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                  disabled={isSubmitting || !barcode.trim()}
                  type="submit"
                >
                  {isSubmitting ? "Printing…" : "Print AWB"}
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50"
                  onClick={() => {
                    setBarcode("");
                    setActiveOrder(null);
                    setSingleResult({ kind: "idle" });
                    refocusScannerInput();
                  }}
                >
                  Clear
                </button>
                {activeOrder && singleResult.kind === "error" ? (
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isSubmitting}
                    onClick={() => void submitSinglePrint(activeOrder)}
                  >
                    Retry print
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <button
                  className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isSubmitting || !barcode.trim()}
                  type="submit"
                >
                  {isSubmitting && barcode.trim() ? "Looking up…" : "Add to queue"}
                </button>
                <button
                  type="button"
                  className="rounded-full bg-brand-red px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-200 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                  disabled={isSubmitting || queuedCount === 0}
                  onClick={() => void printAll()}
                >
                  {isSubmitting && queuedCount === 0 ? "Printing…" : `Print All (${queuedCount})`}
                </button>
                {queue.length > 0 ? (
                  <button
                    type="button"
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:bg-slate-50"
                    disabled={isSubmitting}
                    onClick={() => {
                      setQueue([]);
                      setBulkDone(false);
                      refocusScannerInput();
                    }}
                  >
                    Clear queue
                  </button>
                ) : null}
              </>
            )}
          </div>
        </form>

        {/* ── Single mode panels ──────────────────────────────────────────── */}
        {mode === "single" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            {/* Order preview */}
            <div className="rounded-2xl border bg-slate-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-steel/60">
                Order preview
              </p>
              {activeOrder ? (
                <div className="mt-4 space-y-3 text-sm text-slate-600">
                  {/* Prominent status badge */}
                  <div>
                    {activeOrder.awb_status === "pending" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Ready to print
                      </span>
                    )}
                    {activeOrder.awb_status === "printed" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        Already printed
                      </span>
                    )}
                    {activeOrder.awb_status === "printing" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
                        Printing / Locked
                      </span>
                    )}
                    {activeOrder.awb_status === "failed" && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-brand-red">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-red" />
                        Print failed — retry available
                      </span>
                    )}
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Order</p>
                    <p className="mt-1 text-base font-semibold text-brand-ink">
                      {activeOrder.platform_order_id}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Store</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${
                          activeOrder.store?.platform === "lazada"
                            ? "bg-orange-100 text-orange-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {activeOrder.store?.platform ?? "unknown"}
                      </span>
                      <span>{activeOrder.store?.name ?? "Unknown store"}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Buyer</p>
                    <p className="mt-1">{activeOrder.buyer_name ?? "-"}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Items ({Array.isArray(activeOrder.items_json) ? activeOrder.items_json.length : 0})
                    </p>
                    {(() => {
                      const items = extractOrderItems(activeOrder.items_json);
                      const rtsItems = items.filter((item) => item.trackingCode ?? item.packageId);
                      if (items.length === 0) {
                        return <p className="mt-1 text-slate-400">No item details</p>;
                      }
                      return (
                        <div className="mt-1 space-y-1">
                          {items.map((item, i) => (
                            <div key={i} className="flex items-start justify-between gap-2">
                              <span className="text-brand-ink">{item.name}</span>
                              <span className="shrink-0 text-slate-400">×{item.qty}</span>
                            </div>
                          ))}
                          {rtsItems.length > 0 && (
                            <p className="mt-2 text-xs font-medium text-emerald-600">
                              RTS · {rtsItems[0]?.trackingCode ?? rtsItems[0]?.packageId}
                            </p>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-500">
                  Scan a barcode or platform order ID to preview the order.
                </p>
              )}
            </div>

            {/* Print status */}
            <div className="rounded-2xl border bg-slate-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-steel/60">
                Print status
              </p>

              {singleResult.kind === "idle" && (
                <p className="mt-4 text-sm text-slate-500">
                  Ready for the next scan. Press Enter on the scanner to submit.
                </p>
              )}

              {singleResult.kind === "success" && (
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-700">
                    {mapScanSuccess(singleResult.status, singleResult.awbNumber)}
                  </p>
                  <p className="mt-2 text-sm text-emerald-800">
                    {singleResult.status === "queued"
                      ? `${singleResult.order.platform_order_id} is waiting for the local printer agent.`
                      : `${singleResult.order.platform_order_id} is ready for packing.`}
                  </p>
                </div>
              )}

              {singleResult.kind === "already_printed" && (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-700">AWB already printed</p>
                  <p className="mt-1 text-sm text-blue-700">
                    {singleResult.order.platform_order_id} was printed earlier.
                  </p>
                  {singleResult.awbNumber && (
                    <p className="mt-2 font-mono text-xs font-medium text-blue-600">
                      AWB: {singleResult.awbNumber}
                    </p>
                  )}
                  <button
                    type="button"
                    className="mt-3 rounded-full border border-blue-200 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
                    disabled={isSubmitting}
                    onClick={() => void submitSinglePrint(singleResult.order)}
                  >
                    Force reprint
                  </button>
                </div>
              )}

              {singleResult.kind === "locked" && (
                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-700">Order is locked</p>
                  <p className="mt-1 text-sm text-amber-700">
                    {singleResult.order.platform_order_id} is currently being printed by another session. Wait a moment and scan again.
                  </p>
                </div>
              )}

              {singleResult.kind === "error" && (
                <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-brand-red">{singleResult.message}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Bulk mode queue ─────────────────────────────────────────────── */}
        {mode === "bulk" && (
          <div className="mt-6">
            {/* Summary bar when done */}
            {bulkDone && (
              <div className="mb-4 flex gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-3 text-sm">
                <span className="font-semibold text-emerald-700">Batch done</span>
                {printedCount > 0 && (
                  <span className="text-emerald-700">{printedCount} printed</span>
                )}
                {failedCount > 0 && (
                  <span className="font-semibold text-brand-red">{failedCount} failed</span>
                )}
              </div>
            )}

            {queue.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
                <p className="text-sm text-slate-500">
                  Queue is empty. Scan orders to add them here, then press <strong>Print All</strong>.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Order
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Buyer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        AWB
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Status
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {queue.map((q) => (
                      <tr key={q.order.id} className="bg-white">
                        <td className="px-4 py-3 font-medium text-brand-ink">
                          {q.order.platform_order_id}
                          <span
                            className={`ml-2 rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${
                              q.order.store?.platform === "lazada"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-blue-100 text-blue-700"
                            }`}
                          >
                            {q.order.store?.platform ?? "?"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {q.order.buyer_name ?? "-"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {q.awbNumber ?? "-"}
                        </td>
                        <td className="px-4 py-3">
                          {q.printStatus === "queued" && (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                              Queued
                            </span>
                          )}
                          {q.printStatus === "printing" && (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-600">
                              Printing…
                            </span>
                          )}
                          {q.printStatus === "printed" && (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-600">
                              Printed
                            </span>
                          )}
                          {q.printStatus === "printer_queue" && (
                            <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-600">
                              Printer queue
                            </span>
                          )}
                          {q.printStatus === "failed" && (
                            <span
                              className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-brand-red"
                              title={q.error}
                            >
                              Failed
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {q.printStatus === "queued" && (
                            <button
                              type="button"
                              className="text-xs text-slate-400 hover:text-brand-red"
                              onClick={() => {
                                setQueue((prev) => prev.filter((x) => x.order.id !== q.order.id));
                                refocusScannerInput();
                              }}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
