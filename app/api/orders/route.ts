import { failure, success } from "@/lib/api";
import { MAX_PAGE_SIZE } from "@/lib/env";
import { normalizeOrderFilters } from "@/lib/order-filters";
import { listOrders } from "@/lib/orders";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const barcode = searchParams.get("barcode") ?? undefined;

  try {
    const rawPage = Number.parseInt(searchParams.get("page") ?? "1", 10);
    const rawLimit = Number.parseInt(searchParams.get("limit") ?? "1000", 10);
    const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.min(rawPage, 1000) : 1;
    const limit = Number.isFinite(rawLimit) && rawLimit >= 1 ? Math.min(rawLimit, MAX_PAGE_SIZE) : 1000;

    const filters = normalizeOrderFilters({
      status: searchParams.get("status") ?? (barcode ? "all" : undefined),
      storeId: searchParams.get("store_id") ?? undefined,
      date: searchParams.get("date") ?? undefined,
      page,
      limit
    });

    const data = await listOrders({
      ...filters,
      barcode,
    });

    return success(data);
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Unable to load orders.",
      500
    );
  }
}
