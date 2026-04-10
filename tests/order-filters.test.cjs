const assert = require("node:assert/strict");

const {
  buildOrderSearchParams,
  normalizeOrderFilters
} = require("../lib/order-filters.ts");

async function run() {
  {
    const filters = normalizeOrderFilters();

    assert.equal(filters.status, "pending");
    assert.equal(filters.page, 1);
    assert.equal(filters.limit, 1000);
    assert.match(filters.date, /^\d{4}-\d{2}-\d{2}$/);
  }

  {
    const filters = normalizeOrderFilters({
      status: "printed",
      storeId: "store-1",
      date: "2026-03-30",
      page: 3,
      limit: 25
    });
    const params = buildOrderSearchParams(filters);

    assert.equal(params.get("status"), "printed");
    assert.equal(params.get("store_id"), "store-1");
    assert.equal(params.get("date"), "2026-03-30");
    assert.equal(params.get("page"), "3");
    assert.equal(params.get("limit"), "25");
  }
}

module.exports = { run };
