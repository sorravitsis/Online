import type { PrintResult, StoreRow } from "@/lib/types";

export function getSelectionLimit(
  selectedStoreIds: string[],
  stores: StoreRow[],
  fallback = 20
) {
  if (selectedStoreIds.length === 0) {
    return fallback;
  }

  const selectedLimits = selectedStoreIds
    .map((storeId) => stores.find((store) => store.id === storeId)?.batch_limit)
    .filter((limit): limit is number => typeof limit === "number" && limit > 0);

  if (selectedLimits.length === 0) {
    return fallback;
  }

  return Math.min(...selectedLimits);
}

export function mapBatchError(error?: string) {
  if (error?.startsWith("shopee_awb_not_ready::")) {
    const detail = error.slice("shopee_awb_not_ready::".length).trim();
    return detail
      ? `Shopee has not finished generating one of the AWBs yet. ${detail}`
      : "Shopee has not finished generating one of the AWBs yet. Retry the batch shortly.";
  }

  switch (error) {
    case "invalid_request":
      return "The batch request payload could not be read.";
    case "unauthorized":
      return "Your session expired. Sign in again before starting a batch.";
    case "order_ids_required":
      return "Choose at least one order before starting the batch.";
    case "batch_limit_exceeded":
      return "The selected orders exceed the allowed batch limit for one of the stores.";
    case "already_printed":
      return "This order was already printed and cannot be batched again.";
    case "locked":
      return "Some orders are locked by another session.";
    case "order_not_found":
      return "One of the selected orders no longer exists.";
    case "order_not_pending":
      return "One of the selected orders is no longer pending.";
    case "shopee_awb_not_ready":
      return "Shopee has not finished generating one of the AWBs yet. Retry the batch shortly.";
    default:
      return error ?? "Batch print failed.";
  }
}

export function summarizeBatchResults(results: PrintResult[]) {
  const printed = results.filter((result) => result.status === "printed").length;
  const queued = results.filter((result) => result.status === "queued").length;
  const failed = results.filter((result) => result.status === "failed").length;

  return {
    printed,
    queued,
    failed
  };
}
