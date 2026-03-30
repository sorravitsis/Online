"use client";

import { useEffect } from "react";
import { RouteErrorView } from "@/components/route-error-view";

type RootErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function RootError({ error, reset }: RootErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <RouteErrorView
      description="The app shell hit an unexpected problem while rendering. Retry the route or return to the warehouse dashboard."
      digest={error.digest}
      reset={reset}
      title="The platform could not finish loading"
    />
  );
}
