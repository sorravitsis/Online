import { randomUUID } from "node:crypto";
import { addSeconds } from "@/lib/time";
import { generateAWB } from "@/lib/awb";
import { convertPdfToZpl } from "@/lib/labelary";
import { getOrderById } from "@/lib/orders";
import { printZPL } from "@/lib/print";
import { createAdminClient } from "@/lib/supabase";
import type { OrderWithStore, PrintMode, PrintResult } from "@/lib/types";

export type PrintWorkflowDependencies = {
  getOrderById: (orderId: string) => Promise<OrderWithStore | null>;
  acquireLock: (orderId: string, lockedBy: string) => Promise<boolean>;
  releaseLock: (orderId: string) => Promise<void>;
  setOrderStatus: (
    orderId: string,
    payload: {
      awb_status: "printing" | "printed" | "failed";
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
  generateAWB: typeof generateAWB;
  convertPdfToZpl: typeof convertPdfToZpl;
  printZPL: typeof printZPL;
};

async function acquireLock(orderId: string, lockedBy: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("order_locks")
    .upsert(
      {
        order_id: orderId,
        locked_by: lockedBy,
        expires_at: addSeconds(new Date(), 120).toISOString()
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
    awb_status: "printing" | "printed" | "failed";
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
  acquireLock,
  releaseLock,
  setOrderStatus,
  insertPrintLog,
  generateAWB,
  convertPdfToZpl,
  printZPL
};

export async function processSingleOrderPrint(
  orderId: string,
  printedBy: string,
  dependencies: PrintWorkflowDependencies = defaultDependencies
): Promise<PrintResult> {
  const order = await dependencies.getOrderById(orderId);

  if (!order) {
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
    const zpl = await dependencies.convertPdfToZpl(awb.pdf);
    await dependencies.printZPL(zpl);
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

    return {
      orderId: order.id,
      status: "printed",
      awbNumber: awb.awbNumber
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "print_failed";
    await dependencies.setOrderStatus(order.id, {
      awb_status: "failed"
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
      error: message
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

  for (const orderId of orderIds) {
    const order = await dependencies.getOrderById(orderId);

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
      const zpl = await dependencies.convertPdfToZpl(awb.pdf);
      await dependencies.printZPL(zpl);
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
      await dependencies.setOrderStatus(order.id, {
        awb_status: "failed"
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
        error: message
      });
    } finally {
      await dependencies.releaseLock(order.id);
    }
  }

  return {
    batchId,
    results
  };
}
