function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optionalEnv(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

export const env = {
  supabase: {
    url: () => requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: () => requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey: () => requireEnv("SUPABASE_SERVICE_ROLE_KEY")
  },
  auth: {
    secret: () => requireEnv("AUTH_SECRET"),
    cookieName: "awb_session"
  },
  cron: {
    secret: () => optionalEnv("CRON_SECRET")
  },
  printer: {
    host: () => requireEnv("PRINTER_HOST"),
    port: () => Number.parseInt(optionalEnv("PRINTER_PORT", "9100") ?? "9100", 10),
    transport: () => optionalEnv("PRINT_TRANSPORT", "direct_tcp") as "direct_tcp" | "local_queue"
  },
  shopee: {
    appId: () => requireEnv("SHOPEE_APP_ID"),
    appKey: () => requireEnv("SHOPEE_APP_KEY"),
    apiBase: () => requireEnv("SHOPEE_API_BASE").replace(/\/$/, ""),
    initPath: () => optionalEnv("SHOPEE_LOGISTICS_INIT_PATH", "/api/v2/logistics/init")!,
    shippingDocumentParameterPath: () =>
      optionalEnv(
        "SHOPEE_SHIPPING_DOCUMENT_PARAMETER_PATH",
        "/api/v2/logistics/get_shipping_document_parameter"
      )!,
    createShippingDocumentPath: () =>
      optionalEnv(
        "SHOPEE_CREATE_SHIPPING_DOCUMENT_PATH",
        "/api/v2/logistics/create_shipping_document"
      )!,
    shippingDocumentResultPath: () =>
      optionalEnv(
        "SHOPEE_SHIPPING_DOCUMENT_RESULT_PATH",
        "/api/v2/logistics/get_shipping_document_result"
      )!,
    downloadShippingDocumentPath: () =>
      optionalEnv(
        "SHOPEE_DOWNLOAD_SHIPPING_DOCUMENT_PATH",
        "/api/v2/logistics/download_shipping_document"
      )!,
    trackingNumberPath: () =>
      optionalEnv("SHOPEE_TRACKING_NUMBER_PATH", "/api/v2/logistics/get_tracking_number")!,
    refreshTokenPath: () =>
      optionalEnv("SHOPEE_REFRESH_TOKEN_PATH", "/api/v2/auth/access_token/get")!
  },
  lazada: {
    appKey: () => requireEnv("LAZADA_APP_KEY"),
    appSecret: () => requireEnv("LAZADA_APP_SECRET"),
    apiBase: () => requireEnv("LAZADA_API_BASE").replace(/\/$/, ""),
    authBase: () =>
      optionalEnv("LAZADA_AUTH_BASE", "https://auth.lazada.com")!.replace(/\/$/, ""),
    redirectUri: () => requireEnv("LAZADA_REDIRECT_URI")
  },
  labelary: {
    apiUrl: () => requireEnv("LABELARY_API_URL")
  }
};
