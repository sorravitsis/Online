import { env } from "@/lib/env";
import {
  callLazadaApi,
  ensureLazadaAccessToken,
  unwrapLazadaResult
} from "@/lib/lazada";
import { isPdfBuffer } from "@/lib/print-documents";
import { asArray, asString, toRecord } from "@/lib/adapters/utils";
import type { OrderWithStore, PlatformAdapter } from "@/lib/types";

type LazadaOrderItem = Record<string, unknown>;

type LazadaPackItemResult = {
  tracking_number?: string;
  package_id?: string;
  item_err_code?: string | number;
  msg?: string;
};

type LazadaPackageActionResult = {
  package_id?: string;
  item_err_code?: string | number;
  msg?: string;
  retry?: boolean;
};

export function normalizeLazadaOrderItems(envelope: Record<string, unknown>) {
  const data = unwrapLazadaResult<unknown>(envelope, "get_order_items");

  if (Array.isArray(data)) {
    return data.map((item) => toRecord(item));
  }

  const record = toRecord(data);
  const list = asArray(
    record.order_items ?? record.orderItems ?? record.items ?? record.list
  );

  return list.map((item) => toRecord(item));
}

function lower(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

export function selectLazadaOrderItemIds(items: LazadaOrderItem[]) {
  const blockedStatuses = new Set(["canceled", "cancelled", "unpaid"]);

  return items
    .filter((item) => !blockedStatuses.has(lower(item.status ?? item.order_item_status)))
    .map((item) =>
      asString(item.order_item_id) ??
      asString(item.orderItemId) ??
      (typeof item.order_item_id === "number" ? String(item.order_item_id) : undefined)
    )
    .filter((value): value is string => Boolean(value));
}

export function selectLazadaPackageIds(items: LazadaOrderItem[]) {
  return Array.from(
    new Set(
      items
        .map((item) => asString(item.package_id) ?? asString(item.packageId))
        .filter((value): value is string => Boolean(value))
    )
  );
}

export function selectLazadaTrackingNumbers(items: LazadaOrderItem[]) {
  return Array.from(
    new Set(
      items
        .map(
          (item) =>
            asString(item.tracking_code) ??
            asString(item.trackingCode) ??
            asString(item.tracking_no) ??
            asString(item.trackingNumber)
        )
        .filter((value): value is string => Boolean(value))
    )
  );
}

export function isLazadaSellerOwnFleet(items: LazadaOrderItem[]) {
  return items.some((item) => `${item.delivery_option_sof ?? "0"}` === "1");
}

function inferShippingAllocateType(items: LazadaOrderItem[]) {
  const crossBorderSignals = items.some((item) => {
    const shippingType = lower(item.shipping_type ?? item.shippingType);
    const origin = lower(item.origin ?? item.origin_name);
    return (
      shippingType.includes("ntfs") ||
      shippingType.includes("cross") ||
      origin.includes("cross") ||
      origin.includes("oversea")
    );
  });

  return crossBorderSignals ? ["NTFS", "TFS"] : ["TFS", "NTFS"];
}

function parsePackResponse(envelope: Record<string, unknown>) {
  const data = unwrapLazadaResult<Record<string, unknown>>(envelope, "pack_order");
  const packOrders = asArray(data.pack_order_list).map((item) => toRecord(item));
  const orderItems = packOrders.flatMap((packOrder) =>
    asArray(packOrder.order_item_list).map((item) => toRecord(item) as LazadaPackItemResult)
  );

  const failed = orderItems.filter((item) => `${item.item_err_code ?? "0"}` !== "0");
  if (failed.length > 0) {
    const message = failed
      .map((item) => `${item.package_id ?? "unknown_package"}: ${item.msg ?? "pack_failed"}`)
      .join("; ");
    throw new Error(`pack_order: ${message}`);
  }

  return {
    packageIds: Array.from(
      new Set(orderItems.map((item) => item.package_id).filter((value): value is string => Boolean(value)))
    ),
    trackingNumbers: Array.from(
      new Set(
        orderItems
          .map((item) => item.tracking_number)
          .filter((value): value is string => Boolean(value))
      )
    )
  };
}

function isIgnorableReadyToShipMessage(message: string | undefined) {
  const normalized = lower(message);

  return (
    normalized.includes("already ready to ship") ||
    normalized.includes("already in ready to ship") ||
    normalized.includes("already rts")
  );
}

function parseReadyToShipResponse(envelope: Record<string, unknown>) {
  const data = unwrapLazadaResult<Record<string, unknown>>(envelope, "ready_to_ship");
  const packages = asArray(data.packages ?? data.package_list).map(
    (item) => toRecord(item) as LazadaPackageActionResult
  );

  const failed = packages.filter((item) => {
    const code = `${item.item_err_code ?? "0"}`;
    if (code === "0") {
      return false;
    }

    return !isIgnorableReadyToShipMessage(item.msg);
  });

  if (failed.length > 0) {
    const message = failed
      .map((item) => `${item.package_id ?? "unknown_package"}: ${item.msg ?? "ready_to_ship_failed"}`)
      .join("; ");
    throw new Error(`ready_to_ship: ${message}`);
  }
}

function deriveSellerCenterOrigin() {
  const apiUrl = new URL(env.lazada.apiBase());
  return `${apiUrl.protocol}//sellercenter.${apiUrl.hostname.replace(/^api\./, "")}`;
}

function extractPdfUrlFromBuffer(buffer: Buffer) {
  const html = buffer.toString("utf8");
  const match = html.match(/src=["']([^"']+)["']/i);
  if (!match) {
    return null;
  }

  const candidate = match[1];
  if (!candidate) {
    return null;
  }

  return candidate.startsWith("http")
    ? candidate
    : new URL(candidate, deriveSellerCenterOrigin()).toString();
}

export function extractLazadaDocumentData(envelope: Record<string, unknown>) {
  const data = unwrapLazadaResult<Record<string, unknown>>(envelope, "print_awb");
  const pdfUrl = asString(data.pdf_url);
  const file = asString(data.file);

  if (!file && !pdfUrl) {
    throw new Error("print_awb: Lazada did not return a document payload.");
  }

  if (pdfUrl) {
    return {
      pdfUrl,
      inlineBuffer: file ? Buffer.from(file, "base64") : null
    };
  }

  return {
    pdfUrl: null,
    inlineBuffer: file ? Buffer.from(file, "base64") : null
  };
}

async function downloadPdf(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`print_awb_download: Lazada document download failed with status ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function resolveDocumentPdf(envelope: Record<string, unknown>) {
  const { pdfUrl, inlineBuffer } = extractLazadaDocumentData(envelope);

  if (pdfUrl) {
    return downloadPdf(pdfUrl);
  }

  if (inlineBuffer && isPdfBuffer(inlineBuffer)) {
    return inlineBuffer;
  }

  if (inlineBuffer) {
    const iframeUrl = extractPdfUrlFromBuffer(inlineBuffer);
    if (iframeUrl) {
      return downloadPdf(iframeUrl);
    }
  }

  throw new Error("print_awb: Lazada returned a document payload that could not be resolved to PDF.");
}

async function callWithPayloadFallback(
  path: string,
  accessToken: string,
  payload: Record<string, unknown>,
  payloadParamNames: string[]
) {
  let lastError: unknown = null;

  for (const payloadParamName of payloadParamNames) {
    try {
      return await callLazadaApi(
        env.lazada.apiBase(),
        path,
        {},
        {
          accessToken,
          method: "POST",
          payloadParamName,
          payload
        }
      );
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Lazada request failed for ${path}`);
}

