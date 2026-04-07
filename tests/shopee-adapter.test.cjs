const assert = require("node:assert/strict");

const {
  parseShopeeRefreshTokenResponse,
  selectShopeePackageNumber,
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
}

module.exports = { run };
