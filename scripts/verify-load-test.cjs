const { createAdminClient } = require("../lib/supabase.ts");
const { buildLoadTestPrefix, findDuplicateAwbNumbers } = require("../lib/load-test.ts");

async function run() {
  const supabase = createAdminClient();
  const prefix = process.env.LOAD_TEST_PREFIX ?? buildLoadTestPrefix();

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, platform_order_id, awb_status")
    .like("platform_order_id", `${prefix}-%`);

  if (ordersError) {
    throw new Error(`Unable to query seeded orders: ${ordersError.message}`);
  }

  const orderIds = (orders ?? []).map((order) => order.id);
  if (orderIds.length === 0) {
    console.log(`No seeded orders found for prefix ${prefix}.`);
    return;
  }

  const { data: logs, error: logsError } = await supabase
    .from("print_log")
    .select("order_id, awb_number, status")
    .in("order_id", orderIds);

  if (logsError) {
    throw new Error(`Unable to query print log: ${logsError.message}`);
  }

  const { data: locks, error: locksError } = await supabase
    .from("order_locks")
    .select("order_id")
    .in("order_id", orderIds);

  if (locksError) {
    throw new Error(`Unable to query order locks: ${locksError.message}`);
  }

  const duplicates = findDuplicateAwbNumbers(logs ?? []);
  const summary = {
    prefix,
    orders: orderIds.length,
    printed: (orders ?? []).filter((order) => order.awb_status === "printed").length,
    failed: (orders ?? []).filter((order) => order.awb_status === "failed").length,
    pending: (orders ?? []).filter((order) => order.awb_status === "pending").length,
    locksRemaining: (locks ?? []).length,
    duplicateAwbNumbers: duplicates
  };

  console.log(JSON.stringify(summary, null, 2));

  if (summary.locksRemaining > 0 || summary.duplicateAwbNumbers.length > 0) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
