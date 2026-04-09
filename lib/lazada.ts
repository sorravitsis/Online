import { SignJWT, jwtVerify } from "jose";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase";
import type { StoreRow } from "@/lib/types";

const encoder = new TextEncoder();
const LAZADA_STATE_AUDIENCE = "lazada-connect";

type LazadaAuthStatePayload = {
  provider: "lazada";
  returnTo: string;
  aud: string;
};

type LazadaTokenEnvelope = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number | string;
  refresh_expires_in?: number | string;
  country_user_info?: Array<Record<string, unknown>>;
  account?: string;
  account_platform?: string;
  account_id?: string | number;
  seller_id?: string | number;
  seller_name?: string;
  code?: string;
  message?: string;
};

type LazadaSellerEnvelope = {
  data?: Record<string, unknown>;
  code?: string | number;
  message?: string;
};

type LazadaApiCallOptions = {
  accessToken?: string;
  method?: "GET" | "POST";
  payloadParamName?: string;
  payload?: unknown;
};

export type LazadaConnectedStore = {
  shopId: string;
  name: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiry: string | null;
};

function getSecret() {
  return encoder.encode(env.auth.secret());
}

export async function signLazadaConnectState(returnTo = "/admin") {
  return new SignJWT({
    provider: "lazada",
    returnTo,
    aud: LAZADA_STATE_AUDIENCE
  } satisfies LazadaAuthStatePayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(getSecret());
}

export async function verifyLazadaConnectState(token: string) {
  const verified = await jwtVerify(token, getSecret());

  const payload = verified.payload as LazadaAuthStatePayload;
  if (
    payload.provider !== "lazada" ||
    payload.aud !== LAZADA_STATE_AUDIENCE
  ) {
    throw new Error("invalid_lazada_state");
  }

  return payload;
}

export function buildLazadaAuthorizeUrl(state: string) {
  const url = new URL("/oauth/authorize", env.lazada.authBase());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("force_auth", "true");
  url.searchParams.set("redirect_uri", env.lazada.redirectUri());
  url.searchParams.set("client_id", env.lazada.appKey());
  url.searchParams.set("state", state);
  return url.toString();
}

export function signLazadaRequest(
  path: string,
  params: Record<string, string>,
  appSecret: string
) {
  const payload = Object.keys(params)
    .filter((key) => key !== "sign" && params[key] !== undefined)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `${key}${params[key]}`)
    .join("");

  return createHmac("sha256", appSecret)
    .update(`${path}${payload}`, "utf8")
    .digest("hex")
    .toUpperCase();
}

export async function callLazadaApi(
  baseUrl: string,
  path: string,
  params: Record<string, string>,
  options?: LazadaApiCallOptions
) {
  const requestUrl = new URL(
    `${baseUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`
  );
  const signedParams: Record<string, string> = {
    ...params,
    app_key: env.lazada.appKey(),
    sign_method: "sha256",
    timestamp: Date.now().toString()
  };

  if (options?.accessToken) {
    signedParams.access_token = options.accessToken;
  }

  if (options?.payloadParamName && options.payload !== undefined) {
    signedParams[options.payloadParamName] = JSON.stringify(options.payload);
  }

  signedParams.sign = signLazadaRequest(
    path,
    signedParams,
    env.lazada.appSecret()
  );

  for (const [key, value] of Object.entries(signedParams)) {
    requestUrl.searchParams.set(key, value);
  }

  const response = await fetch(requestUrl.toString(), {
    method: options?.method ?? "GET"
  });
  const text = await response.text();

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      `Lazada returned a non-JSON response for ${path}: ${text.slice(0, 160)}`
    );
  }
}

export async function exchangeLazadaCode(code: string) {
  const json = (await callLazadaApi(
    `${env.lazada.authBase().replace(/\/$/, "")}/rest`,
    "/auth/token/create",
    {
      code
    },
    {
      method: "GET"
    }
  )) as LazadaTokenEnvelope;

  if (!json.access_token) {
    throw new Error(json.message ?? "lazada_token_exchange_failed");
  }

  return json;
}

export async function getLazadaSeller(accessToken: string) {
  const json = (await callLazadaApi(
    env.lazada.apiBase(),
    "/seller/get",
    {},
    {
      accessToken,
      method: "GET"
    }
  )) as LazadaSellerEnvelope;

  if (`${json.code ?? "0"}` !== "0" && !json.data) {
    throw new Error(json.message ?? "lazada_seller_lookup_failed");
  }

  return json;
}

