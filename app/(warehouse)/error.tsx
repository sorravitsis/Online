"use client";

import { useEffect } from "react";
import { RouteErrorView } from "@/components/route-error-view";

type WarehouseErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function WarehouseError({ error, reset }: WarehouseErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <RouteErrorView
      description="The warehouse route failed while loading queue data or printing tools."
      digest={error.digest}
      homeHref="/"
      reset={reset}
      title="Warehouse route unavailable"
    />
  );
}
