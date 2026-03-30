"use client";

import { useEffect } from "react";
import { RouteErrorView } from "@/components/route-error-view";

type BatchErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function BatchError({ error, reset }: BatchErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <RouteErrorView
      description="The batch queue could not finish rendering or subscribing to realtime updates."
      digest={error.digest}
      homeHref="/batch"
      reset={reset}
      title="Batch print route unavailable"
    />
  );
}
