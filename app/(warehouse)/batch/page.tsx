import { BatchDashboard } from "@/components/batch-dashboard";
import { ClientErrorBoundary } from "@/components/client-error-boundary";
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
    <ClientErrorBoundary
      description="The batch dashboard hit a client-side problem while tracking selection, countdown, or realtime state."
      homeHref="/batch"
      title="Batch dashboard needs recovery"
    >
      <BatchDashboard
        filters={filters}
        initialOrders={orders}
        stores={stores}
      />
    </ClientErrorBoundary>
  );
}
