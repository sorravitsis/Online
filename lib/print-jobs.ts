import { createAdminClient } from "@/lib/supabase";
import type { PrintJobRow, PrintMode, PrintableDocumentType } from "@/lib/types";

export async function enqueuePrintJob(input: {
  orderId: string;
  batchId: string | null;
  batchSize: number | null;
  awbNumber: string;
  mode: PrintMode;
  printedBy: string;
  documentType: PrintableDocumentType;
  documentBuffer: Buffer;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("print_jobs")
    .insert({
      order_id: input.orderId,
      batch_id: input.batchId,
      awb_number: input.awbNumber,
      mode: input.mode,
      batch_size: input.batchSize,
      status: "queued",
      document_type: input.documentType,
      document_payload_base64: input.documentBuffer.toString("base64"),
      printed_by: input.printedBy
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Unable to enqueue print job: ${error.message}`);
  }

  return data as PrintJobRow;
}
