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

function getShopeeResultItems(envelope: ShopeeResponseEnvelope) {
  const response = toRecord(envelope.response);
  const resultList = response.result_list;

  if (!Array.isArray(resultList) || resultList.length === 0) {
    return [];
  }

  return resultList.map((item) => toRecord(item));
}

function getShopeeResultItem(envelope: ShopeeResponseEnvelope) {
  return getShopeeResultItems(envelope)[0];
}

function getShopeeResultFailureMessage(resultItem: Record<string, unknown> | undefined) {
  if (!resultItem) {
    return undefined;
  }

  return asString(resultItem.fail_message) ?? asString(resultItem.fail_error);
}

function getShopeeResultFailureMessages(envelope: ShopeeResponseEnvelope) {
  return getShopeeResultItems(envelope)
    .map((item) => {
      const message = getShopeeResultFailureMessage(item);
      const orderSn = asString(item.order_sn);
      const packageNumber = asString(item.package_number);

      if (!message) {
        return undefined;
      }

      const identity = [orderSn, packageNumber].filter(Boolean).join("/");
      return identity ? `${identity}: ${message}` : message;
    })
    .filter((message): message is string => typeof message === "string" && message.length > 0);
}

function getShopeeEnvelopeFailureMessage(envelope: ShopeeResponseEnvelope) {
  const errorCode = asString(envelope.error);
  const message = asString(envelope.message);
  const resultFailures = getShopeeResultFailureMessages(envelope);

  if (!errorCode) {
    return resultFailures[0];
  }

  const envelopeMessage = message ? `${errorCode}: ${message}` : errorCode;
  return resultFailures.length > 0
    ? `${envelopeMessage}. ${resultFailures.join(" | ")}`
    : envelopeMessage;
}

function assertShopeeEnvelopeSuccess(step: string, envelope: ShopeeResponseEnvelope) {
  const envelopeFailure = getShopeeEnvelopeFailureMessage(envelope);

  if (envelopeFailure) {
    throw new Error(`${step}: ${envelopeFailure}`);
  }
}

export function isShipOrderSelectionError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("ship_order_only_support_one_type") ||
    normalized.includes("please select just one way to ship order") ||
    normalized.includes("pickup or dropoff or non-integrated")
  );
}

function isRetryableDocumentNotReadyError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return (
    normalized.includes("tracking number is invalid") ||
    normalized.includes("tracking_no is invalid") ||
    normalized.includes("tracking number invalid") ||
    normalized.includes("package can not print now") ||
    normalized.includes("document is not yet ready for printing") ||
    normalized.includes("please try again later")
  );
}

export function selectShopeeShippingDocumentTypes(envelope: ShopeeResponseEnvelope) {
  const resultItem = getShopeeResultItem(envelope);
  const failureMessage = getShopeeResultFailureMessage(resultItem);

  if (failureMessage) {
    throw new Error(failureMessage);
  }

  const candidates = [
    asString(resultItem?.suggest_shipping_document_type),
    ...asStringArray(resultItem?.selectable_shipping_document_type),
    "NORMAL_AIR_WAYBILL"
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  return [...new Set(candidates)];
}

export function selectShopeeShippingDocumentType(envelope: ShopeeResponseEnvelope) {
  return selectShopeeShippingDocumentTypes(envelope)[0];
}

export function selectShopeePackageNumber(envelope: ShopeeResponseEnvelope) {
  const resultItem = getShopeeResultItem(envelope);
  const packageNumberFromRoot = asString(resultItem?.package_number);

  if (packageNumberFromRoot) {
    return packageNumberFromRoot;
  }

  const packageList = resultItem?.package_list;
  if (Array.isArray(packageList)) {
    for (const entry of packageList) {
      const packageNumber =
        entry && typeof entry === "object"
          ? asString((entry as Record<string, unknown>).package_number)
          : undefined;

      if (packageNumber) {
        return packageNumber;
      }
    }
  }

  return undefined;
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
  }
): ShopeeOrderListItem[] {
  return [
    {
      order_sn: orderId,
      ...(options?.packageNumber ? { package_number: options.packageNumber } : {}),
      ...(options?.shippingDocumentType
        ? { shipping_document_type: options.shippingDocumentType }
        : {})
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
  const shipmentResponse = await shopeeFetchWithFallback<ShopeeResponseEnvelope>([
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

  const shipmentFailure =
    getShopeeEnvelopeFailureMessage(shipmentResponse) ??
    getShopeeResultFailureMessage(getShopeeResultItem(shipmentResponse));

  if (isShipOrderSelectionError(shipmentFailure)) {
    return;
  }

  if (shipmentFailure) {
    throw new Error(`ship_order: ${shipmentFailure}`);
  }
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
  let lastRetryableMessage: string | null = null;
  let lastCandidateError: Error | null = null;

  for (let pipelineAttempt = 0; pipelineAttempt < 8; pipelineAttempt += 1) {
    try {
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
      assertShopeeEnvelopeSuccess("get_shipping_document_parameter", parameterResponse);

      const shippingDocumentTypes = selectShopeeShippingDocumentTypes(parameterResponse);
      const packageNumber = selectShopeePackageNumber(parameterResponse);
      for (const shippingDocumentType of shippingDocumentTypes) {
        const orderList = buildShopeeOrderList(orderId, {
          packageNumber,
          shippingDocumentType
        });

        try {
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
          assertShopeeEnvelopeSuccess("create_shipping_document", createResponse);

          const createFailure = getShopeeResultFailureMessage(getShopeeResultItem(createResponse));
          if (createFailure) {
            throw new Error(`create_shipping_document: ${createFailure}`);
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
            assertShopeeEnvelopeSuccess("get_shipping_document_result", resultResponse);

            const resultItem = getShopeeResultItem(resultResponse);
            const failureMessage = getShopeeResultFailureMessage(resultItem);
            if (failureMessage) {
              throw new Error(`get_shipping_document_result: ${failureMessage}`);
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
        } catch (error) {
          const candidateMessage =
            error instanceof Error ? error.message : "Shopee shipping document failed.";

          if (isRetryableDocumentNotReadyError(candidateMessage)) {
            throw error;
          }

          lastCandidateError =
            error instanceof Error ? error : new Error("Shopee shipping document failed.");
        }
      }

      if (lastCandidateError) {
        throw lastCandidateError;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Shopee shipping document failed.";
      if (!isRetryableDocumentNotReadyError(message)) {
        throw error;
      }

      lastRetryableMessage = message;
      await sleep(3000);
    }
  }

  throw new Error(lastRetryableMessage ?? "Shopee shipping document failed after retry.");
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
