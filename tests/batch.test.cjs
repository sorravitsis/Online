const assert = require("node:assert/strict");

const {
  getSelectionLimit,
  mapBatchError,
  summarizeBatchResults
} = require("../lib/batch.ts");

async function run() {
  const stores = [
    { id: "s1", batch_limit: 20 },
    { id: "s2", batch_limit: 8 }
  ];

  assert.equal(getSelectionLimit([], stores), 20);
  assert.equal(getSelectionLimit(["s1"], stores), 20);
  assert.equal(getSelectionLimit(["s1", "s2"], stores), 8);
  assert.equal(
    mapBatchError("batch_limit_exceeded"),
    "The selected orders exceed the allowed batch limit for one of the stores."
  );

  assert.deepEqual(
    summarizeBatchResults([
      { orderId: "1", status: "printed" },
      { orderId: "3", status: "queued" },
      { orderId: "2", status: "failed", error: "locked" }
    ]),
    {
      printed: 1,
      queued: 1,
      failed: 1
    }
  );
}

module.exports = { run };
