const assert = require("node:assert/strict");

const {
  shopeeAdapter,
  isExistingDocumentCreateError,
  isShipOrderSelectionError,
  parseShopeeRefreshTokenResponse,
  selectShopeePackageNumber,
  selectShopeeShippingDocumentTypes,
  selectShopeeShippingDocumentType
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

  {
    const result = selectShopeeShippingDocumentType({
      response: {
        result_list: [
          {
            order_sn: "260404ABC",
            suggest_shipping_document_type: "THERMAL_AIR_WAYBILL",
            selectable_shipping_document_type: ["NORMAL_AIR_WAYBILL"]
          }
        ]
      }
    });

    assert.equal(result, "THERMAL_AIR_WAYBILL");
  }

  {
    const result = selectShopeeShippingDocumentType({
      response: {
        result_list: [
          {
            order_sn: "260404ABC",
            selectable_shipping_document_type: ["NORMAL_AIR_WAYBILL", "THERMAL_AIR_WAYBILL"]
          }
        ]
      }
    });

    assert.equal(result, "NORMAL_AIR_WAYBILL");
  }

  {
    const result = selectShopeeShippingDocumentTypes({
      response: {
        result_list: [
          {
            order_sn: "260404ABC",
            suggest_shipping_document_type: "THERMAL_AIR_WAYBILL",
            selectable_shipping_document_type: ["NORMAL_AIR_WAYBILL", "THERMAL_AIR_WAYBILL"]
          }
        ]
      }
    });

    assert.deepEqual(result, ["THERMAL_AIR_WAYBILL", "NORMAL_AIR_WAYBILL"]);
  }

  {
    assert.throws(
      () =>
        selectShopeeShippingDocumentType({
          response: {
            result_list: [
              {
                order_sn: "260404ABC",
                fail_message: "document_type_not_available"
              }
            ]
          }
        }),
      /document_type_not_available/
    );
  }

  {
    const result = selectShopeePackageNumber({
      response: {
        result_list: [
          {
            order_sn: "260404ABC",
            package_number: "PKG-123"
          }
        ]
      }
    });

    assert.equal(result, "PKG-123");
  }

  {
    const result = selectShopeePackageNumber({
      response: {
        result_list: [
          {
            order_sn: "260404ABC",
            package_list: [
              {
                package_number: "PKG-456"
              }
            ]
          }
        ]
      }
    });

    assert.equal(result, "PKG-456");
  }

  {
    assert.equal(
      isShipOrderSelectionError(
        "logistics.ship_order_only_support_one_type: Please select just one way to ship order: pickup or dropoff or non-integrated."
      ),
      true
    );
    assert.equal(isShipOrderSelectionError("document_type_not_available"), false);
  }

  {
    assert.equal(
      isExistingDocumentCreateError("2604089QVTP03N: The tracking number is invalid. Please check the tracking number."),
      true
    );
    assert.equal(isExistingDocumentCreateError("document_type_not_available"), false);
  }

  {
    process.env.SHOPEE_APP_ID = "123456";
    process.env.SHOPEE_APP_KEY = "test-secret";
    process.env.SHOPEE_API_BASE = "https://partner.test-shopee.local";

    const orderId = "260413PSUU4SXU";
    const originalFetch = global.fetch;
    const fetchCalls = [];

    global.fetch = async (url) => {
      const href = typeof url === "string" ? url : url.toString();
      fetchCalls.push(href);

      if (href.includes("/api/v2/logistics/get_tracking_number")) {
        return new Response("not found", { status: 404 });
      }

      if (href.includes("/api/v2/logistics/init")) {
        return new Response(JSON.stringify({ response: {} }), {
          status: 200,
          headers: { "content-type": "application/json" }
        });
      }

      if (href.includes("/api/v2/logistics/get_shipping_document_parameter")) {
        return new Response(
          JSON.stringify({
            response: {
              result_list: [
                {
                  order_sn: orderId,
                  suggest_shipping_document_type: "NORMAL_AIR_WAYBILL",
                  package_number: "PKG-1"
                }
              ]
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (href.includes("/api/v2/logistics/create_shipping_document")) {
        return new Response(
          JSON.stringify({
            error: "common.batch_api_all_failed",
            message: "All failed, please check result_list for detail.",
            response: {
              result_list: [
                {
                  order_sn: orderId,
                  fail_message:
                    "The package can not print now. Detail: The document is not yet ready for printing. Please try again later."
                }
              ]
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (href.includes("/api/v2/logistics/get_shipping_document_result")) {
        return new Response(
          JSON.stringify({
            response: {
              result_list: [
                {
                  order_sn: orderId,
                  status: "READY",
                  tracking_number: "TRACK-READY-1"
                }
              ]
            }
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" }
          }
        );
      }

      if (href.includes("/api/v2/logistics/download_shipping_document")) {
        if (!fetchCalls.some((entry) => entry.includes("/api/v2/logistics/get_shipping_document_result"))) {
          return new Response("not ready", { status: 404 });
        }

        return new Response(Buffer.from("%PDF-1.4 test"), {
          status: 200,
          headers: { "content-type": "application/pdf" }
        });
      }

      throw new Error(`Unexpected fetch URL in Shopee adapter test: ${href}`);
    };

    try {
      const result = await shopeeAdapter.generateAWB({
        platform_order_id: orderId,
        store: {
          platform: "shopee",
          shop_id: "987654321",
          access_token: "access-token",
          refresh_token: "refresh-token",
          token_expiry: new Date(Date.now() + 60_000).toISOString()
        }
      });

      assert.equal(result.awbNumber, "TRACK-READY-1");
      assert.equal(Buffer.isBuffer(result.pdf), true);
      assert.equal(
        fetchCalls.some((href) => href.includes("/api/v2/logistics/get_shipping_document_result")),
        true
      );
    } finally {
      global.fetch = originalFetch;
    }
  }
}

module.exports = { run };
