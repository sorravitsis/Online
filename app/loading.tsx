import { PageSkeleton } from "@/components/page-skeleton";

export default function RootLoading() {
  return (
    <PageSkeleton
      description="Preparing the warehouse dashboard shell and loading the next route."
      eyebrow="System"
      title="Loading AWB platform"
    />
  );
}
