const { randomUUID } = require("node:crypto");

const { createAdminClient } = require("../lib/supabase.ts");
const { buildLoadTestPrefix } = require("../lib/load-test.ts");

function getRequestedCount() {
  const raw = process.env.LOAD_TEST_COUNT ?? "600";
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 600;
}

async function ensureLoadTestStore(supabase) {
  if (process.env.LOAD_TEST_STORE_ID) {
    return process.env.LOAD_TEST_STORE_ID;
  }

  const { data: existing, error: selectError } = await supabase
    .from("stores")
    .select("id")
    .eq("shop_id", "load-test-shop")
    .maybeSingle();

  if (selectError) {
    throw new Error(`Unable to query load test store: ${selectError.message}`);
  }

  if (existing?.id) {
    return existing.id;
  }

  const { data: created, error: insertError } = await supabase
    .from("stores")
    .insert({
      name: "Load Test Store",
      platform: "shopee",
      shop_id: "load-test-shop",
      access_token: "load-test-token",
      refresh_token: "load-test-refresh",
      token_expiry: new Date(Date.now() + 86400000).toISOString(),
      batch_limit: 20,
      is_active: true
    })
    .select("id")
    .single();

  if (insertError || !created?.id) {
    throw new Error(
      `Unable to create load test store: ${insertError?.message ?? "unknown error"}`
    );
  }

  return created.id;
}

async function run() {
  const supabase = createAdminClient();
  const prefix = process.env.LOAD_TEST_PREFIX ?? buildLoadTestPrefix();
  const count = getRequestedCount();
  const storeId = await ensureLoadTestStore(supabase);

  const { error: deleteError } = await supabase
    .from("orders")
    .delete()
    .like("platform_order_id", `${prefix}-%`);

  if (deleteError) {
    throw new Error(`Unable to clear previous seeded orders: ${deleteError.message}`);
  }

  const rows = Array.from({ length: count }, (_, index) => {
    const serial = String(index + 1).padStart(4, "0");
    return {
      id: randomUUID(),
      store_id: storeId,
      platform_order_id: `${prefix}-${serial}`,
      barcode_value: `${prefix}-BC-${serial}`,
      buyer_name: `Load Test Buyer ${serial}`,
      items_json: [
        {
          name: `Load Test SKU ${serial}`,
          quantity: 1
        }
      ],
      awb_status: "pending"
    };
  });

  for (let start = 0; start < rows.length; start += 200) {
    const chunk = rows.slice(start, start + 200);
    const { error } = await supabase.from("orders").insert(chunk);

    if (error) {
      throw new Error(`Unable to seed orders: ${error.message}`);
    }
  }

  console.log(
    `Seeded ${count} pending orders for prefix ${prefix} in store ${storeId}.`
  );
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
