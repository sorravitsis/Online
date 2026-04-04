export function mapScanError(error?: string) {
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
