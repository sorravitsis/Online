import { getCurrentSession, getSessionIdentifier } from "@/lib/auth";
import { failure, success } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { processSingleOrderPrint } from "@/lib/print-workflow";

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
    if (!checkRateLimit(`awb:single:${sessionId}`, 60, 60_000)) {
      return failure("too_many_requests", 429);
    }

    const result = await processSingleOrderPrint(body.orderId, sessionId);

    if (result.status === "failed") {
      const status =
        result.error === "already_printed"
          ? 409
          : result.error === "locked"
            ? 409
            : result.error === "order_not_pending"
              ? 409
            : result.error === "order_not_found"
              ? 404
              : 500;

      return failure(result.error ?? "print_failed", status);
    }

    return success({
      awbNumber: result.awbNumber,
      orderId: result.orderId,
      status: result.status
    });
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Unable to print order.",
      500
    );
  }
}
