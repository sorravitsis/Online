import bcrypt from "bcryptjs";
import { failure, success } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    currentPassword?: string;
    newPassword?: string;
  };

  if (!body.currentPassword || !body.newPassword) {
    return failure("passwords_required", 400);
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("app_config")
      .select("value")
      .eq("key", "admin_password_hash")
      .single();

    if (error || !data?.value) {
      return failure("password_config_missing", 500);
    }

    const matches = await bcrypt.compare(body.currentPassword, data.value);
    if (!matches) {
      return failure("invalid_password", 401);
    }

    const nextHash = await bcrypt.hash(body.newPassword, 10);
    const { error: updateError } = await supabase
      .from("app_config")
      .update({ value: nextHash })
      .eq("key", "admin_password_hash");

    if (updateError) {
      return failure(updateError.message, 500);
    }

    return success({
      updated: true
    });
  } catch (error) {
    return failure(
      error instanceof Error ? error.message : "Unable to update password.",
      500
    );
  }
}
