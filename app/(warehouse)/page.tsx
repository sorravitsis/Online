import { ClientErrorBoundary } from "@/components/client-error-boundary";
import { OrdersDashboard } from "@/components/orders-dashboard";
import { normalizeOrderFilters } from "@/lib/order-filters";
import { listOrders } from "@/lib/orders";
import { listStores } from "@/lib/stores";

export const dynamic = "force-dynamic";

type WarehousePageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function WarehousePage({
  searchParams
}: WarehousePageProps) {
  const filters = normalizeOrderFilters({
    status: typeof searchParams?.status === "string" ? searchParams.status : undefined,
    storeId:
      typeof searchParams?.store_id === "string"
        ? searchParams.store_id
        : undefined,
    date: typeof searchParams?.date === "string" ? searchParams.date : undefined,
    page:
      typeof searchParams?.page === "string"
        ? Number.parseInt(searchParams.page, 10)
        : undefined,
    limit:
      typeof searchParams?.limit === "string"
        ? Number.parseInt(searchParams.limit, 10)
        : undefined
  });

  const [{ orders, total, page, pageSize }, stores] = await Promise.all([
    listOrders(filters),
    listStores()
  ]);

  return (
    <ClientErrorBoundary
      description="The live orders dashboard hit a client-side problem while rendering filters or realtime updates."
      title="Order dashboard needs recovery"
    >
      <OrdersDashboard
        filters={filters}
        initialOrders={orders}
        initialPage={page}
        initialTotal={total}
        pageSize={pageSize}
        stores={stores}
      />
    </ClientErrorBoundary>
  );
}