function asString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function getLazadaEnvelopeMessage(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;

  return (
    asString(record.message) ??
    asString(record.msg) ??
    asString(record.error_message) ??
    asString(record.error)
  );
}

function getLazadaEnvelopeCode(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  return asString(record.code) ?? asString(record.error_code) ?? asString(record.err_code);
}

export function unwrapLazadaResult<T>(
  envelope: Record<string, unknown>,
  context: string
) {
  const code = getLazadaEnvelopeCode(envelope) ?? "0";
  if (code !== "0") {
    throw new Error(
      `${context}: ${getLazadaEnvelopeMessage(envelope) ?? `Lazada API failed with code ${code}`}`
    );
  }

  const result = envelope.result;
  if (!result || typeof result !== "object") {
    return (envelope.data ?? envelope) as T;
  }

  const resultRecord = result as Record<string, unknown>;
  if (resultRecord.success === false) {
    throw new Error(
      `${context}: ${getLazadaEnvelopeMessage(resultRecord) ?? "Lazada returned an unsuccessful result envelope."}`
    );
  }

  return (resultRecord.data ?? resultRecord) as T;
}

async function persistLazadaTokenSet(
  storeId: string,
  token: {
    accessToken: string;
    refreshToken: string | null;
    tokenExpiry: string | null;
  }
) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("stores")
    .update({
      access_token: token.accessToken,
      refresh_token: token.refreshToken,
      token_expiry: token.tokenExpiry
    })
    .eq("id", storeId);

  if (error) {
    throw new Error(`Unable to persist Lazada token: ${error.message}`);
  }
}

export async function refreshLazadaAccessToken(store: StoreRow) {
  if (!store.refresh_token) {
    throw new Error("Lazada store is missing a refresh token.");
  }

  const json = (await callLazadaApi(
    `${env.lazada.authBase().replace(/\/$/, "")}/rest`,
    "/auth/token/refresh",
    {
      refresh_token: store.refresh_token
    },
    {
      method: "GET"
    }
  )) as LazadaTokenEnvelope;

  if (!json.access_token) {
    throw new Error(json.message ?? "lazada_token_refresh_failed");
  }

  const expiresIn = Number(json.expires_in ?? 0);
  const refreshed = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? store.refresh_token,
    tokenExpiry:
      expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
  };

  await persistLazadaTokenSet(store.id, refreshed);
  return refreshed;
}

export async function ensureLazadaAccessToken(store: StoreRow) {
  if (!store.access_token) {
    throw new Error("Lazada store is missing an access token.");
  }

  if (!store.token_expiry) {
    return {
      accessToken: store.access_token,
      refreshToken: store.refresh_token,
      tokenExpiry: store.token_expiry
    };
  }

  const expiresAt = new Date(store.token_expiry);
  const refreshAt = new Date(expiresAt.getTime() - 10 * 60 * 1000);

  if (Number.isNaN(expiresAt.getTime()) || refreshAt > new Date()) {
    return {
      accessToken: store.access_token,
      refreshToken: store.refresh_token,
      tokenExpiry: store.token_expiry
    };
  }

  return refreshLazadaAccessToken(store);
}

function resolveLazadaSellerIdentity(
  token: LazadaTokenEnvelope,
  seller: LazadaSellerEnvelope | null
) {
  const sellerData = seller?.data ?? {};
  const countryInfo = token.country_user_info?.[0] ?? {};

  const shopId =
    asString(sellerData.seller_id) ??
    asString(sellerData.sellerId) ??
    asString(countryInfo.seller_id) ??
    asString(countryInfo.sellerId) ??
    asString(token.seller_id) ??
    asString(token.account_id);

  if (!shopId) {
    throw new Error("Unable to determine Lazada seller ID from the authorization response.");
  }

  const name =
    asString(sellerData.name) ??
    asString(sellerData.seller_name) ??
    asString(countryInfo.seller_name) ??
    asString(token.seller_name) ??
    asString(token.account) ??
    `Lazada ${shopId}`;

  return {
    shopId,
    name
  };
}

export async function connectLazadaStore(code: string): Promise<LazadaConnectedStore> {
  const token = await exchangeLazadaCode(code);
  const seller = await getLazadaSeller(token.access_token!);
  const identity = resolveLazadaSellerIdentity(token, seller);
  const expiresIn = Number(token.expires_in ?? 0);

  return {
    shopId: identity.shopId,
    name: identity.name,
    accessToken: token.access_token!,
    refreshToken: token.refresh_token ?? null,
    tokenExpiry:
      expiresIn > 0 ? new Date(Date.now() + expiresIn * 1000).toISOString() : null
  };
}
