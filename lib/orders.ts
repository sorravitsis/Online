import { ORDER_RETENTION_DAYS } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase";
import type { OrderFilters } from "@/lib/order-filters";
import type { Platform } from "@/lib/types";
import type { OrderWithStore } from "@/lib/types";

const PAGE_SIZE = 50;
const BANGKOK_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const TERMINAL_PLATFORM_STATUSES = [
  "shipped",
  "in_transit",
  "to_confirm_receive",
  "delivered",
  "completed",
  "cancelled",
  "canceled",
  "returned",
  "return_to_sender",
  "failed_delivery",
  "lost"
] as const;
const TERMINAL_ORDER_RETENTION_HOURS = 24;

type ListOrdersFilters = Partial<OrderFilters> & {
  barcode?: string;
};

async function resolveStoreIdsForPlatform(platform: Platform, storeId?: string) {
  const supabase = createAdminClient();
  let query = supabase.from("stores").select("id").eq("platform", platform);

  if (storeId) {
    query = query.eq("id", storeId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to resolve stores for platform: ${error.message}`);
  }

  return (data ?? []).map((store) => store.id);
}

function sanitizeOrderSearchTerm(value: string) {
  return value.replace(/[,%()"'\\]/g, " ").trim();
}

export function buildBarcodeLookupFilter(value: string) {
  const sanitized = value.replace(/[,.()"'\\]/g, "");
  return [
    `barcode_value.eq.${sanitized}`,
    `platform_order_id.eq.${sanitized}`,
    `awb_number.eq.${sanitized}`
  ].join(",");
}

function parseDateParts(date: string) {
  const [year, month, day] = date.split("-").map((value) => Number.parseInt(value, 10));

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new Error(`Invalid date filter: ${date}`);
  }

  return { year, month, day };
}

export function getBangkokDateRange(dateFrom: string, dateTo = dateFrom) {
  const from = parseDateParts(dateFrom);
  const to = parseDateParts(dateTo);

  const startUtcMs = Date.UTC(from.year, from.month - 1, from.day) - BANGKOK_UTC_OFFSET_MS;
  const endUtcMs = Date.UTC(to.year, to.month - 1, to.day + 1) - BANGKOK_UTC_OFFSET_MS - 1;

  return {
    start: new Date(startUtcMs).toISOString(),
    end: new Date(endUtcMs).toISOString()
  };
}

export function getOrderRetentionCutoff(now = new Date()) {
  return new Date(
    now.getTime() - ORDER_RETENTION_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
}

export function getTerminalOrderRetentionCutoff(now = new Date()) {
  return new Date(
    now.getTime() - TERMINAL_ORDER_RETENTION_HOURS * 60 * 60 * 1000
  ).toISOString();
}

export function normalizePlatformStatus(value: string | null | undefined) {
  if (!value) {
    return "unknown";
  }

  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "unknown";
}

export function isTerminalPlatformStatus(value: string | null | undefined) {
  const normalized = normalizePlatformStatus(value);

  if (!normalized) {
    return false;
  }

  return (TERMINAL_PLATFORM_STATUSES as readonly string[]).includes(normalized);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyWarehouseVisibilityFilter(query: any) {
  const hiddenStatuses = TERMINAL_PLATFORM_STATUSES.join(",");
  return query.not("platform_status", "in", `(${hiddenStatuses})`);
}

export async function listOrders(filters: ListOrdersFilters) {
  const supabase = createAdminClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.limit ?? PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("orders")
    .select("*, store:stores(*)", { count: "exact" })
    .order("created_at", { ascending: false });

  query = applyWarehouseVisibilityFilter(query);

  if (filters.status && filters.status !== "all") {
    query = query.eq("awb_status", filters.status);
  }

  if (filters.storeId) {
    query = query.eq("store_id", filters.storeId);
  }

  if (filters.platform) {
    const storeIds = await resolveStoreIdsForPlatform(filters.platform, filters.storeId);

    if (storeIds.length === 0) {
      return {
        orders: [],
        total: 0,
        page,
        pageSize
      };
    }

    query = query.in("store_id", storeIds);
  }

  if (filters.barcode) {
    query = query.or(buildBarcodeLookupFilter(filters.barcode));
  }

  if (filters.query) {
    const sanitized = sanitizeOrderSearchTerm(filters.query);
    if (sanitized) {
      query = query.or(
        [
          `platform_order_id.ilike.%${sanitized}%`,
          `barcode_value.ilike.%${sanitized}%`,
          `awb_number.ilike.%${sanitized}%`,
          `buyer_name.ilike.%${sanitized}%`
        ].join(",")
      );
    }
  }

  // Skip date filter when doing a barcode/order-id lookup — the order may be from any day
  if (filters.dateFrom && !filters.barcode) {
    const { start, end } = getBangkokDateRange(filters.dateFrom, filters.dateTo);
    query = query.gte("created_at", start).lte("created_at", end);
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    throw new Error(`Unable to load orders: ${error.message}`);
  }

  return {
    orders: (data ?? []) as OrderWithStore[],
    total: count ?? 0,
    page,
    pageSize
  };
}

export async function getOrderById(orderId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, store:stores(*)")
    .eq("id", orderId)
    .single();

  if (error) {
    return null;
  }

  return data as OrderWithStore;
}

export async function getOrdersByIds(orderIds: string[]) {
  if (orderIds.length === 0) {
    return [];
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select("*, store:stores(*)")
    .in("id", orderIds);

  if (error) {
    throw new Error(`Unable to load orders by ids: ${error.message}`);
  }

  return (data ?? []) as OrderWithStore[];
}
