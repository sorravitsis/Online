import { getCurrentSession, getSessionIdentifier } from "@/lib/auth";
import { failure, success } from "@/lib/api";
import { checkRateLimit } from "@/lib/rate-limit";
import { syncLazadaOrders } from "@/lib/lazada-sync";

export async function POST(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return failure("unauthorized", 401);
  }

  const sessionId = getSessionIdentifier(session);
  if (!checkRateLimit(`lazada:sync:${sessionId}`, 5, 60_000)) {
    return failure("too_many_requests", 429);
  }

  let body: { storeId?: string } = {};
  try {
    body = (await request.json()) as { storeId?: string };
  } catch {
    // empty body is fine — sync all Lazada stores
  }

  try {
    const result = await syncLazadaOrders(body.storeId);
    return success(result);
  } catch (error) {
    console.error("Lazada sync error:", error);
    return failure("sync_failed", 500);
  }
}
