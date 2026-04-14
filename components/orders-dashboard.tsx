"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { tryCreateBrowserClient } from "@/lib/supabase";
import {
  buildOrderSearchParams,
  getDefaultOrderDate,
  normalizeOrderFilters,
  type OrderFilters,
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
      return "bg-blue-50 text-blue-700";
    case "printing":
      return "bg-brand-red-50 text-brand-red-700";
    case "printed":
      return "bg-brand-ink-100 text-brand-ink-600";
    case "failed":
      return "bg-red-100 text-red-700";
    default:
      return "bg-brand-ink-100 text-brand-ink-500";
  }
}

export function OrdersDashboard({
  initialOrders,
  initialTotal,
  initialPage,
  pageSize,
  stores,
  filters,
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
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);
  const [realtimeEnabled, setRealtimeEnabled] = useState(true);
  const [lastSyncedAt, setLastSyncedAt] = useState(() => new Date());
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storeRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshRequestRef = useRef(0);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const restoreSearchFocusRef = useRef(false);
  const maxWorkDate = getDefaultOrderDate();

  const filteredStores = useMemo(() => {
    if (!draftFilters.platform) {
      return availableStores;
    }

    return availableStores.filter(
      (store) => store.platform === draftFilters.platform,
    );
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
        page: 1,
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
          cache: "no-store",
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
            : (json.data.orders[0]?.id ?? null);

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
          cache: "no-store",
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
    void refreshOrders();

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
            table: "orders",
          },
          (payload) => {
            const record =
              (payload.new as { id?: string } | null) ??
              (payload.old as { id?: string } | null);

            scheduleRefresh(record?.id ?? null);
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "stores",
          },
          () => {
            scheduleStoreRefresh();
          },
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "stores",
          },
          () => {
            scheduleStoreRefresh();
          },
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
    [orders.length],
  );

  const displayedOrders = useMemo(
    () =>
      orders.slice(
        (displayPage - 1) * DISPLAY_PAGE_SIZE,
        displayPage * DISPLAY_PAGE_SIZE,
      ),
    [orders, displayPage],
  );

  function navigate(nextFilters: OrderFilters) {
    const normalized = normalizeOrderFilters({
      ...nextFilters,
      limit: 1000,
      page: 1,
    });
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

  function handleCopyOrderId(orderId: string, rowId: string) {
    void navigator.clipboard.writeText(orderId).then(() => {
      setCopiedOrderId(rowId);
      setTimeout(() => setCopiedOrderId(null), 1500);
    });
  }

  function maxDate(a: string, b: string): string {
    return a >= b ? a : b;
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
        storeId: platform ? nextStoreId : current.storeId,
      };
    });
  }

  return (
    <div className="min-h-screen bg-[#F9F9FB]">
      {/* ── Sticky Nav ── */}
      <header className="bg-white flex justify-between items-center w-full px-8 py-4 sticky top-0 z-50 border-b border-brand-ink-100">
        <div className="flex items-center gap-8">
          <div className="wordmark">
            <span className="wordmark-badge text-[18px]">SiS</span>
            <span className="wordmark-text">Warehouse</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Live sync badge */}
          <div className="flex items-center gap-2 bg-brand-ink-50 px-3 py-1.5 rounded-lg border border-brand-ink-100">
            <span className="relative flex h-2 w-2">
              {realtimeEnabled && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red-600 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${realtimeEnabled ? "bg-brand-red-600" : "bg-amber-500"}`}
              />
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink-500">
              {realtimeEnabled ? "Live Syncing" : "Polling 15s"}
            </span>
          </div>
          <Link
            className="p-2 hover:bg-brand-ink-50 rounded-md transition-colors"
            href="/admin"
            title="Admin settings"
          >
            <svg
              className="w-5 h-5 text-brand-ink-500"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              viewBox="0 0 24 24"
            >
              <path d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
              <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
            </svg>
          </Link>
          <button
            className="p-2 hover:bg-red-50 hover:text-brand-red-600 rounded-md transition-colors text-brand-ink-400"
            title="Sign out"
            type="button"
            onClick={() => {
              void fetch("/api/auth/logout", { method: "POST" }).then(() => {
                router.replace("/login");
              });
            }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} viewBox="0 0 24 24">
              <path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
            </svg>
          </button>
        </div>
      </header>

      <main className="relative">
        <div className="max-w-[1600px] mx-auto px-8 py-10">
          {/* ── Hero Title ── */}
          <div className="flex justify-between items-end mb-12">
            <div>
              <span className="font-bold uppercase tracking-[0.2em] text-sm mb-2 block text-brand-red-700">
                System Dashboard
              </span>
              <h1 className="text-5xl font-extrabold tracking-tight text-brand-ink-900">
                Order Queue
              </h1>
            </div>
            <div className="flex gap-4">
              <Link
                className="bg-brand-ink-100 text-brand-ink-900 font-bold uppercase tracking-wider text-xs px-6 py-3 rounded-lg hover:bg-brand-ink-200 transition-all flex items-center gap-2"
                href="/scan"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 3.75 9.375v-4.5ZM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 0 1-1.125-1.125v-4.5ZM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0 1 13.5 9.375v-4.5Z" />
                  <path d="M6.75 6.75h.75v.75h-.75v-.75ZM6.75 16.5h.75v.75h-.75V16.5ZM16.5 6.75h.75v.75h-.75v-.75Z" />
                </svg>
                Scan Mode
              </Link>
              <Link
                className="bg-gradient-to-br from-brand-red-700 to-brand-red-600 text-white font-bold uppercase tracking-wider text-xs px-8 py-3 rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-brand-red-200/40"
                href="/admin"
              >
                Admin
              </Link>
            </div>
          </div>

          {/* ── Filter Panel ── */}
          <section className="kinetic-glass-panel rounded-xl p-8 mb-10 relative overflow-hidden shadow-sm">
            <div className="absolute left-0 top-0 w-1 h-full bg-brand-red-700" />
            <form
              className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-8"
              onSubmit={handleFilterSubmit}
            >
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-ink-400" htmlFor="filter-search">
                  Search Reference
                </label>
                <div className="relative">
                  <input
                    ref={searchInputRef}
                    className="bottom-docked-input w-full py-2 pr-8 text-sm text-brand-ink-900 placeholder:text-brand-ink-300"
                    id="filter-search"
                    onChange={(e) =>
                      setDraftFilters((curr) => ({
                        ...curr,
                        query: e.target.value || undefined,
                      }))
                    }
                    placeholder="Order ID / AWB / buyer..."
                    type="search"
                    value={draftFilters.query ?? ""}
                  />
                  <svg
                    className="absolute right-0 top-2.5 w-4 h-4 text-brand-ink-300 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                  </svg>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-ink-400" htmlFor="filter-platform">
                  Platform
                </label>
                <select
                  className="bottom-docked-input w-full py-2 text-sm text-brand-ink-900 appearance-none"
                  id="filter-platform"
                  onChange={(e) =>
                    handlePlatformChange(
                      e.target.value === "shopee" || e.target.value === "lazada"
                        ? e.target.value
                        : undefined,
                    )
                  }
                  value={draftFilters.platform ?? ""}
                >
                  <option value="">All Platforms</option>
                  <option value="shopee">Shopee</option>
                  <option value="lazada">Lazada</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-ink-400" htmlFor="filter-store">
                  Store
                </label>
                <select
                  className="bottom-docked-input w-full py-2 text-sm text-brand-ink-900 appearance-none"
                  id="filter-store"
                  onChange={(e) =>
                    setDraftFilters((curr) => ({
                      ...curr,
                      storeId: e.target.value || undefined,
                    }))
                  }
                  value={draftFilters.storeId ?? ""}
                >
                  <option value="">All Stores</option>
                  {filteredStores.map((store) => (
                    <option key={store.id} value={store.id}>
                      {formatStoreLabel(store)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-ink-400" htmlFor="filter-status">
                  Status
                </label>
                <select
                  className="bottom-docked-input w-full py-2 text-sm text-brand-ink-900 appearance-none"
                  id="filter-status"
                  onChange={(e) =>
                    setDraftFilters((curr) => ({
                      ...curr,
                      status: e.target.value,
                    }))
                  }
                  value={draftFilters.status}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="printing">Printing</option>
                  <option value="printed">Printed</option>
                  <option value="failed">Failed</option>
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-ink-400" htmlFor="filter-date-from">
                  From
                </label>
                <input
                  className="bottom-docked-input w-full py-2 text-sm text-brand-ink-900"
                  id="filter-date-from"
                  max={maxWorkDate}
                  onChange={(e) =>
                    setDraftFilters((curr) => ({
                      ...curr,
                      dateFrom: e.target.value,
                      dateTo: maxDate(curr.dateTo, e.target.value),
                    }))
                  }
                  type="date"
                  value={draftFilters.dateFrom}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-brand-ink-400" htmlFor="filter-date-to">
                  To
                </label>
                <input
                  className="bottom-docked-input w-full py-2 text-sm text-brand-ink-900"
                  id="filter-date-to"
                  max={maxWorkDate}
                  min={draftFilters.dateFrom}
                  onChange={(e) =>
                    setDraftFilters((curr) => ({
                      ...curr,
                      dateTo: e.target.value,
                    }))
                  }
                  type="date"
                  value={draftFilters.dateTo}
                />
              </div>

              <div className="flex items-end gap-2">
                <button
                  className="bg-brand-red-700 text-white flex-1 h-[42px] rounded-md font-bold text-xs uppercase tracking-widest hover:bg-brand-red-800 transition-all disabled:opacity-50"
                  disabled={isPending}
                  type="submit"
                >
                  {isPending ? "…" : "Apply"}
                </button>
                <button
                  className="bg-brand-ink-50 text-brand-ink-500 h-[42px] px-3 rounded-md hover:bg-brand-ink-100 transition-all"
                  onClick={() => setDraftFilters(normalizeOrderFilters())}
                  title="Reset filters"
                  type="button"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                </button>
              </div>
            </form>
          </section>

          {/* ── Summary Bar ── */}
          <div className="flex justify-between items-center mb-6 px-1">
            <div className="flex gap-8">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-brand-red-700">
                  {total}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink-400">
                  Total Orders
                </span>
              </div>
              <div className="flex items-baseline gap-2 border-l border-brand-ink-200 pl-8">
                <span className="text-3xl font-extrabold text-blue-600">
                  {orders.filter((o) => o.awb_status === "pending").length}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink-400">
                  Pending Action
                </span>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-ink-400 mb-1">
                {isPending || isSyncing ? "Syncing…" : "System Pulse"}
              </p>
              <p className="text-xs text-brand-ink-500 font-medium">
                Last synced:{" "}
                <span className="text-brand-ink-900" suppressHydrationWarning>
                  {lastSyncedAt.toLocaleTimeString()}
                </span>
              </p>
            </div>
          </div>

          {/* ── Orders Table ── */}
          <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-brand-ink-100/50">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-brand-ink-50 border-b border-brand-ink-100">
                  <th className="text-left py-5 px-6 text-[10px] font-bold uppercase tracking-widest text-brand-ink-400">
                    Order ID
                  </th>
                  <th className="text-left py-5 px-6 text-[10px] font-bold uppercase tracking-widest text-brand-ink-400">
                    Platform / Store
                  </th>
                  <th className="text-left py-5 px-6 text-[10px] font-bold uppercase tracking-widest text-brand-ink-400">
                    Buyer
                  </th>
                  <th className="text-center py-5 px-6 text-[10px] font-bold uppercase tracking-widest text-brand-ink-400">
                    Items
                  </th>
                  <th className="text-left py-5 px-6 text-[10px] font-bold uppercase tracking-widest text-brand-ink-400">
                    Status
                  </th>
                  <th className="text-right py-5 px-6 text-[10px] font-bold uppercase tracking-widest text-brand-ink-400">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-ink-100/50">
                {displayedOrders.length === 0 ? (
                  <tr>
                    <td
                      className="py-16 text-center text-brand-ink-400 text-sm"
                      colSpan={6}
                    >
                      No orders found for the selected filters.
                    </td>
                  </tr>
                ) : (
                  displayedOrders.map((order) => (
                    <tr
                      key={order.id}
                      className={`group relative transition-colors hover:bg-brand-red-50/40 ${flashOrderId === order.id ? "order-row-flash" : ""}`}
                    >
                      <td className="py-5 px-6">
                        <div className="absolute left-0 top-0 w-1 h-full bg-brand-red-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-brand-ink-900 tracking-tight">
                            {order.platform_order_id}
                          </span>
                          <button
                            aria-label="Copy order ID"
                            className="text-brand-ink-300 hover:text-brand-red-600 transition-colors"
                            type="button"
                            onClick={() => handleCopyOrderId(order.platform_order_id, order.id)}
                          >
                            {copiedOrderId === order.id ? (
                              <svg
                                className="h-4 w-4 text-green-500"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2.5}
                                viewBox="0 0 24 24"
                              >
                                <path
                                  d="M5 13l4 4L19 7"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth={2}
                                viewBox="0 0 24 24"
                              >
                                <rect
                                  height="13"
                                  rx="2"
                                  width="13"
                                  x="9"
                                  y="9"
                                />
                                <path
                                  d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
                                  strokeLinecap="round"
                                />
                              </svg>
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <div className="flex flex-col">
                          <span className="font-bold text-xs text-brand-ink-900 capitalize">
                            {order.store?.platform ?? "-"}
                          </span>
                          <span className="text-[11px] text-brand-ink-400">
                            {order.store
                              ? formatStoreLabel(order.store)
                              : "Unknown store"}
                          </span>
                        </div>
                      </td>
                      <td className="py-5 px-6">
                        <span className="text-sm font-medium text-brand-ink-700">
                          {order.buyer_name ?? "-"}
                        </span>
                      </td>
                      <td className="py-5 px-6 text-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 bg-brand-ink-100 rounded-full font-bold text-[10px] text-brand-ink-700">
                          {Array.isArray(order.items_json)
                            ? order.items_json.length
                            : 0}
                        </span>
                      </td>
                      <td className="py-5 px-6">
                        <span
                          className={`inline-flex px-3 py-1 rounded-full font-bold text-[9px] uppercase tracking-wider ${badgeClasses(order.awb_status)}`}
                        >
                          {formatOrderStatus(order.awb_status)}
                        </span>
                      </td>
                      <td className="py-5 px-6 text-right">
                        <span className="text-[11px] text-brand-ink-400" suppressHydrationWarning>
                          {new Date(order.created_at).toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Pagination */}
            {totalDisplayPages > 1 && (
              <div className="bg-brand-ink-50 px-8 py-4 flex justify-between items-center border-t border-brand-ink-100">
                <span className="text-[11px] text-brand-ink-400 font-medium">
                  Page {displayPage} of {totalDisplayPages} ({orders.length}{" "}
                  orders)
                </span>
                <div className="flex gap-2">
                  <button
                    className="px-4 py-2 bg-white border border-brand-ink-100 rounded font-bold text-[10px] uppercase tracking-widest text-brand-ink-500 hover:bg-brand-ink-50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={displayPage <= 1}
                    onClick={() => handleDisplayPageChange(displayPage - 1)}
                    type="button"
                  >
                    Previous
                  </button>
                  <button
                    className="px-4 py-2 bg-brand-red-700 text-white rounded font-bold text-[10px] uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    disabled={displayPage >= totalDisplayPages}
                    onClick={() => handleDisplayPageChange(displayPage + 1)}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* ── Logitech Product Strip ── */}
      <section className="w-full px-8 py-8 mt-12">
        <p className="text-[10px] font-bold uppercase tracking-widest text-brand-ink-300 mb-4">
          Powered by Logitech
        </p>
        <div className="grid grid-cols-4 gap-4">
          {[
            { src: "/logitech_keyboard.png", label: "MX Keys S" },
            { src: "/logitech_mouse.png",    label: "MX Master 3S" },
            { src: "/logitech_webcam.png",   label: "BRIO Webcam" },
            { src: "/logitech_headset.png",  label: "G Pro Headset" },
          ].map(({ src, label }) => (
            <div
              key={src}
              className="rounded-2xl overflow-hidden bg-brand-ink-50 border border-brand-ink-100 flex flex-col items-center p-4 gap-3"
            >
              <img
                alt={label}
                className="w-full h-36 object-contain"
                src={src}
              />
              <span className="text-[10px] font-bold uppercase tracking-widest text-brand-ink-400">
                {label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-brand-ink-50 w-full px-8 py-6 flex justify-between items-center border-t border-brand-ink-100 mt-8">
        <span className="text-xs font-medium uppercase tracking-widest text-brand-ink-300">
          © 2026 SiS Warehouse Systems
        </span>
        <div className="flex gap-8">
          <Link
            className="text-xs font-medium uppercase tracking-widest text-brand-ink-300 hover:text-brand-red-700 transition-colors"
            href="/admin"
          >
            Admin
          </Link>
        </div>
      </footer>

      {/* ── Floating Status Chip ── */}
      <div className="fixed top-20 right-8 z-40">
        <div className="bg-white/70 backdrop-blur-xl px-4 py-2 rounded-full border border-brand-red-100 flex items-center gap-2 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-brand-red-700" />
          <span className="font-bold text-[10px] uppercase tracking-[0.1em] text-brand-ink-700">
            Server: Online
          </span>
        </div>
      </div>
    </div>
  );
}
