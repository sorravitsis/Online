"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { tryCreateBrowserClient } from "@/lib/supabase";
import {
  buildOrderSearchParams,
  getDefaultOrderDate,
  normalizeOrderFilters,
  type OrderFilters
} from "@/lib/order-filters";
import { formatOrderStatus } from "@/lib/format";
import type { OrderWithStore, Platform, StoreRow } from "@/lib/types";

type OrdersDashboardProps = {
  initialOrders: OrderWithStore[];
  initialTotal: number;
  initialPage: number;
  pageSize: number;
  stores: StoreRow[];
  filters: OrderFilters;
};

type OrdersApiResponse = {
  success: boolean;
  data?: {
    orders: OrderWithStore[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: string;
};

type StoresApiResponse = {
  success: boolean;
  data?: {
    stores: StoreRow[];
  };
  error?: string;
};

const DISPLAY_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 350;

function formatStoreLabel(store: StoreRow) {
  return store.name;
}

function badgeClasses(status: string) {
  switch (status) {
    case "pending":
      return "bg-amber-100 text-amber-700";
    case "printing":
      return "bg-blue-100 text-blue-700";
    case "printed":
      return "bg-emerald-100 text-emerald-700";
    case "failed":
      return "bg-red-100 text-red-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

export function OrdersDashboard({
  initialOrders,
  initialTotal,
  initialPage,
  pageSize,
  stores,
  filters
}: OrdersDashboardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [orders, setOrders] = useState(initialOrders);
  const [availableStores, setAvailableStores] = useState(stores);
  const [total, setTotal] = useState(initialTotal);
  const [displayPage, setDisplayPage] = useState(1);
  const [draftFilters, setDraftFilters] = useState(filters);
  const [isPending, startTransition] = useTransition();
  const [isSyncing, setIsSyncing] = useState(false);
  const [flashOrderId, setFlashOrderId] = useState<string | null>(null);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => new Date());
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRequestRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const restoreSearchFocusRef = useRef(false);
  const maxWorkDate = getDefaultOrderDate();

  const filteredStores = useMemo(() => {
    if (!draftFilters.platform) {
      return availableStores;
    }

    return availableStores.filter((store) => store.platform === draftFilters.platform);
  }, [availableStores, draftFilters.platform]);

  const storePlatformById = useMemo(() => {
    return new Map(availableStores.map((store) => [store.id, store.platform]));
  }, [availableStores]);

  useEffect(() => {
    setAvailableStores(stores);
    setOrders(initialOrders);
    setTotal(initialTotal);
    setDisplayPage(1);
    setDraftFilters(filters);
    setLastSyncedAt(new Date());
  }, [filters, initialOrders, initialTotal, stores]);

  useEffect(() => {
    if (!restoreSearchFocusRef.current) {
      return;
    }

    searchInputRef.current?.focus();
    searchInputRef.current?.select();
    restoreSearchFocusRef.current = false;
  }, [filters]);

  useEffect(() => {
    const currentQuery = draftFilters.query ?? "";
    const appliedQuery = filters.query ?? "";

    if (currentQuery === appliedQuery) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      restoreSearchFocusRef.current = true;
      navigate({
        ...draftFilters,
        page: 1
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [draftFilters, filters.query]);

  useEffect(() => {
    const supabase = tryCreateBrowserClient();
    let isActive = true;

    function flashRow(orderId: string | null) {
      if (!orderId) {
        return;
      }

      setFlashOrderId(orderId);
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }

      flashTimeoutRef.current = setTimeout(() => {
        setFlashOrderId(null);
      }, 2200);
    }

    async function refreshOrders(changedId?: string | null) {
      const requestId = refreshRequestRef.current + 1;
      refreshRequestRef.current = requestId;
      setIsSyncing(true);

      try {
        const search = buildOrderSearchParams(filters).toString();
        const response = await fetch(`/api/orders?${search}`, {
          cache: "no-store"
        });
        const json = (await response.json()) as OrdersApiResponse;

        if (!response.ok || !json.success || !json.data) {
          throw new Error(json.error ?? "Unable to refresh orders.");
        }

        if (!isActive || requestId !== refreshRequestRef.current) {
          return;
        }

        setOrders(json.data.orders);
        setTotal(json.data.total);
        setLastSyncedAt(new Date());

        const highlightedId =
          changedId && json.data.orders.some((order) => order.id === changedId)
            ? changedId
            : json.data.orders[0]?.id ?? null;

        flashRow(highlightedId);
      } catch (error) {
        console.error("Unable to refresh orders dashboard", error);
      } finally {
        if (isActive && requestId === refreshRequestRef.current) {
          setIsSyncing(false);
        }
      }
    }

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
        console.error("Unable to refresh stores for orders dashboard", error);
      }
    }

    function scheduleRefresh(changedId?: string | null) {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = setTimeout(() => {
        void refreshOrders(changedId);
      }, 400);
    }

    function scheduleStoreRefresh() {
      if (storeRefreshTimeoutRef.current) {
        clearTimeout(storeRefreshTimeoutRef.current);
      }

      storeRefreshTimeoutRef.current = setTimeout(() => {
        void refreshStores();
        setLastSyncedAt(new Date());
        router.refresh();
      }, 250);
    }

    void refreshStores();

    const pollInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        scheduleRefresh();
        void refreshStores();
      }
    }, 15000);

    let unsubscribe = () => {
      setRealtimeEnabled(false);
    };

    if (!supabase) {
      setRealtimeEnabled(false);
    } else {
      const channel = supabase
        .channel("orders-dashboard-realtime")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders"
          },
          (payload) => {
            const record =
              (payload.new as { id?: string } | null) ??
              (payload.old as { id?: string } | null);

            scheduleRefresh(record?.id ?? null);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "stores"
          },
          () => {
            scheduleStoreRefresh();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "stores"
          },
          () => {
            scheduleStoreRefresh();
          }
        )
        .subscribe((status) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setRealtimeEnabled(false);
            return;
          }

          if (status === "SUBSCRIBED") {
            setRealtimeEnabled(true);
          }
        });

      unsubscribe = () => {
        void supabase.removeChannel(channel);
      };
    }

    return () => {
      isActive = false;

      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }

      if (storeRefreshTimeoutRef.current) {
        clearTimeout(storeRefreshTimeoutRef.current);
      }

      clearInterval(pollInterval);
      unsubscribe();
    };
  }, [filters, router]);

  const totalDisplayPages = useMemo(
    () => Math.max(1, Math.ceil(orders.length / DISPLAY_PAGE_SIZE)),
    [orders.length]
  );

  const displayedOrders = useMemo(
    () => orders.slice((displayPage - 1) * DISPLAY_PAGE_SIZE, displayPage * DISPLAY_PAGE_SIZE),
    [orders, displayPage]
  );

  function navigate(nextFilters: OrderFilters) {
    const normalized = normalizeOrderFilters({ ...nextFilters, limit: 1000, page: 1 });
    const search = buildOrderSearchParams(normalized).toString();

    startTransition(() => {
      router.replace(`${pathname}?${search}`, { scroll: false });
    });
  }

  function handleFilterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (document.activeElement === searchInputRef.current) {
      restoreSearchFocusRef.current = true;
    }

    navigate(draftFilters);
  }

  function handleDisplayPageChange(next: number) {
    setDisplayPage(Math.max(1, Math.min(next, totalDisplayPages)));
  }

  function handlePlatformChange(platform: Platform | undefined) {
    setDraftFilters((current) => {
      const nextStoreId =
        current.storeId && storePlatformById.get(current.storeId) !== platform
          ? undefined
          : current.storeId;

      return {
        ...current,
        platform,
        storeId: platform ? nextStoreId : current.storeId
      };
    });
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 glass-card-elevated rounded-3xl p-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="wordmark">
                <span className="wordmark-badge">SiS</span>
                <span className="wordmark-text">Warehouse</span>
              </div>
              <span
                className={`badge ${
                  realtimeEnabled
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    realtimeEnabled ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                {realtimeEnabled ? "Realtime" : "Polling"}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-brand-ink-900">
              AWB order queue
            </h1>
            <p className="text-sm text-brand-ink-500">
              Search by order reference, narrow by platform or store, then
              let live sync keep the queue current.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/scan" className="btn-primary">
              Scan Mode
            </Link>
            <Link href="/admin" className="btn-secondary">
              Admin
            </Link>
          </div>
        </header>

        <section className="glass-card rounded-3xl p-6">
          <form className="grid gap-4 xl:grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr_auto]" onSubmit={handleFilterSubmit}>
            <label className="space-y-2 text-sm font-medium text-brand-ink-700">
              Search order
              <input
                className="input-field"
                ref={searchInputRef}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    query: event.target.value || undefined
                  }))
                }
                placeholder="Order ID, barcode, AWB, buyer"
                type="search"
                value={draftFilters.query ?? ""}
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-brand-ink-700">
              Platform
              <select
                className="input-field"
                onChange={(event) =>
                  handlePlatformChange(
                    event.target.value === "shopee" || event.target.value === "lazada"
                      ? event.target.value
                      : undefined
                  )
                }
                value={draftFilters.platform ?? ""}
              >
                <option value="">All platforms</option>
                <option value="shopee">Shopee</option>
                <option value="lazada">Lazada</option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-brand-ink-700">
              Status
              <select
                className="input-field"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    status: event.target.value
                  }))
                }
                value={draftFilters.status}
              >
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="printing">Printing</option>
                <option value="printed">Printed</option>
                <option value="failed">Failed</option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-brand-ink-700">
              Store
              <select
                className="input-field"
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    storeId: event.target.value || undefined
                  }))
                }
                value={draftFilters.storeId ?? ""}
              >
                <option value="">All stores</option>
                {filteredStores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {formatStoreLabel(store)}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-brand-ink-700">
              From
              <input
                className="input-field"
                max={maxWorkDate}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    dateFrom: event.target.value,
                    dateTo: current.dateTo < event.target.value ? event.target.value : current.dateTo
                  }))
                }
                type="date"
                value={draftFilters.dateFrom}
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-brand-ink-700">
              To
              <input
                className="input-field"
                max={maxWorkDate}
                min={draftFilters.dateFrom}
                onChange={(event) =>
                  setDraftFilters((current) => ({
                    ...current,
                    dateTo: event.target.value
                  }))
                }
                type="date"
                value={draftFilters.dateTo}
              />
            </label>

            <div className="flex items-end justify-end gap-3">
              <button
                className="btn-primary"
                disabled={isPending}
                type="submit"
              >
                {isPending ? "Refreshing..." : "Apply filters"}
              </button>
              <button
                className="btn-secondary"
                onClick={() =>
                  setDraftFilters(normalizeOrderFilters())
                }
                type="button"
              >
                Reset
              </button>
            </div>
          </form>
        </section>

        <section className="glass-card rounded-3xl p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-brand-ink-900">Orders</h2>
              <p className="text-sm text-brand-ink-500">
                {orders.length > 0
                  ? `Showing ${(displayPage - 1) * DISPLAY_PAGE_SIZE + 1}–${Math.min(displayPage * DISPLAY_PAGE_SIZE, orders.length)} of ${orders.length} orders`
                  : "No orders found"}
                {total > orders.length ? ` (${total} total — refine filters to narrow)` : ""}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-brand-ink-400">
              <span>
                {isPending || isSyncing
                  ? "Syncing latest orders..."
                  : realtimeEnabled
                    ? "Live queue ready"
                    : "Auto-refresh every 15s"}
              </span>
              <span>{draftFilters.query ? "Debounced search active" : "Search ready"}</span>
              <span>Last sync {lastSyncedAt.toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-brand-ink-100 text-sm">
              <thead>
                <tr className="text-left text-brand-ink-400">
                  <th className="px-3 py-3 font-semibold">Order ID</th>
                  <th className="px-3 py-3 font-semibold">Store</th>
                  <th className="px-3 py-3 font-semibold">Buyer</th>
                  <th className="px-3 py-3 font-semibold">Items</th>
                  <th className="px-3 py-3 font-semibold">Status</th>
                  <th className="px-3 py-3 font-semibold">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-ink-100">
                {displayedOrders.length === 0 ? (
                  <tr>
                    <td className="px-3 py-8 text-center text-brand-ink-400" colSpan={6}>
                      No orders found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map((order) => (
                    <tr
                      key={order.id}
                      className={`align-top transition-colors hover:bg-brand-ink-50 ${flashOrderId === order.id ? "order-row-flash" : ""}`}
                    >
                      <td className="px-3 py-4 font-medium text-brand-ink-900">
                        {order.platform_order_id}
                      </td>
                      <td className="px-3 py-4 text-brand-ink-600">
                        {order.store ? formatStoreLabel(order.store) : "Unknown store"}
                      </td>
                      <td className="px-3 py-4 text-brand-ink-600">
                        {order.buyer_name ?? "-"}
                      </td>
                      <td className="px-3 py-4 text-brand-ink-600">
                        {Array.isArray(order.items_json)
                          ? order.items_json.length
                          : 0}{" "}
                        items
                      </td>
                      <td className="px-3 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${badgeClasses(order.awb_status)}`}
                        >
                          {formatOrderStatus(order.awb_status)}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-brand-ink-400">
                        {new Date(order.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalDisplayPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-brand-ink-100 pt-4">
              <p className="text-sm text-brand-ink-500">
                Page {displayPage} of {totalDisplayPages}
              </p>
              <div className="flex gap-3">
                <button
                  className="inline-flex items-center justify-center rounded-full border border-brand-ink-200 bg-white px-4 py-2 text-sm font-medium text-brand-ink-900 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-brand-ink-300 hover:bg-brand-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={displayPage <= 1}
                  onClick={() => handleDisplayPageChange(displayPage - 1)}
                  type="button"
                >
                  Previous
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-full border border-brand-ink-200 bg-white px-4 py-2 text-sm font-medium text-brand-ink-900 shadow-sm transition-all duration-200 hover:-translate-y-px hover:border-brand-ink-300 hover:bg-brand-ink-50 disabled:cursor-not-allowed disabled:opacity-40"
                  disabled={displayPage >= totalDisplayPages}
                  onClick={() => handleDisplayPageChange(displayPage + 1)}
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
