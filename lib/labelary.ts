import { env } from "@/lib/env";
import { isPdfBuffer, tryReadZpl } from "@/lib/print-documents";

export async function convertPdfToZpl(pdf: Buffer) {
  const rawZpl = tryReadZpl(pdf);
  if (rawZpl) {
    return rawZpl;
  }

  if (isPdfBuffer(pdf)) {
    throw new Error(
      "Shopee returned a PDF label. Labelary renders ZPL into PDF/PNG but cannot convert PDF back into ZPL."
    );
  }

  const response = await fetch(env.labelary.apiUrl(), {
    method: "POST",
    headers: {
      Accept: "application/x-zpl",
      "Content-Type": "application/pdf"
    },
    body: new Uint8Array(pdf)
  });

  if (!response.ok) {
    throw new Error(`Labelary conversion failed with status ${response.status}.`);
  }

  return response.text();
}
