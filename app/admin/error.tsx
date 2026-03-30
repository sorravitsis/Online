"use client";

import { useEffect } from "react";
import { RouteErrorView } from "@/components/route-error-view";

type AdminErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <RouteErrorView
      description="The admin workspace failed while loading store settings or password controls."
      digest={error.digest}
      homeHref="/admin"
      reset={reset}
      title="Admin controls hit an unexpected error"
    />
  );
}
