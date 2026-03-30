import { AdminDashboard } from "@/components/admin-dashboard";
import { ClientErrorBoundary } from "@/components/client-error-boundary";
import { listStores } from "@/lib/stores";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const stores = await listStores();

  return (
    <ClientErrorBoundary
      description="The admin dashboard hit a client-side rendering problem while loading store controls."
      homeHref="/admin"
      title="Admin dashboard needs recovery"
    >
      <AdminDashboard initialStores={stores} />
    </ClientErrorBoundary>
  );
}
