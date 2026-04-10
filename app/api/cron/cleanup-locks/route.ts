import { failure, success } from "@/lib/api";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { env } from "@/lib/env";
import { getOrderRetentionCutoff } from "@/lib/orders";
import { createAdminClient } from "@/lib/supabase";

function chunkValues(values: string[], size: number) {
  const chunks: string[][] = [];

  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }

  return chunks;
}

export async function GET(request: Request) {
  if (
    !isAuthorizedCronRequest(
      request.headers.get("authorization"),
      env.cron.secret()
    )
  ) {
    return failure("unauthorized", 401);
  }

  try {
    const supabase = createAdminClient();
    const { data: expiredLocks, error: lockError } = await supabase
      .from("order_locks")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("order_id");

    if (lockError) {
      return failure(lockError.message, 500);
    }

    const retentionCutoff = getOrderRetentionCutoff();
    const { data: staleOrders, error: staleOrdersError } = await supabase
      .from("orders")
      .select("id")
      .lt("created_at", retentionCutoff);

    if (staleOrdersError) {
      return failure(staleOrdersError.message, 500);
    }

    const staleOrderIds = (staleOrders ?? []).map((row) => row.id).filter(Boolean);
    let deletedPrintJobs = 0;
    let deletedPrintLogs = 0;
    let deletedOrderLocks = (expiredLocks ?? []).length;
    let deletedOrders = 0;

    for (const batch of chunkValues(staleOrderIds, 200)) {
      const { data: oldLocks, error: oldLocksError } = await supabase
        .from("order_locks")
        .delete()
        .in("order_id", batch)
        .select("order_id");

      if (oldLocksError) {
        return failure(oldLocksError.message, 500);
      }

      deletedOrderLocks += (oldLocks ?? []).length;

      const { data: printJobs, error: printJobsError } = await supabase
        .from("print_jobs")
        .delete()
        .in("order_id", batch)
        .select("id");

      if (printJobsError) {
        return failure(printJobsError.message, 500);
      }

      deletedPrintJobs += (printJobs ?? []).length;

      const { data: printLogs, error: printLogsError } = await supabase
        .from("print_log")
        .delete()
        .in("order_id", batch)
        .select("id");

      if (printLogsError) {
        return failure(printLogsError.message, 500);
      }

      deletedPrintLogs += (printLogs ?? []).length;

      const { data: removedOrders, error: removeOrdersError } = await supabase
        .from("orders")
        .delete()
        .in("id", batch)
        .select("id");

      if (removeOrdersError) {
        return failure(removeOrdersError.message, 500);
      }

      deletedOrders += (removedOrders ?? []).length;
    }

    return success({
      deletedLocks: deletedOrderLocks,
      deletedPrintJobs,
      deletedPrintLogs,
      deletedOrders,
      retentionCutoff
    });
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Unable to clean up locks.",
      500
    );
  }
}
