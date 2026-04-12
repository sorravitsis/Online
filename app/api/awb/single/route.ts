import { getCurrentSession, getSessionIdentifier } from "@/lib/auth";
import { failure, success } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { processSingleOrderPrint } from "@/lib/print-workflow";

const CONFLICT_ERRORS = new Set(["already_printed", "locked", "order_not_pending"]);

function printErrorStatus(error: string | undefined): number {
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
    if (!checkRateLimit(`awb:single:${sessionId}`, 60, 60_000)) {
      return failure("too_many_requests", 429);
    }

    const result = await processSingleOrderPrint(body.orderId, sessionId);

    if (result.status === "failed") {
      return failure(result.error ?? "print_failed", printErrorStatus(result.error));
    }

    return success({
      awbNumber: result.awbNumber,
      orderId: result.orderId,
      status: result.status
    });
  } catch (error) {
    console.error("awb single POST error:", error);
    return failure("Unable to print order.", 500);
  }
}
