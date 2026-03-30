"use client";

import { useEffect } from "react";
import { RouteErrorView } from "@/components/route-error-view";

type LoginErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function LoginError({ error, reset }: LoginErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <RouteErrorView
      description="The login screen could not render cleanly. Retry the route or head back to the dashboard root."
      digest={error.digest}
      homeHref="/login"
      reset={reset}
      title="Login screen unavailable"
    />
  );
}
