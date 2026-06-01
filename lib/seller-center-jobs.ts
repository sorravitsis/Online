import { createAdminClient } from "@/lib/supabase";
import type { OrderWithStore, PrintMode, SellerCenterJobRow } from "@/lib/types";

export function isShopeeSellerCenterFallbackError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("shipping_document_should_print_first") ||
    normalized.includes("the package should print first")
  );
}

export async function enqueueSellerCenterJob(input: {
  order: OrderWithStore;
  batchId: string | null;
  batchSize: number | null;
  mode: PrintMode;
  requestedBy: string;
  error: string;
}) {
  if (input.order.store?.platform !== "shopee") {
    throw new Error("seller_center_jobs_only_support_shopee");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("seller_center_jobs")
    .upsert(
      {
        order_id: input.order.id,
        store_id: input.order.store_id,
        platform_order_id: input.order.platform_order_id,
        batch_id: input.batchId,
        batch_size: input.batchSize,
        mode: input.mode,
        status: "queued",
        error_msg: input.error,
        requested_by: input.requestedBy,
        claimed_by: null,
        browser_profile: null,
        processed_at: null
      },
      {
        onConflict: "order_id"
      }
    )
    .select("*")
    .single();

  if (error) {
    throw new Error(`Unable to enqueue Seller Center automation job: ${error.message}`);
  }

  return data as SellerCenterJobRow;
}
