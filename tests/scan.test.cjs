const assert = require("node:assert/strict");

const { mapScanError, mapScanSuccess, summarizeItems } = require("../lib/scan.ts");

async function run() {
  assert.equal(
    mapScanError("already_printed"),
    "This order was already printed. Check the existing AWB before retrying."
  );
  assert.equal(
    mapScanError("locked"),
    "This order is locked by another session right now."
  );
  assert.equal(
    mapScanError("shopee_awb_not_ready"),
    "Shopee has not finished generating the AWB yet. Please wait a moment and retry."
  );
  assert.equal(
    mapScanError("unauthorized"),
    "Your session expired. Sign in again before printing."
  );
  assert.equal(
    mapScanSuccess("queued", "AWB123"),
    "Print queued. AWB: AWB123. The warehouse print agent will complete it shortly."
  );
  assert.equal(
    summarizeItems([{ name: "SKU 1" }, { name: "SKU 2" }, { name: "SKU 3" }]),
    "SKU 1 +2 more"
  );
  assert.equal(summarizeItems([]), "No item details");
}

module.exports = { run };
