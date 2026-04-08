"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { mapAdminError } from "@/lib/admin";
import type { StoreRow } from "@/lib/types";

type AdminDashboardProps = {
  initialStores: StoreRow[];
};

type StoreSaveState = {
  type: "idle" | "success" | "error";
  message?: string;
};

export function AdminDashboard({ initialStores }: AdminDashboardProps) {
  const searchParams = useSearchParams();
  const [stores, setStores] = useState(initialStores);
  const [savingStoreId, setSavingStoreId] = useState<string | null>(null);
  const [storeStates, setStoreStates] = useState<Record<string, StoreSaveState>>(
    {}
  );
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordState, setPasswordState] = useState<StoreSaveState>({
    type: "idle"
  });
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  const sortedStores = useMemo(
    () => [...stores].sort((left, right) => left.name.localeCompare(right.name)),
    [stores]
  );
  const lazadaStatus = searchParams.get("lazada");
  const lazadaStore = searchParams.get("store");
  const lazadaMessage = searchParams.get("message");

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
          message: "Saved"
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

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
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
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl border bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-steel/70">
            Admin
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-brand-ink">
            Store controls
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Adjust batch limit per store, toggle activity, and rotate the shared
            app password from one screen.
          </p>
        </header>

        <section className="rounded-3xl border bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-brand-ink">
                Platform connections
              </h2>
              <p className="text-sm text-slate-500">
                Connect Lazada stores through the official seller authorization flow.
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
              className={`mt-4 rounded-2xl border px-4 py-3 text-sm ${
                lazadaStatus === "connected"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {lazadaStatus === "connected"
                ? `Lazada store connected${lazadaStore ? `: ${lazadaStore}` : "."}`
                : mapAdminError(lazadaMessage ?? "lazada_store_connection_failed")}
            </div>
          ) : null}
        </section>

        <section className="rounded-3xl border bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-brand-ink">Store settings</h2>
              <p className="text-sm text-slate-500">
                Batch limit is enforced between 1 and 50.
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-3 font-medium">Store</th>
                  <th className="px-3 py-3 font-medium">Platform</th>
                  <th className="px-3 py-3 font-medium">Shop ID</th>
                  <th className="px-3 py-3 font-medium">Batch Limit</th>
                  <th className="px-3 py-3 font-medium">Active</th>
                  <th className="px-3 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedStores.map((store) => (
                  <tr key={store.id}>
                    <td className="px-3 py-4 font-medium text-brand-ink">{store.name}</td>
                    <td className="px-3 py-4 text-slate-600">{store.platform}</td>
                    <td className="px-3 py-4 text-slate-600">{store.shop_id}</td>
                    <td className="px-3 py-4">
                      <input
                        className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-brand-ink outline-none transition focus:border-brand-blue"
                        max={50}
                        min={1}
                        onChange={(event) =>
                          setStores((current) =>
                            current.map((entry) =>
                              entry.id === store.id
                                ? {
                                    ...entry,
                                    batch_limit: Number.parseInt(event.target.value || "1", 10)
                                  }
                                : entry
                            )
                          )
                        }
                        type="number"
                        value={store.batch_limit}
                      />
                    </td>
                    <td className="px-3 py-4">
                      <label className="inline-flex items-center gap-2 text-slate-600">
                        <input
                          checked={store.is_active}
                          className="h-4 w-4 rounded border-slate-300 text-brand-blue focus:ring-brand-blue"
                          onChange={(event) =>
                            setStores((current) =>
                              current.map((entry) =>
                                entry.id === store.id
                                  ? {
                                      ...entry,
                                      is_active: event.target.checked
                                    }
                                  : entry
                              )
                            )
                          }
                          type="checkbox"
                        />
                        {store.is_active ? "Active" : "Disabled"}
                      </label>
                    </td>
                    <td className="px-3 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <button
                          className="rounded-full bg-brand-ink px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                          disabled={savingStoreId === store.id}
                          onClick={() => void saveStore(store)}
                          type="button"
                        >
                          {savingStoreId === store.id ? "Saving..." : "Save"}
                        </button>
                        {storeStates[store.id]?.message ? (
                          <p
                            className={`text-xs ${
                              storeStates[store.id]?.type === "error"
                                ? "text-brand-red"
                                : "text-brand-green"
                            }`}
                          >
                            {storeStates[store.id]?.message}
                          </p>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-3xl border bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
          <div>
            <h2 className="text-lg font-semibold text-brand-ink">Password change</h2>
            <p className="text-sm text-slate-500">
              Rotates the shared login password stored in `app_config`.
            </p>
          </div>

          <form className="mt-6 grid gap-4 md:grid-cols-3" onSubmit={savePassword}>
            <label className="space-y-2 text-sm font-medium text-slate-700">
              Current password
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-brand-ink outline-none transition focus:border-brand-blue"
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

            <label className="space-y-2 text-sm font-medium text-slate-700">
              New password
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-brand-ink outline-none transition focus:border-brand-blue"
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

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Confirm new password
              <input
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-brand-ink outline-none transition focus:border-brand-blue"
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

            <div className="md:col-span-3 flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-brand-blue px-5 py-3 text-sm font-medium text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={isSavingPassword}
                type="submit"
              >
                {isSavingPassword ? "Updating..." : "Change password"}
              </button>
              {passwordState.message ? (
                <p
                  className={`text-sm ${
                    passwordState.type === "error"
                      ? "text-brand-red"
                      : "text-brand-green"
                  }`}
                >
                  {passwordState.message}
                </p>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
