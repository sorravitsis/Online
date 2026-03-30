import { createAdminClient } from "@/lib/supabase";
import type { StoreRow } from "@/lib/types";

export async function listStores() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to load stores: ${error.message}`);
  }

  return (data ?? []) as StoreRow[];
}
