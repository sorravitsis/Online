import { listStores } from "@/lib/stores";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const stores = await listStores();

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="rounded-3xl border bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-steel/70">
            Admin
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-brand-ink">
            Store controls
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Batch limit and activation state are backed by the `stores` table.
          </p>
        </header>

        <section className="rounded-3xl border bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-3 font-medium">Store</th>
                  <th className="px-3 py-3 font-medium">Platform</th>
                  <th className="px-3 py-3 font-medium">Shop ID</th>
                  <th className="px-3 py-3 font-medium">Batch Limit</th>
                  <th className="px-3 py-3 font-medium">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stores.map((store) => (
                  <tr key={store.id}>
                    <td className="px-3 py-4 font-medium text-brand-ink">{store.name}</td>
                    <td className="px-3 py-4 text-slate-600">{store.platform}</td>
                    <td className="px-3 py-4 text-slate-600">{store.shop_id}</td>
                    <td className="px-3 py-4 text-slate-600">{store.batch_limit}</td>
                    <td className="px-3 py-4 text-slate-600">
                      {store.is_active ? "Active" : "Disabled"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
