const assert = require("node:assert/strict");

process.env.AUTH_SECRET = process.env.AUTH_SECRET || "test-auth-secret";
process.env.LAZADA_APP_KEY = process.env.LAZADA_APP_KEY || "123456";
process.env.LAZADA_APP_SECRET = process.env.LAZADA_APP_SECRET || "test-lazada-secret";
process.env.LAZADA_API_BASE =
  process.env.LAZADA_API_BASE || "https://api.lazada.co.th/rest";
process.env.LAZADA_AUTH_BASE =
  process.env.LAZADA_AUTH_BASE || "https://auth.lazada.com";
process.env.LAZADA_REDIRECT_URI =
  process.env.LAZADA_REDIRECT_URI ||
  "https://example.com/api/admin/lazada/callback";

const {
  buildLazadaAuthorizeUrl,
  signLazadaConnectState,
  signLazadaRequest,
  verifyLazadaConnectState
} = require("../lib/lazada.ts");

async function run() {
  {
    const state = await signLazadaConnectState("/admin");
    const payload = await verifyLazadaConnectState(state);
    assert.equal(payload.provider, "lazada");
    assert.equal(payload.returnTo, "/admin");
  }

  {
    const url = new URL(buildLazadaAuthorizeUrl("signed-state"));
    assert.equal(url.origin, "https://auth.lazada.com");
    assert.equal(url.pathname, "/oauth/authorize");
    assert.equal(url.searchParams.get("client_id"), "123456");
    assert.equal(
      url.searchParams.get("redirect_uri"),
      "https://example.com/api/admin/lazada/callback"
    );
    assert.equal(url.searchParams.get("state"), "signed-state");
  }

  {
    const signature = signLazadaRequest(
      "/seller/get",
      {
        timestamp: "1517820392000",
        sign_method: "sha256",
        app_key: "123456",
        access_token: "test"
      },
      "helloworld"
    );

    assert.equal(typeof signature, "string");
    assert.equal(signature, signature.toUpperCase());
    assert.equal(signature.length, 64);
  }
}

module.exports = { run };
