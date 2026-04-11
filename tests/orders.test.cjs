const assert = require("node:assert/strict");

const {
  getBangkokDateRange,
  getOrderRetentionCutoff,
  getTerminalOrderRetentionCutoff,
  isTerminalPlatformStatus,
  normalizePlatformStatus
} = require("../lib/orders.ts");

async function run() {
  {
    const range = getBangkokDateRange("2026-04-10");

    assert.equal(range.start, "2026-04-09T17:00:00.000Z");
    assert.equal(range.end, "2026-04-10T16:59:59.999Z");
  }

  {
    assert.throws(
      () => getBangkokDateRange("2026-13-40"),
      /Invalid date filter/
    );
  }

  {
    const cutoff = getOrderRetentionCutoff(new Date("2026-04-10T12:00:00.000Z"));

    assert.equal(cutoff, "2026-04-03T12:00:00.000Z");
  }

  {
    const cutoff = getTerminalOrderRetentionCutoff(
      new Date("2026-04-10T12:00:00.000Z")
    );

    assert.equal(cutoff, "2026-04-09T12:00:00.000Z");
  }

  {
    assert.equal(normalizePlatformStatus("TO_CONFIRM_RECEIVE"), "to_confirm_receive");
    assert.equal(isTerminalPlatformStatus("TO_CONFIRM_RECEIVE"), true);
    assert.equal(isTerminalPlatformStatus("ready_to_ship"), false);
    assert.equal(normalizePlatformStatus(null), "unknown");
    assert.equal(isTerminalPlatformStatus(null), false);
  }
}

module.exports = { run };
