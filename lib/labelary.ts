import { env } from "@/lib/env";

function isPdfBuffer(buffer: Buffer) {
  return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
}

function tryReadZpl(buffer: Buffer) {
  const text = buffer.toString("utf8").trim();

  if (!text) {
    return null;
  }

  if (text.startsWith("^XA") || text.startsWith("~JA") || text.includes("^XZ")) {
    return text;
  }

  return null;
}

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
