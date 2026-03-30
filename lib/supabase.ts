import type { CookieOptions } from "@supabase/ssr";
import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export async function createServerClient() {
  const { cookies } = await import("next/headers");
  const cookieStore = cookies();

  return createSSRServerClient(env.supabase.url(), env.supabase.anonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(
        cookiesToSet: Array<{
          name: string;
          value: string;
          options: CookieOptions;
        }>
      ) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      }
    }
  });
}

export function createBrowserClient() {
  return createClient(env.supabase.url(), env.supabase.anonKey());
}

export function createAdminClient() {
  return createClient(env.supabase.url(), env.supabase.serviceRoleKey(), {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
