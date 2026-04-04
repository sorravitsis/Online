const assert = require("node:assert/strict");

const {
  parseShopeeRefreshTokenResponse
} = require("../lib/adapters/shopee.ts");

async function run() {
  {
    const result = parseShopeeRefreshTokenResponse({
      access_token: "root-token",
      refresh_token: "root-refresh"
    });

    assert.deepEqual(result, {
      accessToken: "root-token",
      refreshToken: "root-refresh"
    });
  }

  {
    const result = parseShopeeRefreshTokenResponse({
      response: {
        access_token: "nested-token",
        refresh_token: "nested-refresh"
      }
    });

    assert.deepEqual(result, {
      accessToken: "nested-token",
      refreshToken: "nested-refresh"
    });
  }

  {
    assert.throws(
      () =>
        parseShopeeRefreshTokenResponse({
          message: "missing access token"
        }),
      /missing access token/
    );
  }
}

module.exports = { run };
