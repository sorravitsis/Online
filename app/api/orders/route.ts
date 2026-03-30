import { failure, success } from "@/lib/api";
import { listOrders } from "@/lib/orders";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  try {
    const data = await listOrders({
      status: searchParams.get("status") ?? "pending",
      storeId: searchParams.get("store_id") ?? undefined,
      date: searchParams.get("date") ?? undefined,
      barcode: searchParams.get("barcode") ?? undefined,
      page: searchParams.get("page")
        ? Number.parseInt(searchParams.get("page") ?? "1", 10)
        : 1,
      limit: searchParams.get("limit")
        ? Number.parseInt(searchParams.get("limit") ?? "50", 10)
        : 50
    });

    return success(data);
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Unable to load orders.",
      500
    );
  }
}
