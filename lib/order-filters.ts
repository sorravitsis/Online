import type { Platform } from "@/lib/types";

export type OrderFilters = {
  status: string;
  platform?: Platform;
  storeId?: string;
  query?: string;
  dateFrom: string;
  dateTo: string;
  page: number;
  limit: number;
};

type OrderFiltersInput = {
  status?: string;
  platform?: Platform;
  storeId?: string;
  query?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const DEFAULT_STATUS = "pending";
const DEFAULT_TIME_ZONE = "Asia/Bangkok";

function toPositiveInteger(value: number | undefined, fallback: number) {
  if (!value || Number.isNaN(value) || value < 1) {
    return fallback;
  }

  return Math.floor(value);
}

export function getDefaultOrderDate(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DEFAULT_TIME_ZONE
  }).format(now);
}

export function normalizeOrderFilters(input: OrderFiltersInput = {}): OrderFilters {
  const today = getDefaultOrderDate();
  const dateFrom = input.dateFrom?.trim() || today;
  const dateTo = input.dateTo?.trim() || dateFrom;

  return {
    status: input.status?.trim() || DEFAULT_STATUS,
    platform: input.platform?.trim() as Platform | undefined,
    storeId: input.storeId?.trim() || undefined,
    query: input.query?.trim() || undefined,
    dateFrom,
    dateTo,
    page: toPositiveInteger(input.page, DEFAULT_PAGE),
    limit: toPositiveInteger(input.limit, DEFAULT_LIMIT)
  };
}

export function buildOrderSearchParams(filters: OrderFilters) {
  const params = new URLSearchParams();
  params.set("status", filters.status);
  params.set("date_from", filters.dateFrom);
  params.set("date_to", filters.dateTo);
  params.set("page", String(filters.page));
  params.set("limit", String(filters.limit));

  if (filters.platform) {
    params.set("platform", filters.platform);
  }

  if (filters.storeId) {
    params.set("store_id", filters.storeId);
  }

  if (filters.query) {
    params.set("q", filters.query);
  }

  return params;
}
