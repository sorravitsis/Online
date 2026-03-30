import type { PlatformAdapter } from "@/lib/types";

export const lazadaAdapter: PlatformAdapter = {
  async generateAWB() {
    throw new Error(
      "Lazada AWB generation is intentionally stubbed until the Shopee slice is proven."
    );
  }
};
