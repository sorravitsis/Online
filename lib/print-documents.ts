import type { PrintableDocumentType } from "@/lib/types";

export function isPdfBuffer(buffer: Buffer) {
  return buffer.subarray(0, 5).toString("utf8") === "%PDF-";
}

export function tryReadZpl(buffer: Buffer) {
  const text = buffer.toString("utf8").trim();

  if (!text) {
    return null;
  }

  if (text.startsWith("^XA") || text.startsWith("~JA") || text.includes("^XZ")) {
    return text;
  }

  return null;
}

export function detectPrintableDocumentType(buffer: Buffer): PrintableDocumentType {
  if (tryReadZpl(buffer)) {
    return "zpl";
  }

  if (isPdfBuffer(buffer)) {
    return "pdf";
  }

  const preview = buffer.subarray(0, 80).toString("utf8").replace(/\s+/g, " ").trim();
  throw new Error(
    `Label document is not a recognizable PDF or ZPL (${buffer.length} bytes). First bytes: ${preview || "<empty>"}`
  );
}
