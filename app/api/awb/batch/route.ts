import { getCurrentSession, getSessionIdentifier } from "@/lib/auth";
import { failure, success } from "@/lib/api";
import { getSelectionLimit } from "@/lib/batch";
import { getOrdersByIds } from "@/lib/orders";
import { processBatchOrderPrint } from "@/lib/print-workflow";

export async function POST(request: Request) {
  let body: { orderIds?: string[] };

  try {
    body = (await request.json()) as { orderIds?: string[] };
  } catch {
    return failure("invalid_request", 400);
  }

  if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) {
    return failure("order_ids_required", 400);
  }

  try {
    const session = await getCurrentSession();
    if (!session) {
      return failure("unauthorized", 401);
    }

    const orderIds = [...new Set(body.orderIds)];
    const orders = await getOrdersByIds(orderIds);
    const maxAllowed = getSelectionLimit(
      orders.map((order) => order.store_id),
      orders.flatMap((order) => (order.store ? [order.store] : []))
    );

    if (orderIds.length > maxAllowed) {
      return failure("batch_limit_exceeded", 409);
    }

    const result = await processBatchOrderPrint(
      orderIds,
      getSessionIdentifier(session)
    );
    return success(result);
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Unable to run batch print.",
      500
    );
  }
}
