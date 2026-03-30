const assert = require("node:assert/strict");

const {
  getSessionIdentifier,
  signSessionToken,
  verifySessionToken
} = require("../lib/auth.ts");

async function run() {
  process.env.AUTH_SECRET = "test-secret-123456789012345678901234";

  const token = await signSessionToken("warehouse-user");
  const payload = await verifySessionToken(token);

  assert.equal(payload.sub, "warehouse-user");
  assert.equal(typeof payload.jti, "string");
  assert.equal(typeof payload.exp, "number");
  assert.equal(getSessionIdentifier(payload), payload.jti);
  assert.equal(getSessionIdentifier(null, "fallback-session"), "fallback-session");
}

module.exports = { run };
