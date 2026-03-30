"use client";

import { useEffect } from "react";
import { RouteErrorView } from "@/components/route-error-view";

type ScanErrorProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function ScanError({ error, reset }: ScanErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <RouteErrorView
      description="The scan station crashed while rendering the barcode capture workflow."
      digest={error.digest}
      homeHref="/scan"
      reset={reset}
      title="Scan mode needs recovery"
    />
  );
}
