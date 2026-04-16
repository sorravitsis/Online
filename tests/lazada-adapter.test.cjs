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
  extractLazadaDocumentData,
  lazadaAdapter,
  isLazadaSellerOwnFleet,
  normalizeLazadaOrderItems,
  selectLazadaOrderItemIds,
  selectLazadaPackageIds,
  selectLazadaTrackingNumbers
} = require("../lib/adapters/lazada.ts");

async function run() {
  {
    const items = normalizeLazadaOrderItems({
      result: {
        data: {
          order_items: [
            {
              order_item_id: 1,
              package_id: "PKG-1",
              tracking_code: "TRACK-1"
            }
          ]
        },
        success: true
      },
      code: "0"
    });

    assert.equal(items.length, 1);
    assert.equal(items[0].package_id, "PKG-1");
  }

  {
    const itemIds = selectLazadaOrderItemIds([
      { order_item_id: 11, status: "pending" },
      { order_item_id: 12, status: "packed" },
      { order_item_id: 13, status: "canceled" }
    ]);

    assert.deepEqual(itemIds, ["11", "12"]);
  }

  {
    const packageIds = selectLazadaPackageIds([
      { package_id: "PKG-1" },
      { packageId: "PKG-2" },
      { package_id: "PKG-1" }
    ]);

    assert.deepEqual(packageIds, ["PKG-1", "PKG-2"]);
  }

  {
    const trackingNumbers = selectLazadaTrackingNumbers([
      { tracking_code: "TRACK-1" },
      { trackingNumber: "TRACK-2" },
      { tracking_no: "TRACK-1" }
    ]);

    assert.deepEqual(trackingNumbers, ["TRACK-1", "TRACK-2"]);
  }

  {
    assert.equal(
      isLazadaSellerOwnFleet([{ delivery_option_sof: 1 }]),
      true
    );
    assert.equal(
      isLazadaSellerOwnFleet([{ delivery_option_sof: 0 }]),
      false
    );
  }

  {
    const pdfBase64 = Buffer.from("%PDF-1.4\n", "utf8").toString("base64");
    const result = extractLazadaDocumentData({
      result: {
        data: {
          file: pdfBase64
        },
        success: true
      },
      code: "0"
    });

    assert.equal(result.pdfUrl, null);
    assert.equal(result.inlineBuffer.toString("utf8"), "%PDF-1.4\n");
  }

  {
    const iframeHtml = Buffer.from(
      '<iframe src="/oss/proxy/waybill.pdf"></iframe>',
      "utf8"
    ).toString("base64");
    const result = extractLazadaDocumentData({
      result: {
        data: {
          file: iframeHtml,
          pdf_url: "https://sellercenter.lazada.co.th/oss/proxy/waybill.pdf"
        },
        success: true
      },
      code: "0"
    });

    assert.equal(
      result.pdfUrl,
      "https://sellercenter.lazada.co.th/oss/proxy/waybill.pdf"
    );
    assert.equal(result.inlineBuffer.toString("utf8"), '<iframe src="/oss/proxy/waybill.pdf"></iframe>');
  }

  {
    const originalFetch = global.fetch;
    const fetchCalls = [];

    global.fetch = async (input) => {
      const href = typeof input === "string" ? input : input.url;
      fetchCalls.push(href);

      if (href.includes("/order/items/get")) {
        return new Response(
          JSON.stringify({
            code: "0",
            result: {
              success: true,
              data: {
                order_items: [{ order_item_id: 1001, status: "pending" }]
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (href.includes("/order/fulfill/pack")) {
        return new Response(
          JSON.stringify({
            code: "0",
            result: {
              success: true,
              data: {
                pack_order_list: [
                  {
                    order_item_list: [
                      {
                        package_id: "PKG-123",
                        tracking_number: "TRACK-123",
                        item_err_code: "0",
                        msg: "success"
                      }
                    ]
                  }
                ]
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (href.includes("/order/package/document/get")) {
        return new Response(
          JSON.stringify({
            code: "0",
            result: {
              success: true,
              data: {
                file: Buffer.from("%PDF-1.4\n", "utf8").toString("base64")
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      if (href.includes("/order/package/rts")) {
        return new Response(
          JSON.stringify({
            code: "0",
            result: {
              success: true,
              data: {
                packages: [
                  {
                    package_id: "PKG-123",
                    item_err_code: "0",
                    msg: "success",
                    retry: false
                  }
                ]
              }
            }
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }

      throw new Error(`Unexpected fetch call: ${href}`);
    };

    try {
      const awb = await lazadaAdapter.generateAWB({
        id: "order-1",
        store_id: "store-1",
        platform_order_id: "2000000001",
        barcode_value: null,
        buyer_name: "Buyer",
        items_json: [],
        awb_status: "pending",
        platform_status: "pending",
        awb_number: null,
        printed_at: null,
        created_at: new Date().toISOString(),
        store: {
          id: "store-1",
          name: "Test Lazada",
          platform: "lazada",
          shop_id: "100005102",
          access_token: "access-token",
          refresh_token: "refresh-token",
          token_expiry: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          batch_limit: 20,
          is_active: true
        }
      });

      assert.equal(awb.awbNumber, "TRACK-123");
      assert.equal(awb.pdf.toString("utf8"), "%PDF-1.4\n");
      assert(
        fetchCalls.some((href) => href.includes("/order/package/rts")),
        "Expected generateAWB to call Lazada ReadyToShip after printing the AWB document."
      );
    } finally {
      global.fetch = originalFetch;
    }
  }
}

module.exports = { run };
