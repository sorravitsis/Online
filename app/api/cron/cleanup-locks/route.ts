import { failure, success } from "@/lib/api";
import { isAuthorizedCronRequest } from "@/lib/cron";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase";

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
    const { data, error } = await supabase
      .from("order_locks")
      .delete()
      .lt("expires_at", new Date().toISOString())
      .select("order_id");

    if (error) {
      return failure(error.message, 500);
    }

    return success({
      deleted: (data ?? []).length
    });
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Unable to clean up locks.",
      500
    );
  }
}
