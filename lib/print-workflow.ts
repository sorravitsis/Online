import { randomUUID } from "node:crypto";
import { env, LOCK_TTL_SECONDS } from "@/lib/env";
import { detectPrintableDocumentType } from "@/lib/print-documents";
import { enqueuePrintJob } from "@/lib/print-jobs";
import { addSeconds } from "@/lib/time";
import { generateAWB } from "@/lib/awb";
import { convertPdfToZpl } from "@/lib/labelary";
import { getOrderById, getOrdersByIds } from "@/lib/orders";
import { printZPL } from "@/lib/print";
import { createAdminClient } from "@/lib/supabase";
import { logger } from "@/lib/logger";
import type { OrderWithStore, PrintMode, PrintResult } from "@/lib/types";

export type PrintWorkflowDependencies = {
  getOrderById: (orderId: string) => Promise<OrderWithStore | null>;
  getOrdersByIds: (orderIds: string[]) => Promise<OrderWithStore[]>;
  acquireLock: (orderId: string, lockedBy: string) => Promise<boolean>;
  releaseLock: (orderId: string) => Promise<void>;
  setOrderStatus: (
    orderId: string,
    payload: {
      awb_status: "pending" | "printing" | "printed" | "failed";
      awb_number?: string | null;
      printed_at?: string | null;
    }
  ) => Promise<void>;
  insertPrintLog: (input: {
    orderId: string;
    batchId: string | null;
    batchSize: number | null;
    printedBy: string;
    mode: PrintMode;
    status: "printed" | "failed";
    awbNumber?: string;
    error?: string;
  }) => Promise<void>;
  enqueuePrintJob: typeof enqueuePrintJob;
  getPrintTransport: () => "direct_tcp" | "local_queue";
  generateAWB: typeof generateAWB;
  convertPdfToZpl: typeof convertPdfToZpl;
  printZPL: typeof printZPL;
};

function isAwbNotReadyError(message: string) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("create_shipping_document: the tracking number is invalid") ||
    normalized.includes("get_shipping_document_result: the tracking number is invalid") ||
    normalized.includes("package can not print now") ||
    normalized.includes("document is not yet ready for printing") ||
    normalized.includes("please try again later") ||
    normalized.includes("shopee_awb_not_ready")
  );
}

function encodeRetryableAwbError(message: string) {
  return `shopee_awb_not_ready::${message}`;
}

async function acquireLock(orderId: string, lockedBy: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("order_locks")
    .upsert(
      {
        order_id: orderId,
        locked_by: lockedBy,
        expires_at: addSeconds(new Date(), LOCK_TTL_SECONDS).toISOString()
      },
      {
        onConflict: "order_id",
        ignoreDuplicates: true
      }
    )
    .select("order_id");

  if (error) {
    throw new Error(`Unable to acquire order lock: ${error.message}`);
  }

  return (data ?? []).length === 1;
}

async function releaseLock(orderId: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("order_locks").delete().eq("order_id", orderId);

  if (error) {
    throw new Error(`Unable to release order lock: ${error.message}`);
  }
}

async function setOrderStatus(
  orderId: string,
  payload: {
    awb_status: "pending" | "printing" | "printed" | "failed";
    awb_number?: string | null;
    printed_at?: string | null;
  }
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("orders").update(payload).eq("id", orderId);

  if (error) {
    throw new Error(`Unable to update order status: ${error.message}`);
  }
}

