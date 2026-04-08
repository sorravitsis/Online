import { NextResponse } from "next/server";
import { connectLazadaStore, verifyLazadaConnectState } from "@/lib/lazada";
import { createAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

function redirectToAdmin(status: "connected" | "error", message?: string, store?: string) {
  const url = new URL("/admin", "http://localhost");
  url.searchParams.set("lazada", status);

  if (message) {
    url.searchParams.set("message", message);
  }

  if (store) {
    url.searchParams.set("store", store);
  }

  return url.pathname + url.search;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return NextResponse.redirect(
      new URL(redirectToAdmin("error", "missing_lazada_callback_params"), request.url)
    );
  }

  try {
    await verifyLazadaConnectState(state);

    const connectedStore = await connectLazadaStore(code);
    const supabase = createAdminClient();
    const { data: existingStore, error: lookupError } = await supabase
      .from("stores")
      .select("id")
      .eq("platform", "lazada")
      .eq("shop_id", connectedStore.shopId)
      .maybeSingle();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (existingStore?.id) {
      const { error } = await supabase
        .from("stores")
        .update({
          name: connectedStore.name,
          access_token: connectedStore.accessToken,
          refresh_token: connectedStore.refreshToken,
          token_expiry: connectedStore.tokenExpiry,
          is_active: true
        })
        .eq("id", existingStore.id);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await supabase.from("stores").insert({
        name: connectedStore.name,
        platform: "lazada",
        shop_id: connectedStore.shopId,
        access_token: connectedStore.accessToken,
        refresh_token: connectedStore.refreshToken,
        token_expiry: connectedStore.tokenExpiry,
        batch_limit: 20,
        is_active: true
      });

      if (error) {
        throw new Error(error.message);
      }
    }

    return NextResponse.redirect(
      new URL(
        redirectToAdmin("connected", undefined, connectedStore.name),
        request.url
      )
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "lazada_store_connection_failed";

    return NextResponse.redirect(
      new URL(redirectToAdmin("error", message), request.url)
    );
  }
}
