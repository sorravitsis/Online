"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { mapAdminError } from "@/lib/admin";
import type { Platform, StoreRow } from "@/lib/types";

type AdminDashboardProps = {
  initialStores: StoreRow[];
};

type StoreSaveState = {
  type: "idle" | "success" | "error";
  message?: string;
};

type StoresApiResponse = {
  success: boolean;
  data?: {
    stores: StoreRow[];
  };
  error?: string;
};

type PlatformFilter = "all" | Platform;
type ActivityFilter = "all" | "active" | "inactive" | "attention";
type ConnectionTone = "emerald" | "amber" | "red";
type ConnectionStatus = {
  label: string;
  tone: ConnectionTone;
  detail: string;
};

const bangkokDateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Bangkok"
});

function formatPlatformLabel(platform: Platform) {
  return platform === "lazada" ? "Lazada" : "Shopee";
}

function formatStoreLabel(store: StoreRow) {
  return `${store.name} · ${store.shop_id}`;
}

function formatDateTime(value?: string | null) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return bangkokDateTimeFormatter.format(date);
}

function getConnectionStatus(store: StoreRow): ConnectionStatus {
  const hasAccessToken = Boolean(store.access_token);
  const hasRefreshToken = Boolean(store.refresh_token);

  if (!hasAccessToken && !hasRefreshToken) {
    return {
      label: "Not linked",
      tone: "red",
      detail: "Reconnect this store before staff depend on its live AWB flow."
    };
  }

  if (!hasAccessToken || !hasRefreshToken) {
    return {
      label: "Needs review",
      tone: "amber",
      detail: "The token pair is incomplete and may fail the next sync or AWB request."
    };
  }

  if (store.token_expiry) {
    const expiry = new Date(store.token_expiry);

    if (!Number.isNaN(expiry.getTime()) && expiry.getTime() <= Date.now()) {
      return {
        label: "Expired",
        tone: "amber",
        detail: "The current token is past expiry. Refresh this connection before the next sync."
      };
    }
  }

  return {
    label: "Linked",
    tone: "emerald",
    detail: "Token data is present and ready for the next authorized request."
  };
}

