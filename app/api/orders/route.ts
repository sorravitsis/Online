import { failure, success } from "@/lib/api";
import { normalizeOrderFilters } from "@/lib/order-filters";
import { listOrders } from "@/lib/orders";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const filters = normalizeOrderFilters({
      status: searchParams.get("status") ?? undefined,
      storeId: searchParams.get("store_id") ?? undefined,
      date: searchParams.get("date") ?? undefined,
      page: searchParams.get("page")
        ? Number.parseInt(searchParams.get("page") ?? "1", 10)
        : undefined,
      limit: searchParams.get("limit")
        ? Number.parseInt(searchParams.get("limit") ?? "50", 10)
        : undefined
    });

    const data = await listOrders({
      ...filters,
      barcode: searchParams.get("barcode") ?? undefined,
    });

    return success(data);
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Unable to load orders.",
      500
    );
  }
}
