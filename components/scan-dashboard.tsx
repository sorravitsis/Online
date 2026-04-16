"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
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

type StoresApiResponse = {
  success: boolean;
  data?: {
    stores: StoreRow[];
  };
  error?: string;
};

const FILTER_ALL = "all" as const;

function formatStoreLabel(store: StoreRow) {
  return store.name;
}

function checkQueueEligibility(order: OrderWithStore, queue: QueuedOrder[]): string | null {
  if (order.awb_status === "printed") return "ALREADY PRINTED";
  if (order.awb_status === "printing") return "LOCKED";
  if (queue.some((q) => q.order.id === order.id)) return "ALREADY ADDED";
  return null;
}

function applyBatchResults(
  queue: QueuedOrder[],
  results: { orderId: string; status: string; awbNumber?: string; error?: string }[]
): QueuedOrder[] {
  return queue.map((q) => {
    const hit = results.find((r) => r.orderId === q.order.id);
    if (!hit) return q;
    if (hit.status === "printed") return { ...q, printStatus: "printed", awbNumber: hit.awbNumber };
    if (hit.status === "queued") return { ...q, printStatus: "printer_queue", awbNumber: hit.awbNumber };
    return { ...q, printStatus: "failed", error: hit.error };
  });
}

function resolveSingleResultFromOrder(order: OrderWithStore): SingleResult | null {
  if (order.awb_status === "printed") {
    return { kind: "already_printed", order, awbNumber: order.awb_number ?? undefined };
  }
  if (order.awb_status === "printing") {
    return { kind: "locked", order };
  }
  return null;
}

