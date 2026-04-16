import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase";
import { callLazadaApi, ensureLazadaAccessToken, unwrapLazadaResult } from "@/lib/lazada";
import { normalizePlatformStatus } from "@/lib/orders";
import { toRecord, asString, asArray } from "@/lib/adapters/utils";
import type { StoreRow } from "@/lib/types";

type LazadaOrder = Record<string, unknown>;

type LazadaOrdersPage = {
  orders: LazadaOrder[];
  count: number;
  countTotal: number;
};

type SyncResult = {
  storeId: string;
  storeName: string;
  synced: number;
  errors: string[];
};

const SYNC_LOOKBACK_HOURS = 48;
const PAGE_SIZE = 50;
const MAX_PAGES = 10;

function parseLazadaOrdersResponse(envelope: Record<string, unknown>): LazadaOrdersPage {
  const data = unwrapLazadaResult<Record<string, unknown>>(envelope, "get_orders");
  const orders = asArray(data.orders ?? data.order_list ?? data.list).map((o) => toRecord(o));
  const count = Number(data.count ?? orders.length);
  const countTotal = Number(data.countTotal ?? data.total ?? count);

  return { orders, count, countTotal };
}

function extractOrderFields(order: LazadaOrder, storeId: string) {
  const platformOrderId =
    asString(order.order_id) ??
    asString(order.orderId) ??
    (typeof order.order_id === "number" ? String(order.order_id) : undefined);

  if (!platformOrderId) {
    return null;
  }

  const buyerName =
    asString(order.customer_first_name) ??
    asString(order.buyer_name) ??
    asString(order.address_shipping?.toString());

  const statuses = asString(order.statuses) ?? asString(order.status) ?? "unknown";
  const platformStatus = normalizePlatformStatus(statuses);

  const items = asArray(order.order_items ?? order.items ?? order.item_list);
  const itemsSummary = items.map((item) => {
    const rec = toRecord(item);
    return {
      name: asString(rec.name) ?? asString(rec.item_name) ?? "item",
      sku: asString(rec.sku) ?? asString(rec.seller_sku),
      quantity: Number(rec.quantity ?? rec.qty ?? 1),
    };
  });

  const trackingNumbers = items
    .map((item) => {
      const rec = toRecord(item);
      return asString(rec.tracking_code) ?? asString(rec.tracking_number);
    })
    .filter((v): v is string => Boolean(v));

  const createdAt = asString(order.created_at) ?? asString(order.order_created_at);

  return {
    store_id: storeId,
    platform_order_id: platformOrderId,
    buyer_name: buyerName ?? null,
    items_json: itemsSummary.length > 0 ? itemsSummary : [],
    platform_status: platformStatus,
    awb_number: trackingNumbers[0] ?? null,
    created_at: createdAt ?? new Date().toISOString(),
  };
}

async function fetchLazadaOrders(store: StoreRow, accessToken: string) {
  const allOrders: LazadaOrder[] = [];
  const createdAfter = new Date(Date.now() - SYNC_LOOKBACK_HOURS * 60 * 60 * 1000).toISOString();

  for (let page = 0; page < MAX_PAGES; page++) {
    const envelope = await callLazadaApi(
      env.lazada.apiBase(),
      "/orders/get",
      {
        created_after: createdAfter,
        sort_by: "updated_at",
        sort_direction: "DESC",
        offset: String(page * PAGE_SIZE),
        limit: String(PAGE_SIZE),
      },
      {
        accessToken,
        method: "GET",
      }
    );

    const parsed = parseLazadaOrdersResponse(envelope);
    allOrders.push(...parsed.orders);

    if (allOrders.length >= parsed.countTotal || parsed.orders.length < PAGE_SIZE) {
      break;
    }
  }

  return allOrders;
}

async function syncStoreOrders(store: StoreRow): Promise<SyncResult> {
  const result: SyncResult = {
    storeId: store.id,
    storeName: store.name,
    synced: 0,
    errors: [],
  };

  try {
    const token = await ensureLazadaAccessToken(store);
    const orders = await fetchLazadaOrders(store, token.accessToken);

    if (orders.length === 0) {
      return result;
    }

    const supabase = createAdminClient();

    for (const order of orders) {
      const fields = extractOrderFields(order, store.id);
      if (!fields) {
        continue;
      }

      // Try insert first (new orders get awb_status=pending)
      const { error: insertError } = await supabase
        .from("orders")
        .insert({
          ...fields,
          awb_status: "pending",
        });

      if (!insertError) {
        result.synced++;
        continue;
      }

      // Order already exists — update platform fields only (preserve awb_status)
      if (insertError.code === "23505") {
        const { error: updateError } = await supabase
          .from("orders")
          .update({
            buyer_name: fields.buyer_name,
            items_json: fields.items_json,
            platform_status: fields.platform_status,
          })
          .eq("store_id", store.id)
          .eq("platform_order_id", fields.platform_order_id);

        if (updateError) {
          result.errors.push(`${fields.platform_order_id}: ${updateError.message}`);
        } else {
          result.synced++;
        }
        continue;
      }

      result.errors.push(`${fields.platform_order_id}: ${insertError.message}`);
    }
  } catch (error) {
    result.errors.push(error instanceof Error ? error.message : "Unknown sync error");
  }

  return result;
}

export async function syncLazadaOrders(storeId?: string) {
  const supabase = createAdminClient();

  let query = supabase
    .from("stores")
    .select("*")
    .eq("platform", "lazada")
    .eq("is_active", true);

  if (storeId) {
    query = query.eq("id", storeId);
  }

  const { data: stores, error } = await query;

  if (error) {
    throw new Error(`Unable to fetch Lazada stores: ${error.message}`);
  }

  if (!stores || stores.length === 0) {
    return { results: [], totalSynced: 0 };
  }

  const results: SyncResult[] = [];

  for (const store of stores as StoreRow[]) {
    const storeResult = await syncStoreOrders(store);
    results.push(storeResult);
  }

  return {
    results,
    totalSynced: results.reduce((sum, r) => sum + r.synced, 0),
  };
}
