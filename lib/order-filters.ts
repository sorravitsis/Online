export type OrderFilters = {
  status: string;
  storeId?: string;
  date: string;
  page: number;
  limit: number;
};

type OrderFiltersInput = {
  status?: string;
  storeId?: string;
  date?: string;
  page?: number;
  limit?: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 1000;
const DEFAULT_STATUS = "pending";
const DEFAULT_TIME_ZONE = "Asia/Bangkok";

function toPositiveInteger(value: number | undefined, fallback: number) {
  if (!value || Number.isNaN(value) || value < 1) {
    return fallback;
  }

  return Math.floor(value);
}

export function getDefaultOrderDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIME_ZONE
  }).format(new Date());
}

export function normalizeOrderFilters(input: OrderFiltersInput = {}): OrderFilters {
  return {
    status: input.status?.trim() || DEFAULT_STATUS,
    storeId: input.storeId?.trim() || undefined,
    date: input.date?.trim() || getDefaultOrderDate(),
    page: toPositiveInteger(input.page, DEFAULT_PAGE),
    limit: toPositiveInteger(input.limit, DEFAULT_LIMIT)
  };
}

export function buildOrderSearchParams(filters: OrderFilters) {
  const params = new URLSearchParams();
  params.set("status", filters.status);
  params.set("date", filters.date);
  params.set("page", String(filters.page));
  params.set("limit", String(filters.limit));

  if (filters.storeId) {
    params.set("store_id", filters.storeId);
  }

  return params;
}
