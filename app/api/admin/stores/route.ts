import { isValidBatchLimit } from "@/lib/admin";
import { failure, success } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("stores GET error:", error);
      return failure("Unable to load stores.", 500);
    }

    return success({
      stores: data ?? []
    });
  } catch (error) {
    console.error("stores GET error:", error);
    return failure("Unable to load stores.", 500);
  }
}

export async function PATCH(request: Request) {
  let body: {
    id?: string;
    batch_limit?: number;
    is_active?: boolean;
  };

  try {
    body = (await request.json()) as {
      id?: string;
      batch_limit?: number;
      is_active?: boolean;
    };
  } catch {
    return failure("invalid_request", 400);
  }

  if (!body.id) {
    return failure("store_id_required", 400);
  }

  const updates: Record<string, unknown> = {};

  if (typeof body.batch_limit === "number") {
    if (!isValidBatchLimit(body.batch_limit)) {
      return failure("invalid_batch_limit", 400);
    }

    updates.batch_limit = body.batch_limit;
  }

  if (typeof body.is_active === "boolean") {
    updates.is_active = body.is_active;
  }

  if (Object.keys(updates).length === 0) {
    return failure("no_store_updates_provided", 400);
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("stores")
      .update(updates)
      .eq("id", body.id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "PGRST116") return failure("store_not_found", 404);
      console.error("stores PATCH error:", error);
      return failure("Unable to update store.", 500);
    }

    return success({
      store: data
    });
  } catch (error) {
    console.error("stores PATCH error:", error);
    return failure("Unable to update store.", 500);
  }
}
