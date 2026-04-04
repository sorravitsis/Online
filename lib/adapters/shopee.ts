import crypto from "node:crypto";
import { env } from "@/lib/env";
import type { OrderWithStore, PlatformAdapter } from "@/lib/types";

type ShopeeTokenSet = {
  accessToken: string;
  refreshToken?: string | null;
};

type ShopeeResponseEnvelope = {
  response?: Record<string, unknown>;
  error?: string;
  message?: string;
  warning?: unknown;
};

type ShopeeRefreshResponse = {
  access_token?: string;
  refresh_token?: string;
  expire_in?: number;
  response?: {
    access_token?: string;
    refresh_token?: string;
    expire_in?: number;
  };
  error?: string;
  message?: string;
};

type ShopeeRequestOptions = {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
  accessToken?: string;
  shopId?: string;
  authSignature?: boolean;
};

type ShopeeOrderListItem = {
  order_sn: string;
  package_number?: string;
  shipping_document_type?: string;
  tracking_number?: string;
};

class ShopeeHttpError extends Error {
  status: number;
  path: string;

  constructor(path: string, status: number, message: string) {
    super(message);
    this.name = "ShopeeHttpError";
    this.path = path;
    this.status = status;
  }
}

function signShopeeRequest(
  path: string,
  timestamp: number,
  options?: {
    accessToken?: string;
    shopId?: string;
    authSignature?: boolean;
  }
) {
  if (options?.authSignature) {
    return crypto
      .createHmac("sha256", env.shopee.appKey())
      .update(`${env.shopee.appId()}${path}${timestamp}`)
      .digest("hex");
  }

  return crypto
    .createHmac("sha256", env.shopee.appKey())
    .update(`${env.shopee.appId()}${path}${timestamp}${options?.accessToken ?? ""}${options?.shopId ?? ""}`)
    .digest("hex");
}

