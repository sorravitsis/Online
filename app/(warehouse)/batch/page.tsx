import { BatchDashboard } from "@/components/batch-dashboard";
import { normalizeOrderFilters } from "@/lib/order-filters";
import { listOrders } from "@/lib/orders";
import { listStores } from "@/lib/stores";

export const dynamic = "force-dynamic";

type BatchPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function BatchPage({ searchParams }: BatchPageProps) {
  const filters = normalizeOrderFilters({
    status: "pending",
    storeId:
      typeof searchParams?.store_id === "string"
        ? searchParams.store_id
        : undefined,
    date: typeof searchParams?.date === "string" ? searchParams.date : undefined,
    page:
      typeof searchParams?.page === "string"
        ? Number.parseInt(searchParams.page, 10)
        : undefined,
    limit: 200
  });

  const [{ orders }, stores] = await Promise.all([
    listOrders({
      ...filters,
      status: "pending"
    }),
    listStores()
  ]);

  return (
    <BatchDashboard
      filters={filters}
      initialOrders={orders}
      stores={stores}
    />
  );
}