export function ScanDashboard({ stores }: ScanDashboardProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [availableStores, setAvailableStores] = useState(stores);
  const [mode, setMode] = useState<ScanMode>("single");
  const [barcode, setBarcode] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState<"all" | "shopee" | "lazada">(FILTER_ALL);
  const [selectedStoreId, setSelectedStoreId] = useState<string>(FILTER_ALL);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Single mode state
  const [activeOrder, setActiveOrder] = useState<OrderWithStore | null>(null);
  const [singleResult, setSingleResult] = useState<SingleResult>({ kind: "idle" });

  // Bulk mode state
  const [queue, setQueue] = useState<QueuedOrder[]>([]);
  const [bulkDone, setBulkDone] = useState(false);

  useEffect(() => {
    setAvailableStores(stores);
  }, [stores]);

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

  useEffect(() => {
    let isActive = true;

    async function refreshStores() {
      try {
        const response = await fetch("/api/admin/stores", {
          cache: "no-store"
        });
        const json = (await response.json()) as StoresApiResponse;

        if (!response.ok || !json.success || !json.data || !isActive) {
          return;
        }

        setAvailableStores(json.data.stores);
      } catch (error) {
        console.error("Unable to refresh scan stores", error);
      }
    }

    void refreshStores();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshStores();
      }
    }, 15000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (
      selectedStoreId !== FILTER_ALL &&
      !availableStores.some((store) => store.id === selectedStoreId)
    ) {
      setSelectedStoreId(FILTER_ALL);
    }
  }, [availableStores, selectedStoreId]);

  const filteredStores = selectedPlatform === FILTER_ALL
    ? availableStores
    : availableStores.filter((s) => s.platform === selectedPlatform);

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
    if (selectedPlatform !== FILTER_ALL) {
      params.set("platform", selectedPlatform);
    }
    if (selectedStoreId !== FILTER_ALL) {
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
        setBarcode("NOT FOUND");
        setTimeout(() => setBarcode(""), 1000);
        return;
      }

      const ineligible = checkQueueEligibility(order, queue);
      if (ineligible) {
        setBarcode(ineligible);
        setTimeout(() => setBarcode(""), 1500);
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
      setQueue((prev) => applyBatchResults(prev, results));
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

      setActiveOrder(order);

      const earlyResult = resolveSingleResultFromOrder(order);
      if (earlyResult) {
        setSingleResult(earlyResult);
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
      className="relative flex min-h-screen items-start justify-center px-6 py-12 overflow-hidden"
      onClick={refocusScannerInput}
    >
      {/* Background — Xiaomi devices, full cover */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt=""
        aria-hidden="true"
        className="pointer-events-none select-none absolute inset-0 w-full h-full object-cover object-center opacity-[0.72] dark:opacity-[0.50]"
        src="/xiaomi_devices.png"
      />

      <section className="w-full max-w-3xl animate-fade-in glass-card-elevated rounded-3xl p-8 relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="wordmark">
              <span className="wordmark-badge text-[18px]">SiS</span>
              <span className="wordmark-text">Warehouse</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-ink-900">Scan to print</h1>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/" className="btn-secondary !px-4 !py-2 text-xs">
              Back
            </Link>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="mt-6 flex gap-1 rounded-2xl border border-brand-ink-100 bg-brand-ink-50 p-1">
          <button
            type="button"
            onClick={() => switchMode("single")}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              mode === "single"
                ? "bg-white text-brand-ink-900 shadow-card"
                : "text-brand-ink-400 hover:text-brand-ink-700"
            }`}
          >
            1:1 — Print each scan
          </button>
          <button
            type="button"
            onClick={() => switchMode("bulk")}
            className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
              mode === "bulk"
                ? "bg-white text-brand-ink-900 shadow-card"
                : "text-brand-ink-400 hover:text-brand-ink-700"
            }`}
          >
            Bulk — Queue then print
          </button>
        </div>

        {/* Platform + Store filters */}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="section-label shrink-0">Platform</label>
          <select
            className="input-field !py-2"
            value={selectedPlatform}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              setSelectedPlatform(e.target.value as "all" | "shopee" | "lazada");
              setSelectedStoreId(FILTER_ALL);
              refocusScannerInput();
            }}
          >
            <option value="all">All platforms</option>
            <option value="shopee">Shopee</option>
            <option value="lazada">Lazada</option>
          </select>

          {filteredStores.length > 1 && (
            <>
              <label className="section-label shrink-0">Store</label>
              <select
                className="input-field !py-2"
                value={selectedStoreId}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => {
                  setSelectedStoreId(e.target.value);
                  refocusScannerInput();
                }}
              >
                <option value="all">All stores</option>
                {filteredStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {formatStoreLabel(store)}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>

        {/* Scanner capture form */}
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            aria-label="Scanner input"
            autoCapitalize="off"
            autoCorrect="off"
            className="pointer-events-none absolute left-[-9999px] top-auto h-px w-px opacity-0"
            onChange={(event) => setBarcode(event.target.value)}
            value={barcode}
          />

          {/* Terminal-style scanner display */}
          <div className="relative overflow-hidden rounded-2xl border border-brand-ink-800 bg-brand-ink-950 p-6 text-center">
            <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_3px,rgba(255,255,255,0.018)_3px,rgba(255,255,255,0.018)_4px)]" />
            <p className="section-label text-brand-ink-500">Scanner capture</p>
            <p
              className={`mt-3 font-mono text-4xl font-bold tracking-[0.15em] transition-colors ${
                barcode ? "text-white" : "text-emerald-400"
              }`}
            >
              {barcode || (mode === "bulk" ? `QUEUE (${queue.length})` : "READY")}
            </p>
            <p className="mt-3 text-sm text-brand-ink-500">
              {mode === "bulk"
                ? "Scan orders to add to queue. Press Enter after each scan."
                : "Scan to preview and print. Press Enter to submit."}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            {mode === "single" ? (
              <>
                <button
                  className="btn-primary"
                  disabled={isSubmitting || !barcode.trim()}
                  type="submit"
                >
                  {isSubmitting ? "Printing…" : "Print AWB"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
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
                    className="btn-secondary disabled:opacity-60"
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
                  className="btn-secondary disabled:opacity-60"
                  disabled={isSubmitting || !barcode.trim()}
                  type="submit"
                >
                  {isSubmitting && barcode.trim() ? "Looking up…" : "Add to queue"}
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  disabled={isSubmitting || queuedCount === 0}
                  onClick={() => void printAll()}
                >
                  {isSubmitting && queuedCount === 0 ? "Printing…" : `Print All (${queuedCount})`}
                </button>
                {queue.length > 0 ? (
                  <button
                    type="button"
                    className="btn-secondary !text-brand-ink-400"
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
            <div className="glass-card rounded-2xl p-5">
              <p className="section-label">Order preview</p>
              {activeOrder ? (
                <div className="mt-4 space-y-3 text-sm text-brand-ink-600">
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
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red-100 px-3 py-1 text-xs font-semibold text-brand-red-600">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand-red-500" />
                        Print failed — retry available
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="section-label">Order</p>
                    <p className="mt-1 text-base font-semibold text-brand-ink-900">
                      {activeOrder.platform_order_id}
                    </p>
                  </div>
                  <div>
                    <p className="section-label">Store</p>
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
                      <span>
                        {activeOrder.store?.name ?? "Unknown store"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <p className="section-label">Buyer</p>
                    <p className="mt-1">{activeOrder.buyer_name ?? "-"}</p>
                  </div>
                  <div>
                    <p className="section-label">
                      Items ({Array.isArray(activeOrder.items_json) ? activeOrder.items_json.length : 0})
                    </p>
                    {(() => {
                      const items = extractOrderItems(activeOrder.items_json);
                      const rtsItems = items.filter((item) => item.trackingCode ?? item.packageId);
                      if (items.length === 0) {
                        return <p className="mt-1 text-brand-ink-400">No item details</p>;
                      }
                      return (
                        <div className="mt-1 space-y-1">
                          {items.map((item, i) => (
                            <div key={i} className="flex items-start justify-between gap-2">
                              <span className="text-brand-ink-900">{item.name}</span>
                              <span className="shrink-0 text-brand-ink-400">×{item.qty}</span>
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
                <p className="mt-4 text-sm text-brand-ink-400">
                  Scan a barcode or platform order ID to preview the order.
                </p>
              )}
            </div>

            {/* Print status */}
            <div className="glass-card rounded-2xl p-5">
              <p className="section-label">Print status</p>

              {singleResult.kind === "idle" && (
                <p className="mt-4 text-sm text-brand-ink-400">
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
                <div className="mt-4 rounded-2xl border border-brand-red-100 bg-brand-red-50 p-4">
                  <p className="text-sm font-semibold text-brand-red-600">{singleResult.message}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Bulk mode queue ─────────────────────────────────────────────── */}
        {mode === "bulk" && (
          <div className="mt-6">
            {bulkDone && (
              <div className="mb-4 flex gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-5 py-3 text-sm">
                <span className="font-semibold text-emerald-700">Batch done</span>
                {printedCount > 0 && (
                  <span className="text-emerald-700">{printedCount} printed</span>
                )}
                {failedCount > 0 && (
                  <span className="font-semibold text-brand-red-600">{failedCount} failed</span>
                )}
              </div>
            )}

            {queue.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-brand-ink-200 bg-brand-ink-50 p-8 text-center">
                <p className="text-sm text-brand-ink-400">
                  Queue is empty. Scan orders to add them here, then press{" "}
                  <strong className="text-brand-ink-700">Print All</strong>.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border border-brand-ink-200">
                <table className="w-full text-sm">
                  <thead className="bg-brand-ink-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink-400">
                        Order
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink-400">
                        Buyer
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink-400">
                        AWB
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.18em] text-brand-ink-400">
                        Status
                      </th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-ink-100">
                    {queue.map((q) => (
                      <tr key={q.order.id} className="bg-white transition-colors hover:bg-brand-ink-50">
                        <td className="px-4 py-3 font-medium text-brand-ink-900">
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
                        <td className="px-4 py-3 text-brand-ink-500">
                          {q.order.buyer_name ?? "-"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-brand-ink-500">
                          {q.awbNumber ?? "-"}
                        </td>
                        <td className="px-4 py-3">
                          {q.printStatus === "queued" && (
                            <span className="rounded-full bg-brand-ink-100 px-2.5 py-1 text-xs font-medium text-brand-ink-500">
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
                              className="rounded-full bg-brand-red-100 px-2.5 py-1 text-xs font-medium text-brand-red-600"
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
                              className="text-xs text-brand-ink-400 transition-colors hover:text-brand-red-600"
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
