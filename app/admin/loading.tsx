import { PageSkeleton } from "@/components/page-skeleton";

export default function AdminLoading() {
  return (
    <PageSkeleton
      description="Loading store configuration, password controls, and the admin workspace."
      eyebrow="Admin"
      title="Loading store controls"
    />
  );
}
