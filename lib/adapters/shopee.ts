import crypto from "node:crypto";
import { env } from "@/lib/env";
import type { OrderWithStore, PlatformAdapter } from "@/lib/types";

type ShopeeTokenSet = {
  accessToken: string;
  refreshToken?: string | null;
};

function signShopeeRequest(path: string, timestamp: number, accessToken?: string, shopId?: string) {
  const base = `${env.shopee.appId()}${path}${timestamp}${accessToken ?? ""}${shopId ?? ""}`;
  return crypto.createHmac("sha256", env.shopee.appKey()).update(base).digest("hex");
}

async function shopeeFetch<T>(
  path: string,
  body: Record<string, unknown>,
  accessToken?: string,
  shopId?: string
) {
  const timestamp = Math.floor(Date.now() / 1000);
  const url = new URL(`${env.shopee.apiBase()}${path}`);

  url.searchParams.set("partner_id", env.shopee.appId());
  url.searchParams.set("timestamp", String(timestamp));
  url.searchParams.set("sign", signShopeeRequest(path, timestamp, accessToken, shopId));

  if (accessToken) {
    url.searchParams.set("access_token", accessToken);
  }

  if (shopId) {
    url.searchParams.set("shop_id", shopId);
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Shopee request failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function refreshShopeeToken(order: OrderWithStore): Promise<ShopeeTokenSet> {
  const refreshToken = order.store?.refresh_token;

  if (!refreshToken || !order.store) {
    throw new Error("Shopee token expired and no refresh token is available.");
  }

  const response = await shopeeFetch<{
    response?: {
      access_token?: string;
      refresh_token?: string;
    };
    error?: string;
    message?: string;
  }>(
    env.shopee.refreshTokenPath(),
    {
      refresh_token: refreshToken,
      shop_id: Number(order.store.shop_id),
      partner_id: Number(env.shopee.appId())
    },
    undefined,
    order.store.shop_id
  );

  if (!response.response?.access_token) {
    throw new Error(response.message ?? response.error ?? "Unable to refresh Shopee token.");
  }

  return {
    accessToken: response.response.access_token,
    refreshToken: response.response.refresh_token ?? refreshToken
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

function extractTrackingNumber(payload: Record<string, unknown>) {
  return (
    (payload.tracking_number as string | undefined) ??
    (payload.awb_number as string | undefined) ??
    (payload.logistics_channel_id as string | undefined)
  );
}

function extractDocumentUrl(payload: Record<string, unknown>) {
  return (
    (payload.document_url as string | undefined) ??
    (payload.shipping_document_url as string | undefined)
  );
}

export const shopeeAdapter: PlatformAdapter = {
  async generateAWB(order) {
    if (!order.store) {
      throw new Error("Order is missing its store relation.");
    }

    const { accessToken } = await resolveShopeeToken(order);
    const shopId = order.store.shop_id;

    await shopeeFetch(
      env.shopee.initPath(),
      {
        ordersn: order.platform_order_id
      },
      accessToken,
      shopId
    );

    const trackingResponse = await shopeeFetch<{
      response?: Record<string, unknown>;
      error?: string;
      message?: string;
    }>(
      env.shopee.trackingNumberPath(),
      {
        ordersn: order.platform_order_id
      },
      accessToken,
      shopId
    );

    const source = trackingResponse.response ?? {};
    const awbNumber = extractTrackingNumber(source);
    const documentUrl = extractDocumentUrl(source);

    if (!awbNumber) {
      throw new Error(
        trackingResponse.message ??
          trackingResponse.error ??
          "Shopee response did not include an AWB number."
      );
    }

    if (!documentUrl) {
      throw new Error(
        "Shopee response did not include a shipping document URL. Check the configured endpoint paths."
      );
    }

    const pdfResponse = await fetch(documentUrl);

    if (!pdfResponse.ok) {
      throw new Error(`Failed to download Shopee AWB PDF: ${pdfResponse.status}`);
    }

    const pdf = Buffer.from(await pdfResponse.arrayBuffer());

    return {
      pdf,
      awbNumber
    };
  }
};
