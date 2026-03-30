"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getSelectionLimit, mapBatchError, summarizeBatchResults } from "@/lib/batch";
import { buildOrderSearchParams, normalizeOrderFilters, type OrderFilters } from "@/lib/order-filters";
import { summarizeItems } from "@/lib/scan";
import { createBrowserClient } from "@/lib/supabase";
import type { OrderWithStore, PrintResult, StoreRow } from "@/lib/types";

type BatchDashboardProps = {
  initialOrders: OrderWithStore[];
  stores: StoreRow[];
  filters: OrderFilters;
};

type BatchApiResponse = {
  success: boolean;
  data?: {
    batchId: string;
    results: PrintResult[];
  };
  error?: string;
};

type ToastState = {
  orderIds: string[];
  secondsLeft: number;
};

export function BatchDashboard({
  initialOrders,
  stores,
  filters
}: BatchDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [orders, setOrders] = useState(initialOrders);
  const [draftFilters, setDraftFilters] = useState(filters);
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [results, setResults] = useState<PrintResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processedIds, setProcessedIds] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOrders(initialOrders);
    setDraftFilters(filters);
    setSelectedOrderIds((current) =>
      current.filter((orderId) => initialOrders.some((order) => order.id === orderId))
    );
  }, [filters, initialOrders]);

  useEffect(() => {
    const supabase = createBrowserClient();
    const channel = supabase
      .channel("batch-dashboard-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders"
        },
        (payload) => {
          const updated = payload.new as Partial<OrderWithStore> | null;

          if (updated?.id) {
            setOrders((current) =>
              current.map((order) =>
                order.id === updated.id
                  ? {
                      ...order,
                      ...updated
                    }
                  : order
              )
            );

            if (
              selectedOrderIds.includes(updated.id) &&
              updated.awb_status &&
              updated.awb_status !== "pending"
            ) {
              setProcessedIds((current) =>
                current.includes(updated.id as string)
                  ? current
                  : [...current, updated.id as string]
              );
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      if (countdownTimeoutRef.current) {
        clearTimeout(countdownTimeoutRef.current);
      }

      void supabase.removeChannel(channel);
    };
  }, [selectedOrderIds]);

  const visibleOrders = useMemo(
    () => orders.filter((order) => order.awb_status === "pending"),
    [orders]
  );

  const selectedStoreIds = useMemo(
    () =>
      selectedOrderIds
        .map((orderId) => orders.find((order) => order.id === orderId)?.store_id)
        .filter((storeId): storeId is string => Boolean(storeId)),
    [orders, selectedOrderIds]
  );

  const selectionLimit = useMemo(
    () => getSelectionLimit(selectedStoreIds, stores),
    [selectedStoreIds, stores]
  );

  const progressTotal = toast?.orderIds.length ?? (isPrinting ? selectedOrderIds.length : 0);
  const progressCompleted = Math.min(processedIds.length, progressTotal);
  const progressPercent =
    progressTotal > 0 ? Math.max((progressCompleted / progressTotal) * 100, 8) : 0;

  function navigate(nextFilters: OrderFilters) {
    const normalized = normalizeOrderFilters(nextFilters);
    const params = buildOrderSearchParams({
      ...normalized,
      status: "pending"
    });

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      router.refresh();
    });
  }

  function handleToggle(orderId: string) {
    setSelectedOrderIds((current) => {
      if (current.includes(orderId)) {
        return current.filter((entry) => entry !== orderId);
      }

      if (current.length >= selectionLimit) {
        return current;
      }

      return [...current, orderId];
    });
  }

  function resetCountdown() {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    if (countdownTimeoutRef.current) {
      clearTimeout(countdownTimeoutRef.current);
    }

    countdownIntervalRef.current = null;
    countdownTimeoutRef.current = null;
    setToast(null);
  }

  async function runBatch(orderIds: string[]) {
    setIsPrinting(true);
    setError(null);
    setResults([]);
    setProcessedIds([]);

    try {
      const response = await fetch("/api/awb/batch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ orderIds })
      });
      const json = (await response.json()) as BatchApiResponse;

      if (!response.ok || !json.success || !json.data) {
        setError(mapBatchError(json.error));
        return;
      }

      setProcessedIds(orderIds);
      setResults(json.data.results);
      setSelectedOrderIds([]);
      startTransition(() => {
        router.refresh();
      });
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Batch print failed."
      );
    } finally {
      setIsPrinting(false);
    }
  }

  function scheduleBatch(orderIds: string[]) {
    if (orderIds.length === 0 || isPrinting) {
      return;
    }

    setError(null);
    setResults([]);
    setProcessedIds([]);
    setToast({
      orderIds,
      secondsLeft: 2
    });

    countdownIntervalRef.current = setInterval(() => {
      setToast((current) =>
        current
          ? {
              ...current,
              secondsLeft: Math.max(current.secondsLeft - 1, 0)
            }
          : current
      );
    }, 1000);

    countdownTimeoutRef.current = setTimeout(async () => {
      resetCountdown();
      await runBatch(orderIds);
    }, 2000);
  }

  const failedResults = results.filter((result) => result.status === "failed");
  const summary = summarizeBatchResults(results);

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-steel/70">
              Batch Print
            </p>
            <h1 className="text-3xl font-semibold text-brand-ink">
              Queue-based batch execution
            </h1>
            <p className="text-sm text-slate-600">
              Select pending orders, respect the store batch cap, and use Undo
              before the sequential print run begins.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/"
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50"
            >
              Back to queue
            </Link>
          </div>
        </header>

        <section className="rounded-3xl border bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
          <form
            className="grid gap-4 lg:grid-cols-[1fr_1fr_auto]"
            onSubmit={(event) => {
              event.preventDefault();
              navigate({
                ...draftFilters,
                status: "pending",
                page: 1
              });
            }}
          >
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Store
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-brand-ink outline-none transition focus:border-brand-blue"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    storeId: event.target.value || undefined
                  }))
                }
                value={draftFilters.storeId ?? ""}
              >
                <option value="">All stores</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Work date
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-brand-ink outline-none transition focus:border-brand-blue"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    date: event.target.value
                  }))
                }
                type="date"
                value={draftFilters.date}
              />
            </label>

            <div className="flex items-end gap-3">
              <button
                className="rounded-full bg-brand-ink px-5 py-3 text-sm font-medium text-white shadow-lg shadow-slate-200 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isPending}
                type="submit"
              >
                {isPending ? "Refreshing..." : "Apply filters"}
              </button>
              <button
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50"
                onClick={() =>
                  setDraftFilters(
                    normalizeOrderFilters({
                      status: "pending"
                    })
                  )
                }
                type="button"
              >
                Reset
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-3xl border bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-brand-ink">Pending orders</h2>
              <p className="text-sm text-slate-500">
                {selectedOrderIds.length} / {selectionLimit} selected. The cap uses
                the lowest batch limit among selected stores for safety.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="rounded-full bg-brand-amber px-5 py-3 text-sm font-medium text-white shadow-lg shadow-amber-200 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none"
                disabled={selectedOrderIds.length === 0 || isPrinting || Boolean(toast)}
                onClick={() => scheduleBatch(selectedOrderIds)}
                type="button"
              >
                Print selected
              </button>
              {failedResults.length > 0 ? (
                <button
                  className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50"
                  disabled={isPrinting || Boolean(toast)}
                  onClick={() =>
                    scheduleBatch(
                      failedResults.map((result) => result.orderId)
                    )
                  }
                  type="button"
                >
                  Reprint failed
                </button>
              ) : null}
            </div>
          </div>

          {toast ? (
            <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Printing {toast.orderIds.length} orders in {toast.secondsLeft}s
                </p>
                <p className="text-sm text-amber-700">
                  Undo now if this batch was started by mistake.
                </p>
              </div>
              <button
                className="rounded-full bg-white px-4 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
                onClick={resetCountdown}
                type="button"
              >
                Undo
              </button>
            </div>
          ) : null}

          {isPrinting ? (
            <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center justify-between text-sm">
                <p className="font-medium text-blue-800">
                  Processing batch sequentially
                </p>
                <p className="text-blue-700">
                  {progressCompleted} / {progressTotal}
                </p>
              </div>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-blue-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-medium text-brand-red">
              {error}
            </div>
          ) : null}

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-3 font-medium">Select</th>
                  <th className="px-3 py-3 font-medium">Order ID</th>
                  <th className="px-3 py-3 font-medium">Store</th>
                  <th className="px-3 py-3 font-medium">Buyer</th>
                  <th className="px-3 py-3 font-medium">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleOrders.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-slate-500" colSpan={5}>
                      No pending orders found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  visibleOrders.map((order) => {
                    const isSelected = selectedOrderIds.includes(order.id);
                    const selectionLocked =
                      !isSelected &&
                      selectedOrderIds.length >= selectionLimit;

                    return (
                      <tr key={order.id}>
                        <td className="px-3 py-4">
                          <input
                            checked={isSelected}
                            className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                            disabled={isPrinting || Boolean(toast) || selectionLocked}
                            onChange={() => handleToggle(order.id)}
                            type="checkbox"
                          />
                        </td>
                        <td className="px-3 py-4 font-medium text-brand-ink">
                          {order.platform_order_id}
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {order.store?.name ?? "Unknown store"}
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {order.buyer_name ?? "-"}
                        </td>
                        <td className="px-3 py-4 text-slate-600">
                          {summarizeItems(order.items_json)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-brand-ink">Batch summary</h2>
              <p className="text-sm text-slate-500">
                Printed {summary.printed}, failed {summary.failed}
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {results.length === 0 ? (
              <p className="text-sm text-slate-500">
                Start a batch to see per-order results here.
              </p>
            ) : (
              results.map((result) => (
                <div
                  key={`${result.orderId}-${result.status}`}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <p className="font-medium text-brand-ink">{result.orderId}</p>
                    <p className="mt-1 text-slate-600">
                      {result.status === "printed"
                        ? `Printed successfully${result.awbNumber ? `, AWB ${result.awbNumber}` : ""}`
                        : mapBatchError(result.error)}
                    </p>
                  </div>
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                      result.status === "printed"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {result.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