function getConnectionClasses(tone: ConnectionTone) {
  switch (tone) {
    case "emerald":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "amber":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "red":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function hasStoreChanges(current: StoreRow, initial: StoreRow | undefined) {
  if (!initial) {
    return false;
  }

  return (
    current.batch_limit !== initial.batch_limit ||
    current.is_active !== initial.is_active
  );
}

function clampBatchLimit(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(50, Math.max(1, Math.trunc(value)));
}

function passwordsMatch(a: string, b: string): boolean {
  return a === b;
}

function matchesStoreFilters(
  store: StoreRow,
  platformFilter: PlatformFilter,
  activityFilter: ActivityFilter,
  normalizedSearch: string
): boolean {
  const connection = getConnectionStatus(store);

  if (platformFilter !== "all" && store.platform !== platformFilter) return false;
  if (activityFilter === "active" && !store.is_active) return false;
  if (activityFilter === "inactive" && store.is_active) return false;
  if (activityFilter === "attention" && store.is_active && connection.tone === "emerald") return false;
  if (!normalizedSearch) return true;

  const haystack = [store.name, store.shop_id, formatPlatformLabel(store.platform)]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedSearch);
}

export function AdminDashboard({ initialStores }: AdminDashboardProps) {
  const searchParams = useSearchParams();
  const [stores, setStores] = useState(initialStores);
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null);
  const [storeStates, setStoreStates] = useState<Record<string, StoreSaveState>>(
    {}
  );
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>("all");
  const [searchValue, setSearchValue] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordState, setPasswordState] = useState<StoreSaveState>({
    type: "idle"
  });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    setStores(initialStores);
  }, [initialStores]);

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

        setStores(json.data.stores);
      } catch (error) {
        console.error("Unable to refresh admin stores", error);
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

  const initialStoreMap = useMemo(
    () =>
      initialStores.reduce<Record<string, StoreRow>>((result, store) => {
        result[store.id] = store;
        return result;
      }, {}),
    [initialStores]
  );

  const normalizedSearch = searchValue.trim().toLowerCase();

  const dashboardStats = useMemo(() => {
    let activeStores = 0;
    let needsAttention = 0;
    let linkedStores = 0;
    let totalBatchLimit = 0;

    for (const store of stores) {
      const connection = getConnectionStatus(store);

      if (store.is_active) {
        activeStores += 1;
      }

      if (connection.tone === "emerald") {
        linkedStores += 1;
      }

      if (!store.is_active || connection.tone !== "emerald") {
        needsAttention += 1;
      }

      totalBatchLimit += store.batch_limit;
    }

    return {
      totalStores: stores.length,
      activeStores,
      linkedStores,
      needsAttention,
      averageBatchLimit:
        stores.length > 0 ? Math.round(totalBatchLimit / stores.length) : 0
    };
  }, [stores]);

  const dirtyStoreCount = useMemo(
    () =>
      stores.reduce((count, store) => {
        return count + (hasStoreChanges(store, initialStoreMap[store.id]) ? 1 : 0);
      }, 0),
    [initialStoreMap, stores]
  );

  const filteredStores = useMemo(() => {
    return [...stores]
      .filter((store) =>
        matchesStoreFilters(store, platformFilter, activityFilter, normalizedSearch)
      )
      .sort((left, right) => {
        const leftConnection = getConnectionStatus(left);
        const rightConnection = getConnectionStatus(right);
        const leftDirty = hasStoreChanges(left, initialStoreMap[left.id]) ? 1 : 0;
        const rightDirty = hasStoreChanges(right, initialStoreMap[right.id]) ? 1 : 0;
        const leftAttention = !left.is_active || leftConnection.tone !== "emerald" ? 1 : 0;
        const rightAttention =
          !right.is_active || rightConnection.tone !== "emerald" ? 1 : 0;

        if (rightDirty !== leftDirty) {
          return rightDirty - leftDirty;
        }

        if (rightAttention !== leftAttention) {
          return rightAttention - leftAttention;
        }

        return left.name.localeCompare(right.name);
      });
  }, [activityFilter, initialStoreMap, normalizedSearch, platformFilter, stores]);

  const lazadaStatus = searchParams.get("lazada");
  const lazadaStore = searchParams.get("store");
  const lazadaMessage = searchParams.get("message");

  function updateStore(storeId: string, updates: Partial<StoreRow>) {
    setStores((current) =>
      current.map((entry) =>
        entry.id === storeId
          ? {
              ...entry,
              ...updates
            }
          : entry
      )
    );
  }

  async function saveStore(store: StoreRow) {
    setSavingStoreId(store.id);
    setStoreStates((current) => ({
      ...current,
      [store.id]: { type: "idle" }
    }));

    try {
      const response = await fetch("/api/admin/stores", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: store.id,
          batch_limit: store.batch_limit,
          is_active: store.is_active
        })
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        setStoreStates((current) => ({
          ...current,
          [store.id]: {
            type: "error",
            message: mapAdminError(json.error)
          }
        }));
        return;
      }

      const updatedStore = json.data.store as StoreRow;
      setStores((current) =>
        current.map((entry) => (entry.id === updatedStore.id ? updatedStore : entry))
      );
      setStoreStates((current) => ({
        ...current,
        [store.id]: {
          type: "success",
          message: "Store settings saved."
        }
      }));
    } catch (error) {
      setStoreStates((current) => ({
        ...current,
        [store.id]: {
          type: "error",
          message:
            error instanceof Error ? error.message : "Unable to save store."
        }
      }));
    } finally {
      setSavingStoreId(null);
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!passwordsMatch(passwordForm.newPassword, passwordForm.confirmPassword)) {
      setPasswordState({
        type: "error",
        message: mapAdminError("password_confirmation_mismatch")
      });
      return;
    }

    setIsSavingPassword(true);
    setPasswordState({ type: "idle" });

    try {
      const response = await fetch("/api/admin/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      });
      const json = await response.json();

      if (!response.ok || !json.success) {
        setPasswordState({
          type: "error",
          message: mapAdminError(json.error)
        });
        return;
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: ""
      });
      setPasswordState({
        type: "success",
        message: "Password updated successfully."
      });
    } catch (error) {
      setPasswordState({
        type: "error",
        message:
          error instanceof Error ? error.message : "Unable to update password."
      });
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="relative overflow-hidden rounded-[32px] border border-red-100 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(254,242,242,0.94))] p-6 shadow-xl shadow-red-100/50">
          <div className="absolute inset-y-0 right-0 hidden w-72 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_62%)] lg:block" />
          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-red-100 bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-brand-red shadow-sm shadow-red-100">
                  Admin Console
                </span>
                {dirtyStoreCount > 0 ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    {dirtyStoreCount} unsaved change{dirtyStoreCount === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                    All store settings synced
                  </span>
                )}
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-brand-ink md:text-4xl">
                  Store operations dashboard
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                  Manage store availability, batch print limits, and platform access
                  from one control room without leaving the warehouse workflow.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <ThemeToggle />
              <Link
                className="rounded-full bg-brand-red px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-red-200 transition hover:bg-red-700"
                href="/"
              >
                Open order queue
              </Link>
              <Link
                className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50"
                href="/scan"
              >
                Scan &amp; print
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <article className="rounded-3xl border bg-white/90 p-5 shadow-md shadow-slate-100">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-steel/70">
              Total stores
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-brand-ink">
              {dashboardStats.totalStores}
            </p>
            <p className="mt-2 text-sm text-slate-500">Current configured store records.</p>
          </article>
          <article className="rounded-3xl border bg-white/90 p-5 shadow-md shadow-slate-100">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-steel/70">
              Active now
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-brand-ink">
              {dashboardStats.activeStores}
            </p>
            <p className="mt-2 text-sm text-slate-500">Stores visible to warehouse staff.</p>
          </article>
          <article className="rounded-3xl border bg-white/90 p-5 shadow-md shadow-slate-100">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-steel/70">
              Linked
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-brand-ink">
              {dashboardStats.linkedStores}
            </p>
            <p className="mt-2 text-sm text-slate-500">Stores with token pairs ready to use.</p>
          </article>
          <article className="rounded-3xl border bg-white/90 p-5 shadow-md shadow-slate-100">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-steel/70">
              Needs attention
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-brand-ink">
              {dashboardStats.needsAttention}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Inactive or missing a healthy connection.
            </p>
          </article>
          <article className="rounded-3xl border bg-white/90 p-5 shadow-md shadow-slate-100 md:col-span-2 xl:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-steel/70">
              Avg batch limit
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-brand-ink">
              {dashboardStats.averageBatchLimit}
            </p>
            <p className="mt-2 text-sm text-slate-500">Average cap applied per store.</p>
          </article>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          <article className="rounded-3xl border bg-white/90 p-6 shadow-md shadow-slate-100">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-steel/70">
                  Platform access
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-brand-ink">
                  Lazada authorization
                </h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                  Start the seller authorization flow here when a Lazada store needs
                  to be connected or reconnected.
                </p>
              </div>
              <Link
                className="inline-flex items-center justify-center rounded-full bg-brand-blue px-5 py-3 text-sm font-medium text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
                href="/api/admin/lazada/connect"
              >
                Connect Lazada store
              </Link>
            </div>

            {lazadaStatus ? (
              <div
                className={`mt-5 rounded-2xl border px-4 py-3 text-sm ${getConnectionClasses(
                  lazadaStatus === "connected" ? "emerald" : "red"
                )}`}
              >
                {lazadaStatus === "connected"
                  ? `Lazada store connected${lazadaStore ? `: ${lazadaStore}` : "."}`
                  : mapAdminError(lazadaMessage ?? "lazada_store_connection_failed")}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Use the connect flow only when a new seller is added or an existing
                token must be refreshed outside n8n.
              </div>
            )}
          </article>

          <article className="rounded-3xl border bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(30,41,59,0.98))] p-6 text-white shadow-xl shadow-slate-300/30">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">
              Shared access
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">
              Password rotation
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Rotate the warehouse password here when access should change for the
              whole team. The new password is written to `app_config`.
            </p>

            <form className="mt-6 space-y-4" onSubmit={savePassword}>
              <label className="block space-y-2 text-sm font-medium text-slate-200">
                Current password
                <input
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-brand-blue"
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      currentPassword: event.target.value
                    }))
                  }
                  type="password"
                  value={passwordForm.currentPassword}
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-slate-200">
                New password
                <input
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-brand-blue"
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      newPassword: event.target.value
                    }))
                  }
                  type="password"
                  value={passwordForm.newPassword}
                />
              </label>

              <label className="block space-y-2 text-sm font-medium text-slate-200">
                Confirm new password
                <input
                  className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-brand-blue"
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      confirmPassword: event.target.value
                    }))
                  }
                  type="password"
                  value={passwordForm.confirmPassword}
                />
              </label>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-brand-ink transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-400"
                  disabled={isSavingPassword}
                  type="submit"
                >
                  {isSavingPassword ? "Updating..." : "Change password"}
                </button>
                {passwordState.message ? (
                  <p
                    className={`text-sm ${
                      passwordState.type === "error"
                        ? "text-red-300"
                        : "text-emerald-300"
                    }`}
                  >
                    {passwordState.message}
                  </p>
                ) : null}
              </div>
            </form>
          </article>
        </section>

        <section className="rounded-3xl border bg-white/90 p-6 shadow-md shadow-slate-100">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-steel/70">
                Store controls
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-brand-ink">
                Batch limits and availability
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Filter the store list, inspect token health, then save only the rows
                that changed. Batch limit remains enforced between 1 and 50.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              Showing {filteredStores.length} of {stores.length} stores
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_0.9fr_0.9fr]">
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Search store
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-brand-ink outline-none transition focus:border-brand-blue"
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Search by store name or shop ID"
                type="search"
                value={searchValue}
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Platform
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-brand-ink outline-none transition focus:border-brand-blue"
                onChange={(event) =>
                  setPlatformFilter(event.target.value as PlatformFilter)
                }
                value={platformFilter}
              >
                <option value="all">All platforms</option>
                <option value="lazada">Lazada</option>
                <option value="shopee">Shopee</option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Focus
              <select
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-brand-ink outline-none transition focus:border-brand-blue"
                onChange={(event) =>
                  setActivityFilter(event.target.value as ActivityFilter)
                }
                value={activityFilter}
              >
                <option value="all">All stores</option>
                <option value="attention">Needs attention</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </label>
          </div>

          {filteredStores.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
              <p className="text-lg font-medium text-brand-ink">No stores match this view.</p>
              <p className="mt-2 text-sm text-slate-500">
                Adjust search or filters to bring more stores back into the list.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 xl:grid-cols-2">
              {filteredStores.map((store) => {
                const initialStore = initialStoreMap[store.id];
                const isDirty = hasStoreChanges(store, initialStore);
                const connection = getConnectionStatus(store);
                const saveState = storeStates[store.id];
                const isSaving = savingStoreId === store.id;

                return (
                  <article
                    key={store.id}
                    className={`rounded-3xl border p-5 shadow-sm transition ${
                      isDirty
                        ? "border-amber-200 bg-amber-50/40 shadow-amber-100/50"
                        : "bg-white shadow-slate-100"
                    }`}
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-xl font-semibold tracking-tight text-brand-ink">
                            {formatStoreLabel(store)}
                          </h3>
                          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                            {formatPlatformLabel(store.platform)}
                          </span>
                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-medium ${getConnectionClasses(
                              connection.tone
                            )}`}
                          >
                            {connection.label}
                          </span>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              store.is_active
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {store.is_active ? "Active" : "Inactive"}
                          </span>
                          {isDirty ? (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                              Unsaved
                            </span>
                          ) : null}
                        </div>

                        <p className="text-sm leading-6 text-slate-500">
                          {connection.detail}
                        </p>
                      </div>

                      <button
                        className="rounded-full bg-brand-ink px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                        disabled={isSaving || !isDirty}
                        onClick={() => void saveStore(store)}
                        type="button"
                      >
                        {isSaving ? "Saving..." : isDirty ? "Save changes" : "Saved"}
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Shop ID
                        </p>
                        <p className="mt-2 truncate text-sm font-medium text-brand-ink">
                          {store.shop_id}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Token expiry
                        </p>
                        <p className="mt-2 text-sm font-medium text-brand-ink">
                          {formatDateTime(store.token_expiry)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Created
                        </p>
                        <p className="mt-2 text-sm font-medium text-brand-ink">
                          {formatDateTime(store.created_at)}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                          Tokens
                        </p>
                        <p className="mt-2 text-sm font-medium text-brand-ink">
                          {store.access_token ? "Access" : "No access"} /{" "}
                          {store.refresh_token ? "Refresh" : "No refresh"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-[180px_1fr]">
                      <label className="space-y-2 text-sm font-medium text-slate-700">
                        Batch limit
                        <input
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-brand-ink outline-none transition focus:border-brand-blue"
                          inputMode="numeric"
                          max={50}
                          min={1}
                          onChange={(event) =>
                            updateStore(store.id, {
                              batch_limit: clampBatchLimit(
                                Number.parseInt(event.target.value || "1", 10)
                              )
                            })
                          }
                          type="number"
                          value={store.batch_limit}
                        />
                      </label>

                      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="text-sm font-medium text-brand-ink">
                              Warehouse visibility
                            </p>
                            <p className="mt-1 text-sm text-slate-500">
                              Disabled stores disappear from the live warehouse lists.
                            </p>
                          </div>

                          <label className="inline-flex items-center gap-3 text-sm font-medium text-slate-700">
                            <input
                              checked={store.is_active}
                              className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                              onChange={(event) =>
                                updateStore(store.id, {
                                  is_active: event.target.checked
                                })
                              }
                              type="checkbox"
                            />
                            {store.is_active ? "Visible to staff" : "Hidden from staff"}
                          </label>
                        </div>
                      </div>
                    </div>

                    {saveState?.message ? (
                      <p
                        className={`mt-4 text-sm ${
                          saveState.type === "error"
                            ? "text-brand-red"
                            : "text-brand-green"
                        }`}
                      >
                        {saveState.message}
                      </p>
                    ) : null}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* ── Sponsors ── */}
        <section className="mt-16 mb-4 px-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-brand-ink-300 mb-5 text-center">
            Our Technology Partners
          </p>
          <div className="flex items-center justify-center gap-10 flex-wrap">
            {[
              { src: "/logo_logitech.png", alt: "Logitech" },
              { src: "/logo_xiaomi.png",   alt: "Xiaomi" },
              { src: "/logo_asus.png",     alt: "ASUS" },
              { src: "/logo_brother.png",  alt: "Brother" },
            ].map(({ src, alt }) => (
              <img
                key={src}
                alt={alt}
                className="h-24 w-auto object-contain opacity-40 grayscale hover:opacity-80 hover:grayscale-0 transition-all duration-300"
                src={src}
              />
            ))}
          </div>
          <div className="mt-8 border-t border-brand-ink-100" />
        </section>
      </div>
    </main>
  );
}
