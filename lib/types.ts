export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type Platform = "shopee" | "lazada";
export type OrderStatus = "pending" | "printing" | "printed" | "failed";
export type PrintMode = "1to1" | "batch";

export type StoreRow = {
  id: string;
  name: string;
  platform: Platform;
  shop_id: string;
  access_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
  batch_limit: number;
  is_active: boolean;
  created_at?: string;
};

export type OrderRow = {
  id: string;
  store_id: string;
  platform_order_id: string;
  barcode_value: string | null;
  buyer_name: string | null;
  items_json: JsonValue;
  awb_status: OrderStatus;
  awb_number: string | null;
  printed_at: string | null;
  created_at: string;
};

export type OrderWithStore = OrderRow & {
  store: StoreRow | null;
};

export type PrintResult = {
  orderId: string;
  status: "printed" | "failed";
  awbNumber?: string;
  error?: string;
};

export type AdapterResult = {
  pdf: Buffer;
  awbNumber: string;
};

export interface PlatformAdapter {
  generateAWB(order: OrderWithStore): Promise<AdapterResult>;
}
