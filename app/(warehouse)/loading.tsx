import { PageSkeleton } from "@/components/page-skeleton";

export default function WarehouseLoading() {
  return (
    <PageSkeleton
      description="Loading the live order queue, filters, and warehouse navigation."
      eyebrow="Warehouse"
      title="Loading order dashboard"
    />
  );
}
