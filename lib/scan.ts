export function mapScanError(error?: string) {
  if (error?.startsWith("shopee_awb_not_ready::")) {
    const detail = error.slice("shopee_awb_not_ready::".length).trim();
    return detail
      ? `Shopee has not finished generating the AWB yet. ${detail}`
      : "Shopee has not finished generating the AWB yet. Please wait a moment and retry.";
  }

  switch (error) {
    case "invalid_request":
      return "The print request could not be read. Please scan again.";
    case "unauthorized":
      return "Your session expired. Sign in again before printing.";
    case "already_printed":
      return "This order was already printed. Check the existing AWB before retrying.";
    case "locked":
      return "This order is locked by another session right now.";
    case "order_not_found":
      return "Order not found for this barcode.";
    case "order_not_pending":
      return "This order is not in a printable pending state.";
    case "shopee_awb_not_ready":
      return "Shopee has not finished generating the AWB yet. Please wait a moment and retry.";
    case "order_id_required":
      return "The selected order is missing its internal identifier.";
    default:
      return error ?? "Print failed. Please retry.";
  }
}

export function mapScanSuccess(status: "printed" | "queued", awbNumber: string) {
  if (status === "queued") {
    return `Print queued. AWB: ${awbNumber}. The warehouse print agent will complete it shortly.`;
  }

  return `Print succeeded. AWB: ${awbNumber}`;
}

export function summarizeItems(items: unknown) {
  if (!Array.isArray(items) || items.length === 0) {
    return "No item details";
  }

  const names = items
    .map((entry) => {
      if (entry && typeof entry === "object" && "name" in entry) {
        return String(entry.name);
      }

      if (entry && typeof entry === "object" && "item_name" in entry) {
        return String(entry.item_name);
      }

      return null;
    })
    .filter(Boolean) as string[];

  if (names.length === 0) {
    return `${items.length} items`;
  }

  if (names.length === 1) {
    return names[0];
  }

  return `${names[0]} +${names.length - 1} more`;
}

export type ItemDisplay = {
  name: string;
  qty: number;
  sku?: string;
  packageId?: string;
  trackingCode?: string;
};

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function num(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

export function extractOrderItems(items: unknown): ItemDisplay[] {
  if (!Array.isArray(items) || items.length === 0) return [];

  const result: ItemDisplay[] = [];

  for (const entry of items) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;

    const name =
      str(e.name) ??
      str(e.item_name) ??
      str(e.product_name) ??
      "Unknown item";

    const qty =
      num(e.quantity) ??
      num(e.model_quantity_purchased) ??
      num(e.qty) ??
      1;

    result.push({
      name,
      qty,
      sku: str(e.sku) ?? str(e.model_sku),
      packageId: str(e.package_id) ?? str(e.packageId),
      trackingCode:
        str(e.tracking_code) ??
        str(e.tracking_no) ??
        str(e.trackingCode)
    });
  }

  return result;
}
