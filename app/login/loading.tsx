import { PageSkeleton } from "@/components/page-skeleton";

export default function LoginLoading() {
  return (
    <PageSkeleton
      description="Preparing the sign-in screen and the shared password form."
      eyebrow="Login"
      title="Loading warehouse access"
    />
  );
}
