import { ClientErrorBoundary } from "@/components/client-error-boundary";
import { ScanDashboard } from "@/components/scan-dashboard";
import { listStores } from "@/lib/stores";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const stores = await listStores();

  return (
    <ClientErrorBoundary
      description="The scan dashboard hit a client-side problem while handling the barcode workflow."
      homeHref="/scan"
      title="Scan dashboard needs recovery"
    >
      <ScanDashboard stores={stores} />
    </ClientErrorBoundary>
  );
}
