export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type Platform = "shopee" | "lazada";
export type OrderStatus = "pending" | "printing" | "printed" | "failed";
export type PrintMode = "1to1" | "batch";
export type PrintResultStatus = "printed" | "queued" | "failed";
export type PrintableDocumentType = "pdf" | "zpl";

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
  platform_status: string;
  awb_number: string | null;
  printed_at: string | null;
  created_at: string;
};

export type OrderWithStore = OrderRow & {
  store: StoreRow | null;
};

export type PrintResult = {
  orderId: string;
  status: PrintResultStatus;
  awbNumber?: string;
  error?: string;
};

export type AdapterResult = {
  pdf: Buffer;
  awbNumber: string;
};

export type PrintJobRow = {
  id: string;
  order_id: string;
  batch_id: string | null;
  awb_number: string | null;
  mode: PrintMode;
  batch_size: number | null;
  status: "queued" | "processing" | "printed" | "failed";
  document_type: PrintableDocumentType;
  document_payload_base64: string;
  error_msg: string | null;
  printed_by: string | null;
  printer_name: string | null;
  claimed_by: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
};

export interface PlatformAdapter {
  generateAWB(order: OrderWithStore): Promise<AdapterResult>;
}
