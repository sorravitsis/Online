import bcrypt from "bcryptjs";
import { z } from "zod";
import { failure, success } from "@/lib/api";
import { signSessionToken } from "@/lib/auth";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase";

const schema = z.object({
  password: z.string().min(1)
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());

  if (!parsed.success) {
    return failure("invalid_request", 400);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "admin_password_hash")
    .single();

  if (error || !data?.value) {
    return failure("password_config_missing", 500);
  }

  const isValid = await bcrypt.compare(parsed.data.password, data.value);
  if (!isValid) {
    return failure("invalid_password", 401);
  }

  const token = await signSessionToken("warehouse-user");
  const response = success({
    authenticated: true
  });

  response.cookies.set(env.auth.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
    path: "/"
  });

  return response;
}
