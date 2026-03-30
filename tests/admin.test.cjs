const assert = require("node:assert/strict");

const { isValidBatchLimit, mapAdminError } = require("../lib/admin.ts");

async function run() {
  assert.equal(isValidBatchLimit(1), true);
  assert.equal(isValidBatchLimit(50), true);
  assert.equal(isValidBatchLimit(0), false);
  assert.equal(isValidBatchLimit(51), false);
  assert.equal(isValidBatchLimit(10.5), false);
  assert.equal(
    mapAdminError("invalid_batch_limit"),
    "Batch limit must be an integer between 1 and 50."
  );
  assert.equal(
    mapAdminError("store_not_found"),
    "The selected store could not be found anymore. Refresh and try again."
  );
  assert.equal(
    mapAdminError("password_confirmation_mismatch"),
    "New password confirmation does not match."
  );
}

module.exports = { run };
