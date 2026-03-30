import { lazadaAdapter } from "@/lib/adapters/lazada";
import { shopeeAdapter } from "@/lib/adapters/shopee";
import type { OrderWithStore, PlatformAdapter } from "@/lib/types";

export function getAdapter(platform: string): PlatformAdapter {
  switch (platform) {
    case "shopee":
      return shopeeAdapter;
    case "lazada":
      return lazadaAdapter;
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export async function generateAWB(order: OrderWithStore) {
  const platform = order.store?.platform;

  if (!platform) {
    throw new Error("Order is missing store platform information.");
  }

  return getAdapter(platform).generateAWB(order);
}
