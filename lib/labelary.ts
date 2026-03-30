import { env } from "@/lib/env";

export async function convertPdfToZpl(pdf: Buffer) {
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
