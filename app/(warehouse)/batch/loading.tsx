import { PageSkeleton } from "@/components/page-skeleton";

export default function BatchLoading() {
  return (
    <PageSkeleton
      description="Loading the pending queue, batch selection controls, and progress summary."
      eyebrow="Batch Print"
      title="Loading batch print workspace"
    />
  );
}