async function insertPrintLog(input: {
  orderId: string;
  batchId: string | null;
  batchSize: number | null;
  printedBy: string;
  mode: PrintMode;
  status: "printed" | "failed";
  awbNumber?: string;
  error?: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("print_log").insert({
    order_id: input.orderId,
    batch_id: input.batchId,
    awb_number: input.awbNumber ?? null,
    mode: input.mode,
    batch_size: input.batchSize,
    status: input.status,
    error_msg: input.error ?? null,
    printed_by: input.printedBy
  });

  if (error) {
    throw new Error(`Unable to insert print log: ${error.message}`);
  }
}

const defaultDependencies: PrintWorkflowDependencies = {
  getOrderById,
  getOrdersByIds,
  acquireLock,
  releaseLock,
  setOrderStatus,
  insertPrintLog,
  enqueuePrintJob,
  getPrintTransport: () => env.printer.transport(),
  generateAWB,
  convertPdfToZpl,
  printZPL
};

async function executeDirectPrint(
  awb: Awaited<ReturnType<typeof generateAWB>>,
  dependencies: PrintWorkflowDependencies
) {
  const documentType = detectPrintableDocumentType(awb.pdf);

  if (documentType === "zpl") {
    await dependencies.printZPL(awb.pdf.toString("utf8"));
    return;
  }

  const zpl = await dependencies.convertPdfToZpl(awb.pdf);
  await dependencies.printZPL(zpl);
}

async function queuePrintJob(
  orderId: string,
  batchId: string | null,
  batchSize: number | null,
  printedBy: string,
  mode: PrintMode,
  awb: Awaited<ReturnType<typeof generateAWB>>,
  dependencies: PrintWorkflowDependencies
) {
  const documentType = detectPrintableDocumentType(awb.pdf);

  await dependencies.enqueuePrintJob({
    orderId,
    batchId,
    batchSize,
    awbNumber: awb.awbNumber,
    mode,
    printedBy,
    documentType,
    documentBuffer: awb.pdf
  });
}

export async function processSingleOrderPrint(
  orderId: string,
  printedBy: string,
  dependencies: PrintWorkflowDependencies = defaultDependencies
): Promise<PrintResult> {
  logger.info("print:single:start", { orderId, printedBy });
  const order = await dependencies.getOrderById(orderId);

  if (!order) {
    logger.warn("print:single:not_found", { orderId });
    return {
      orderId,
      status: "failed",
      error: "order_not_found"
    };
  }

  if (order.awb_status === "printed") {
    return {
      orderId,
      status: "failed",
      error: "already_printed"
    };
  }

  if (order.awb_status !== "pending") {
    return {
      orderId,
      status: "failed",
      error: order.awb_status === "printing" ? "locked" : "order_not_pending"
    };
  }

  const locked = await dependencies.acquireLock(order.id, printedBy);
  if (!locked) {
    logger.warn("print:single:lock_failed", { orderId: order.id });
    return {
      orderId,
      status: "failed",
      error: "locked"
    };
  }

  try {
    await dependencies.setOrderStatus(order.id, {
      awb_status: "printing"
    });

    const awb = await dependencies.generateAWB(order);
    if (dependencies.getPrintTransport() === "local_queue") {
      await queuePrintJob(order.id, null, null, printedBy, "1to1", awb, dependencies);
      logger.info("print:single:queued", { orderId: order.id, awb: awb.awbNumber });

      return {
        orderId: order.id,
        status: "queued",
        awbNumber: awb.awbNumber
      };
    }

    await executeDirectPrint(awb, dependencies);
    await dependencies.setOrderStatus(order.id, {
      awb_status: "printed",
      awb_number: awb.awbNumber,
      printed_at: new Date().toISOString()
    });
    await dependencies.insertPrintLog({
      orderId: order.id,
      batchId: null,
      batchSize: null,
      printedBy,
      mode: "1to1",
      status: "printed",
      awbNumber: awb.awbNumber
    });

    logger.info("print:single:done", { orderId: order.id, awb: awb.awbNumber });
    return {
      orderId: order.id,
      status: "printed",
      awbNumber: awb.awbNumber
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "print_failed";
    const isRetryableNotReady = isAwbNotReadyError(message);
    logger.error("print:single:failed", { orderId: order.id, error: message, retryable: isRetryableNotReady });
    await dependencies.setOrderStatus(order.id, {
      awb_status: isRetryableNotReady ? "pending" : "failed"
    });
    await dependencies.insertPrintLog({
      orderId: order.id,
      batchId: null,
      batchSize: null,
      printedBy,
      mode: "1to1",
      status: "failed",
      error: message
    });

    return {
      orderId: order.id,
      status: "failed",
      error: isRetryableNotReady ? encodeRetryableAwbError(message) : message
    };
  } finally {
    await dependencies.releaseLock(order.id);
  }
}

export async function processBatchOrderPrint(
  orderIds: string[],
  printedBy: string,
  dependencies: PrintWorkflowDependencies = defaultDependencies
) {
  const batchId = randomUUID();
  const results: PrintResult[] = [];
  logger.info("print:batch:start", { batchId, count: orderIds.length, printedBy });

  const allOrders = await dependencies.getOrdersByIds(orderIds);
  const orderMap = new Map(allOrders.map((o) => [o.id, o]));

  for (const orderId of orderIds) {
    const order = orderMap.get(orderId) ?? null;

    if (!order) {
      results.push({
        orderId,
        status: "failed",
        error: "order_not_found"
      });
      continue;
    }

    if (order.awb_status !== "pending") {
      results.push({
        orderId: order.id,
        status: "failed",
        error: order.awb_status === "printed" ? "already_printed" : "order_not_pending"
      });
      continue;
    }

    const locked = await dependencies.acquireLock(order.id, batchId);
    if (!locked) {
      results.push({
        orderId: order.id,
        status: "failed",
        error: "locked"
      });
      continue;
    }

    try {
      await dependencies.setOrderStatus(order.id, {
        awb_status: "printing"
      });

      const awb = await dependencies.generateAWB(order);
      if (dependencies.getPrintTransport() === "local_queue") {
        await queuePrintJob(
          order.id,
          batchId,
          orderIds.length,
          printedBy,
          "batch",
          awb,
          dependencies
        );

        results.push({
          orderId: order.id,
          status: "queued",
          awbNumber: awb.awbNumber
        });
        continue;
      }

      await executeDirectPrint(awb, dependencies);
      await dependencies.setOrderStatus(order.id, {
        awb_status: "printed",
        awb_number: awb.awbNumber,
        printed_at: new Date().toISOString()
      });
      await dependencies.insertPrintLog({
        orderId: order.id,
        batchId,
        batchSize: orderIds.length,
        printedBy,
        mode: "batch",
        status: "printed",
        awbNumber: awb.awbNumber
      });

      results.push({
        orderId: order.id,
        status: "printed",
        awbNumber: awb.awbNumber
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "print_failed";
      const isRetryableNotReady = isAwbNotReadyError(message);
      logger.error("print:batch:item_failed", { batchId, orderId: order.id, error: message, retryable: isRetryableNotReady });
      await dependencies.setOrderStatus(order.id, {
        awb_status: isRetryableNotReady ? "pending" : "failed"
      });
      await dependencies.insertPrintLog({
        orderId: order.id,
        batchId,
        batchSize: orderIds.length,
        printedBy,
        mode: "batch",
        status: "failed",
        error: message
      });
      results.push({
        orderId: order.id,
        status: "failed",
        error: isRetryableNotReady ? encodeRetryableAwbError(message) : message
      });
    } finally {
      await dependencies.releaseLock(order.id);
    }
  }

  const printed = results.filter((r) => r.status === "printed").length;
  const failed = results.filter((r) => r.status === "failed").length;
  logger.info("print:batch:done", { batchId, printed, failed, total: orderIds.length });

  return {
    batchId,
    results
  };
}