async function ensurePackages(
  order: OrderWithStore,
  accessToken: string,
  items: LazadaOrderItem[]
) {
  const existingPackageIds = selectLazadaPackageIds(items);
  const existingTrackingNumbers = selectLazadaTrackingNumbers(items);
  if (existingPackageIds.length > 0) {
    return {
      packageIds: existingPackageIds,
      trackingNumbers: existingTrackingNumbers
    };
  }

  const orderItemIds = selectLazadaOrderItemIds(items);
  if (orderItemIds.length === 0) {
    throw new Error("pack_order: Lazada order has no packable order items.");
  }

  const shippingAllocateTypes = inferShippingAllocateType(items);
  let lastError: unknown = null;

  for (const shippingAllocateType of shippingAllocateTypes) {
    try {
      const packEnvelope = await callWithPayloadFallback(
        "/order/fulfill/pack",
        accessToken,
        {
          pack_order_list: [
            {
              order_item_list: orderItemIds.map((value) =>
                /^\d+$/.test(value) ? Number(value) : value
              ),
              order_id: /^\d+$/.test(order.platform_order_id)
                ? Number(order.platform_order_id)
                : order.platform_order_id
            }
          ],
          delivery_type: "dropship",
          shipping_allocate_type: shippingAllocateType
        },
        ["packReq", "payload"]
      );

      return parsePackResponse(packEnvelope);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("pack_order: Unable to pack Lazada order.");
}

async function printAwbForPackages(accessToken: string, packageIds: string[]) {
  return callWithPayloadFallback(
    "/order/package/document/get",
    accessToken,
    {
      doc_type: "PDF",
      packages: packageIds.map((packageId) => ({
        package_id: packageId
      }))
    },
    ["getDocumentReq", "payload"]
  );
}

async function markPackagesReadyToShip(accessToken: string, packageIds: string[]) {
  const envelope = await callWithPayloadFallback(
    "/order/package/rts",
    accessToken,
    {
      packages: packageIds.map((packageId) => ({
        package_id: packageId
      }))
    },
    ["readyToShipReq", "rtsReq", "payload"]
  );

  parseReadyToShipResponse(envelope);
}

export const lazadaAdapter: PlatformAdapter = {
  async generateAWB(order) {
    if (!order.store) {
      throw new Error("Lazada order is missing store information.");
    }

    const token = await ensureLazadaAccessToken(order.store);
    const itemsEnvelope = await callLazadaApi(
      env.lazada.apiBase(),
      "/order/items/get",
      {
        order_id: order.platform_order_id
      },
      {
        accessToken: token.accessToken,
        method: "GET"
      }
    );

    const items = normalizeLazadaOrderItems(itemsEnvelope);
    if (items.length === 0) {
      throw new Error("get_order_items: Lazada did not return any order items.");
    }

    if (isLazadaSellerOwnFleet(items)) {
      throw new Error(
        "Lazada order uses Seller Own Fleet and cannot print AWB with the integrated PrintAWB API."
      );
    }

    const packed = await ensurePackages(order, token.accessToken, items);
    if (packed.packageIds.length === 0) {
      throw new Error("print_awb: Lazada did not return any package ids.");
    }

    const documentEnvelope = await printAwbForPackages(token.accessToken, packed.packageIds);
    const pdf = await resolveDocumentPdf(documentEnvelope);
    await markPackagesReadyToShip(token.accessToken, packed.packageIds);

    return {
      pdf,
      awbNumber:
        packed.trackingNumbers.join(",") ||
        packed.packageIds.join(",") ||
        order.platform_order_id
    };
  }
};
