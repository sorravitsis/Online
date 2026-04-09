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
}

module.exports = { run };
