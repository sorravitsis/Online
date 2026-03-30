import { AdminDashboard } from "@/components/admin-dashboard";
import { listStores } from "@/lib/stores";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const stores = await listStores();

  return <AdminDashboard initialStores={stores} />;
}
