import { failure, success } from "@/lib/api";
import { processBatchOrderPrint } from "@/lib/print-workflow";

export async function POST(request: Request) {
  const body = (await request.json()) as { orderIds?: string[] };

  if (!Array.isArray(body.orderIds) || body.orderIds.length === 0) {
    return failure("order_ids_required", 400);
  }

  try {
    const result = await processBatchOrderPrint(body.orderIds, "app-session");
    return success(result);
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Unable to run batch print.",
      500
    );
  }
}
