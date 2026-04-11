import { ORDER_RETENTION_DAYS } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase";
import type { OrderFilters } from "@/lib/order-filters";
import type { OrderWithStore } from "@/lib/types";

const PAGE_SIZE = 50;
const BANGKOK_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

type ListOrdersFilters = Partial<OrderFilters> & {
  barcode?: string;
};

function sanitizeOrderSearchTerm(value: string) {
  return value.replace(/[,%()"'\\]/g, " ").trim();
}

export function getBangkokDateRange(date: string) {
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

  const startUtcMs = Date.UTC(year, month - 1, day) - BANGKOK_UTC_OFFSET_MS;
  const endUtcMs = Date.UTC(year, month - 1, day + 1) - BANGKOK_UTC_OFFSET_MS - 1;

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

  if (filters.status && filters.status !== "all") {
    query = query.eq("awb_status", filters.status);
  }

  if (filters.storeId) {
    query = query.eq("store_id", filters.storeId);
  }

  if (filters.barcode) {
    const sanitized = filters.barcode.replace(/[,.()"'\\]/g, "");
    query = query.or(
      `barcode_value.eq.${sanitized},platform_order_id.eq.${sanitized}`
    );
  }

  if (filters.query) {
    const sanitized = sanitizeOrderSearchTerm(filters.query);
    if (sanitized) {
      query = query.or(
        [
          `platform_order_id.ilike.%${sanitized}%`,
          `barcode_value.ilike.%${sanitized}%`,
          `buyer_name.ilike.%${sanitized}%`,
          `awb_number.ilike.%${sanitized}%`
        ].join(",")
      );
    }
  }

  if (filters.date) {
    const { start, end } = getBangkokDateRange(filters.date);
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
