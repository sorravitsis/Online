import { createAdminClient } from "@/lib/supabase";
import type { OrderFilters } from "@/lib/order-filters";
import type { OrderWithStore } from "@/lib/types";

const PAGE_SIZE = 50;

type ListOrdersFilters = Partial<OrderFilters> & {
  barcode?: string;
};

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
    query = query.eq("barcode_value", filters.barcode);
  }

  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00.000Z`);
    const end = new Date(`${filters.date}T23:59:59.999Z`);
    query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
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
