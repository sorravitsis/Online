import { PageSkeleton } from "@/components/page-skeleton";

export default function ScanLoading() {
  return (
    <PageSkeleton
      description="Preparing scanner capture, barcode lookup, and the single-print workflow."
      eyebrow="Scan Mode"
      title="Loading barcode print station"
    />
  );
}
