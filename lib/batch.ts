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
  switch (error) {
    case "order_ids_required":
      return "Choose at least one order before starting the batch.";
    case "batch_limit_exceeded":
      return "The selected orders exceed the allowed batch limit for one of the stores.";
    case "locked":
      return "Some orders are locked by another session.";
    default:
      return error ?? "Batch print failed.";
  }
}

export function summarizeBatchResults(results: PrintResult[]) {
  const printed = results.filter((result) => result.status === "printed").length;
  const failed = results.length - printed;

  return {
    printed,
    failed
  };
}
