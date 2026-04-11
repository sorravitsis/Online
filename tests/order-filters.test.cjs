const assert = require("node:assert/strict");

const {
  getDefaultOrderDate,
  buildOrderSearchParams,
  normalizeOrderFilters
} = require("../lib/order-filters.ts");

async function run() {
  {
    const filters = normalizeOrderFilters();

    assert.equal(filters.status, "pending");
    assert.equal(filters.page, 1);
    assert.equal(filters.limit, 100);
    assert.match(filters.dateFrom, /^\d{4}-\d{2}-\d{2}$/);
    assert.equal(filters.dateTo, filters.dateFrom);
  }

  {
    assert.equal(
      getDefaultOrderDate(new Date("2026-04-10T16:30:00.000Z")),
      "2026-04-10"
    );
    assert.equal(
      getDefaultOrderDate(new Date("2026-04-10T17:30:00.000Z")),
      "2026-04-11"
    );
  }

  {
    const filters = normalizeOrderFilters({
      status: "printed",
      platform: "lazada",
      storeId: "store-1",
      query: "1096612397764146",
      dateFrom: "2026-03-30",
      dateTo: "2026-03-31",
      page: 3,
      limit: 25
    });
    const params = buildOrderSearchParams(filters);

    assert.equal(params.get("status"), "printed");
    assert.equal(params.get("platform"), "lazada");
    assert.equal(params.get("store_id"), "store-1");
    assert.equal(params.get("q"), "1096612397764146");
    assert.equal(params.get("date_from"), "2026-03-30");
    assert.equal(params.get("date_to"), "2026-03-31");
    assert.equal(params.get("page"), "3");
    assert.equal(params.get("limit"), "25");
  }
}

module.exports = { run };
