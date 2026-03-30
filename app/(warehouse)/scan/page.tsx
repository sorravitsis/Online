import { ClientErrorBoundary } from "@/components/client-error-boundary";
import { ScanDashboard } from "@/components/scan-dashboard";

export default function ScanPage() {
  return (
    <ClientErrorBoundary
      description="The scan dashboard hit a client-side problem while handling the barcode workflow."
      homeHref="/scan"
      title="Scan dashboard needs recovery"
    >
      <ScanDashboard />
    </ClientErrorBoundary>
  );
}