async function shopeeRequest(path: string, options: ShopeeRequestOptions = {}) {
  const timestamp = Math.floor(Date.now() / 1000);
  const url = new URL(`${env.shopee.apiBase()}${path}`);

  url.searchParams.set("partner_id", env.shopee.appId());
  url.searchParams.set(
    "sign",
    signShopeeRequest(path, timestamp, {
      accessToken: options.accessToken,
      shopId: options.shopId,
      authSignature: options.authSignature
    })
  );
  url.searchParams.set("timestamp", String(timestamp));

  if (options.accessToken) {
    url.searchParams.set("access_token", options.accessToken);
  }

  if (options.shopId) {
    url.searchParams.set("shop_id", options.shopId);
  }

  const response = await fetch(url, {
    method: options.method ?? "POST",
    headers: options.body
      ? {
          "Content-Type": "application/json"
        }
      : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    const bodyText = await response.text();
    throw new ShopeeHttpError(
      path,
      response.status,
      `Shopee request failed with status ${response.status} on ${path}${
        bodyText ? `: ${bodyText}` : "."
      }`
    );
  }

  return response;
}

async function shopeeFetch<T>(path: string, options: ShopeeRequestOptions = {}) {
  const response = await shopeeRequest(path, options);
  return (await response.json()) as T;
}

async function shopeeBinaryFetch(path: string, options: ShopeeRequestOptions = {}) {
  const response = await shopeeRequest(path, options);
  return Buffer.from(await response.arrayBuffer());
}

export function parseShopeeRefreshTokenResponse(response: ShopeeRefreshResponse): ShopeeTokenSet {
  const source = response.response ?? response;
  const accessToken = source.access_token ?? response.access_token;

  if (!accessToken) {
    throw new Error(response.message ?? response.error ?? "Unable to refresh Shopee token.");
  }

  return {
    accessToken,
    refreshToken: source.refresh_token ?? response.refresh_token ?? null
  };
}

async function shopeeFetchWithFallback<T>(
  attempts: Array<{
    path: string;
    options?: ShopeeRequestOptions;
  }>
) {
  let lastError: unknown = null;

  for (const attempt of attempts) {
    try {
      return await shopeeFetch<T>(attempt.path, attempt.options);
    } catch (error) {
      lastError = error;

      if (!(error instanceof ShopeeHttpError) || error.status !== 404) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Shopee request failed.");
}

function toRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function asStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function getShopeeResultItem(envelope: ShopeeResponseEnvelope) {
  const response = toRecord(envelope.response);
  const resultList = response.result_list;

  if (!Array.isArray(resultList) || resultList.length === 0) {
    return undefined;
  }

  return toRecord(resultList[0]);
}

function getShopeeResultFailureMessage(resultItem: Record<string, unknown> | undefined) {
  if (!resultItem) {
    return undefined;
  }

  return asString(resultItem.fail_message) ?? asString(resultItem.fail_error);
}

export function selectShopeeShippingDocumentType(envelope: ShopeeResponseEnvelope) {
  const resultItem = getShopeeResultItem(envelope);
  const failureMessage = getShopeeResultFailureMessage(resultItem);

  if (failureMessage) {
    throw new Error(failureMessage);
  }

  return (
    asString(resultItem?.suggest_shipping_document_type) ??
    asStringArray(resultItem?.selectable_shipping_document_type)[0] ??
    "NORMAL_AIR_WAYBILL"
  );
}

function extractTrackingNumber(payload: Record<string, unknown>) {
  return (
    asString(payload.tracking_number) ??
    asString(payload.awb_number) ??
    asString(payload.logistics_channel_id)
  );
}

function buildShopeeOrderList(
  orderId: string,
  options?: {
    packageNumber?: string;
    shippingDocumentType?: string;
    trackingNumber?: string;
  }
): ShopeeOrderListItem[] {
  return [
    {
      order_sn: orderId,
      ...(options?.packageNumber ? { package_number: options.packageNumber } : {}),
      ...(options?.shippingDocumentType
        ? { shipping_document_type: options.shippingDocumentType }
        : {}),
      ...(options?.trackingNumber ? { tracking_number: options.trackingNumber } : {})
    }
  ];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function refreshShopeeToken(order: OrderWithStore): Promise<ShopeeTokenSet> {
  const refreshToken = order.store?.refresh_token;

  if (!refreshToken || !order.store) {
    throw new Error("Shopee token expired and no refresh token is available.");
  }

  const response = await shopeeFetch<ShopeeRefreshResponse>(env.shopee.refreshTokenPath(), {
    body: {
      refresh_token: refreshToken,
      shop_id: Number(order.store.shop_id),
      partner_id: Number(env.shopee.appId())
    },
    shopId: order.store.shop_id,
    authSignature: true
  });

  const parsed = parseShopeeRefreshTokenResponse(response);
  return {
    accessToken: parsed.accessToken,
    refreshToken: parsed.refreshToken ?? refreshToken
  };
}

async function resolveShopeeToken(order: OrderWithStore): Promise<ShopeeTokenSet> {
  if (!order.store?.access_token || !order.store.shop_id) {
    throw new Error("Shopee credentials are missing on the store record.");
  }

  if (!order.store.token_expiry) {
    return {
      accessToken: order.store.access_token,
      refreshToken: order.store.refresh_token
    };
  }

  const expiry = new Date(order.store.token_expiry).getTime();
  if (expiry > Date.now() + 30000) {
    return {
      accessToken: order.store.access_token,
      refreshToken: order.store.refresh_token
    };
  }

  return refreshShopeeToken(order);
}

async function arrangeShopeeShipment(order: OrderWithStore, accessToken: string, shopId: string) {
  await shopeeFetchWithFallback<ShopeeResponseEnvelope>([
    {
      path: env.shopee.initPath(),
      options: {
        body: {
          ordersn: order.platform_order_id
        },
        accessToken,
        shopId
      }
    },
    {
      path: "/api/v2/logistics/ship_order",
      options: {
        body: {
          ordersn: order.platform_order_id
        },
        accessToken,
        shopId
      }
    },
    {
      path: "/api/v2/logistics/ship_order",
      options: {
        body: {
          order_sn: order.platform_order_id
        },
        accessToken,
        shopId
      }
    }
  ]);
}

async function tryResolveTrackingNumber(orderId: string, accessToken: string, shopId: string) {
  try {
    const trackingResponse = await shopeeFetchWithFallback<ShopeeResponseEnvelope>([
      {
        path: env.shopee.trackingNumberPath(),
        options: {
          body: {
            ordersn: orderId
          },
          accessToken,
          shopId
        }
      },
      {
        path: env.shopee.trackingNumberPath(),
        options: {
          body: {
            order_sn: orderId
          },
          accessToken,
          shopId
        }
      }
    ]);

    return extractTrackingNumber(toRecord(trackingResponse.response));
  } catch (error) {
    if (error instanceof ShopeeHttpError && error.status === 404) {
      return undefined;
    }

    throw error;
  }
}

async function fetchShopeeShippingDocument(
  orderId: string,
  accessToken: string,
  shopId: string,
  trackingNumber?: string
) {
  const parameterResponse = await shopeeFetch<ShopeeResponseEnvelope>(
    env.shopee.shippingDocumentParameterPath(),
    {
      body: {
        order_list: buildShopeeOrderList(orderId)
      },
      accessToken,
      shopId
    }
  );

  const shippingDocumentType = selectShopeeShippingDocumentType(parameterResponse);
  const orderList = buildShopeeOrderList(orderId, {
    shippingDocumentType,
    trackingNumber
  });

  const createResponse = await shopeeFetch<ShopeeResponseEnvelope>(
    env.shopee.createShippingDocumentPath(),
    {
      body: {
        order_list: orderList
      },
      accessToken,
      shopId
    }
  );

  const createFailure = getShopeeResultFailureMessage(getShopeeResultItem(createResponse));
  if (createFailure) {
    throw new Error(createFailure);
  }

  let readyResponse: ShopeeResponseEnvelope | null = null;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const resultResponse = await shopeeFetch<ShopeeResponseEnvelope>(
      env.shopee.shippingDocumentResultPath(),
      {
        body: {
          order_list: orderList
        },
        accessToken,
        shopId
      }
    );

    const resultItem = getShopeeResultItem(resultResponse);
    const failureMessage = getShopeeResultFailureMessage(resultItem);
    if (failureMessage) {
      throw new Error(failureMessage);
    }

    const status = asString(resultItem?.status)?.toUpperCase();
    if (!status || status === "READY" || status === "SUCCESS" || status === "COMPLETED") {
      readyResponse = resultResponse;
      break;
    }

    await sleep(1000);
  }

  if (!readyResponse) {
    throw new Error("Shopee shipping document task did not become ready in time.");
  }

  const pdf = await shopeeBinaryFetch(env.shopee.downloadShippingDocumentPath(), {
    body: {
      order_list: orderList
    },
    accessToken,
    shopId
  });

  const readyResult = getShopeeResultItem(readyResponse);
  return {
    pdf,
    trackingNumber:
      trackingNumber ??
      extractTrackingNumber(toRecord(readyResponse.response)) ??
      extractTrackingNumber(readyResult ?? {})
  };
}

export const shopeeAdapter: PlatformAdapter = {
  async generateAWB(order) {
    if (!order.store) {
      throw new Error("Order is missing its store relation.");
    }

    const { accessToken } = await resolveShopeeToken(order);
    const shopId = order.store.shop_id;

    await arrangeShopeeShipment(order, accessToken, shopId);

    const trackingNumber = await tryResolveTrackingNumber(order.platform_order_id, accessToken, shopId);
    const document = await fetchShopeeShippingDocument(
      order.platform_order_id,
      accessToken,
      shopId,
      trackingNumber
    );

    return {
      pdf: document.pdf,
      awbNumber: document.trackingNumber ?? order.platform_order_id
    };
  }
};
