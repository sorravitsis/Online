import { success } from "@/lib/api";
import { env } from "@/lib/env";

export async function POST() {
  const response = success({
    authenticated: false
  });

  response.cookies.set(env.auth.cookieName, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    path: "/"
  });

  return response;
}
