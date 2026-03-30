import Link from "next/link";
import { listOrders } from "@/lib/orders";
import { formatOrderStatus } from "@/lib/format";

export const dynamic = "force-dynamic";

type WarehousePageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function WarehousePage({
  searchParams
}: WarehousePageProps) {
  const filters = {
    status:
      typeof searchParams?.status === "string" ? searchParams.status : "pending",
    storeId:
      typeof searchParams?.store_id === "string"
        ? searchParams.store_id
        : undefined,
    date:
      typeof searchParams?.date === "string" ? searchParams.date : undefined,
    page:
      typeof searchParams?.page === "string"
        ? Number.parseInt(searchParams.page, 10)
        : 1
  };

  const { orders, total, page, pageSize } = await listOrders(filters);

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-3xl border bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-brand-steel/70">
              Warehouse Dashboard
            </p>
            <h1 className="text-3xl font-semibold text-brand-ink">
              Pending AWB orders
            </h1>
            <p className="text-sm text-slate-600">
              Risk-first foundation: auth, order visibility, and the shared print
              pipeline are ready for integration.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/scan"
              className="rounded-full bg-brand-blue px-5 py-3 text-sm font-medium text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
            >
              Scan Mode
            </Link>
            <Link
              href="/batch"
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50"
            >
              Batch Print
            </Link>
            <Link
              href="/admin"
              className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-brand-ink transition hover:border-slate-300 hover:bg-slate-50"
            >
              Admin
            </Link>
          </div>
        </header>

        <section className="rounded-3xl border bg-white/85 p-6 shadow-lg shadow-slate-200/60 backdrop-blur">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-brand-ink">Orders</h2>
            <p className="text-sm text-slate-500">
              Showing page {page} of {Math.max(1, Math.ceil(total / pageSize))}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="px-3 py-3 font-medium">Order ID</th>
                  <th className="px-3 py-3 font-medium">Store</th>
                  <th className="px-3 py-3 font-medium">Buyer</th>
                  <th className="px-3 py-3 font-medium">Items</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-slate-500" colSpan={6}>
                      No orders found for the selected filter.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="align-top">
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
                        {Array.isArray(order.items_json)
                          ? order.items_json.length
                          : 0}{" "}
                        items
                      </td>
                      <td className="px-3 py-4">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                          {formatOrderStatus(order.awb_status)}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-slate-500">
                        {new Date(order.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
