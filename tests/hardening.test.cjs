const assert = require("node:assert/strict");

const { isAuthorizedCronRequest } = require("../lib/cron.ts");
const { buildLoadTestPrefix, findDuplicateAwbNumbers } = require("../lib/load-test.ts");

async function run() {
  assert.equal(isAuthorizedCronRequest(null, undefined), true);
  assert.equal(
    isAuthorizedCronRequest("Bearer top-secret", "top-secret"),
    true
  );
  assert.equal(
    isAuthorizedCronRequest("Bearer wrong-secret", "top-secret"),
    false
  );

  assert.equal(
    buildLoadTestPrefix(new Date("2026-03-30T10:00:00.000Z")),
    "LT-2026-03-30"
  );

  assert.deepEqual(
    findDuplicateAwbNumbers([
      { awb_number: "AWB-1", status: "printed" },
      { awb_number: "AWB-2", status: "printed" },
      { awb_number: "AWB-1", status: "printed" },
      { awb_number: "AWB-1", status: "failed" },
      { awb_number: null, status: "printed" }
    ]),
    [{ awbNumber: "AWB-1", count: 2 }]
  );
}

module.exports = { run };
