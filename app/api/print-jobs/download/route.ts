import { getCurrentSession } from "@/lib/auth";
import { failure } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const session = await getCurrentSession();
  if (!session) {
    return failure("unauthorized", 401);
  }

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return failure("order_id_required", 400);
  }

  const supabase = createAdminClient();
  const { data: job, error } = await supabase
    .from("print_jobs")
    .select("document_type, document_payload_base64, awb_number")
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !job) {
    return failure("print_job_not_found", 404);
  }

  const buffer = Buffer.from(job.document_payload_base64, "base64");
  const contentType = job.document_type === "zpl" ? "text/plain" : "application/pdf";
  const extension = job.document_type === "zpl" ? "zpl" : "pdf";
  const filename = `awb-${job.awb_number ?? orderId}.${extension}`;

  return new Response(buffer, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(buffer.length),
    },
  });
}
