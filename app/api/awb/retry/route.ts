import { getCurrentSession, getSessionIdentifier } from "@/lib/auth";
import { failure, success } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase";
import { processSingleOrderPrint } from "@/lib/print-workflow";

const CONFLICT_ERRORS = new Set(["locked", "order_not_pending"]);

function retryErrorStatus(error: string | undefined): number {
  if (!error) return 500;
  if (CONFLICT_ERRORS.has(error)) return 409;
  if (error === "order_not_found") return 404;
  return 500;
}

export async function POST(request: Request) {
  let body: { orderId?: string };

  try {
    body = (await request.json()) as { orderId?: string };
  } catch {
    return failure("invalid_request", 400);
  }

  if (!body.orderId) {
    return failure("order_id_required", 400);
  }

  try {
    const session = await getCurrentSession();
    if (!session) {
      return failure("unauthorized", 401);
    }

    const sessionId = getSessionIdentifier(session);
    if (!checkRateLimit(`awb:retry:${sessionId}`, 30, 60_000)) {
      return failure("too_many_requests", 429);
    }

    const supabase = createAdminClient();
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("id, awb_status")
      .eq("id", body.orderId)
      .single();

    if (fetchError || !order) {
      return failure("order_not_found", 404);
    }

    if (order.awb_status !== "failed") {
      return failure("order_not_failed", 409);
    }

    // Reset to pending so processSingleOrderPrint can pick it up
    const { error: resetError } = await supabase
      .from("orders")
      .update({ awb_status: "pending" })
      .eq("id", body.orderId)
      .eq("awb_status", "failed");

    if (resetError) {
      return failure("Unable to reset order status.", 500);
    }

    const result = await processSingleOrderPrint(body.orderId, sessionId);

    if (result.status === "failed") {
      return failure(result.error ?? "print_failed", retryErrorStatus(result.error));
    }

    return success({
      awbNumber: result.awbNumber,
      orderId: result.orderId,
      status: result.status,
    });
  } catch (error) {
    console.error("awb retry POST error:", error);
    return failure("Unable to retry print.", 500);
  }
}
