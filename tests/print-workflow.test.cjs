const assert = require("node:assert/strict");

const { processSingleOrderPrint } = require("../lib/print-workflow.ts");

function makeOrder(overrides = {}) {
  return {
    id: "order-1",
    store_id: "store-1",
    platform_order_id: "SPX-001",
    barcode_value: "BC-001",
    buyer_name: "Buyer",
    items_json: [],
    awb_status: "pending",
    awb_number: null,
    printed_at: null,
    created_at: new Date().toISOString(),
    store: {
      id: "store-1",
      name: "Test Shopee Store",
      platform: "shopee",
      shop_id: "1001",
      access_token: "token",
      refresh_token: "refresh",
      token_expiry: new Date(Date.now() + 60000).toISOString(),
      batch_limit: 20,
      is_active: true,
      created_at: new Date().toISOString()
    },
    ...overrides
  };
}

function createStub(implementation) {
  const calls = [];
  const fn = async (...args) => {
    calls.push(args);
    return implementation(...args);
  };
  fn.calls = calls;
  return fn;
}

function makeDependencies() {
  return {
    getOrderById: createStub(async () => makeOrder()),
    acquireLock: createStub(async () => true),
    releaseLock: createStub(async () => undefined),
    setOrderStatus: createStub(async () => undefined),
    insertPrintLog: createStub(async () => undefined),
    enqueuePrintJob: createStub(async () => ({ id: "job-1" })),
    getPrintTransport: () => "direct_tcp",
    generateAWB: createStub(async () => ({
      pdf: Buffer.from("pdf"),
      awbNumber: "AWB123"
    })),
    convertPdfToZpl: createStub(async () => "^XA^XZ"),
    printZPL: createStub(async () => undefined)
  };
}

async function run() {
  {
    const dependencies = makeDependencies();
    const result = await processSingleOrderPrint("order-1", "session-1", dependencies);

    assert.equal(result.status, "printed");
    assert.equal(result.awbNumber, "AWB123");
    assert.deepEqual(dependencies.acquireLock.calls[0], ["order-1", "session-1"]);
    assert.deepEqual(dependencies.printZPL.calls[0], ["^XA^XZ"]);
    assert.equal(dependencies.insertPrintLog.calls[0][0].status, "printed");
    assert.equal(dependencies.insertPrintLog.calls[0][0].awbNumber, "AWB123");
    assert.deepEqual(dependencies.releaseLock.calls[0], ["order-1"]);
  }

  {
    const dependencies = makeDependencies();
    dependencies.getPrintTransport = () => "local_queue";
    const result = await processSingleOrderPrint("order-1", "session-1", dependencies);

    assert.equal(result.status, "queued");
    assert.equal(dependencies.enqueuePrintJob.calls.length, 1);
    assert.equal(dependencies.printZPL.calls.length, 0);
    assert.equal(
      dependencies.setOrderStatus.calls.some(
        ([, payload]) => payload && payload.awb_status === "printed"
      ),
      false
    );
    assert.deepEqual(dependencies.releaseLock.calls[0], ["order-1"]);
  }

  {
    const dependencies = makeDependencies();
    dependencies.getOrderById = createStub(async () =>
      makeOrder({
        awb_status: "printed",
        awb_number: "AWB321"
      })
    );

    const result = await processSingleOrderPrint("order-1", "session-1", dependencies);

    assert.deepEqual(result, {
      orderId: "order-1",
      status: "failed",
      error: "already_printed"
    });
    assert.equal(dependencies.acquireLock.calls.length, 0);
  }

  {
    const dependencies = makeDependencies();
    dependencies.printZPL = createStub(async () => {
      throw new Error("Printer offline");
    });

    const result = await processSingleOrderPrint("order-1", "session-1", dependencies);

    assert.equal(result.status, "failed");
    assert.equal(result.error, "Printer offline");
    assert.equal(
      dependencies.setOrderStatus.calls.some(
        ([, payload]) => payload && payload.awb_status === "failed"
      ),
      true
    );
    assert.equal(dependencies.insertPrintLog.calls[0][0].status, "failed");
    assert.equal(dependencies.insertPrintLog.calls[0][0].error, "Printer offline");
    assert.deepEqual(dependencies.releaseLock.calls[0], ["order-1"]);
  }

  {
    const dependencies = makeDependencies();
    dependencies.generateAWB = createStub(async () => {
      throw new Error("create_shipping_document: The tracking number is invalid. Please check the tracking number.");
    });

    const result = await processSingleOrderPrint("order-1", "session-1", dependencies);

    assert.equal(result.status, "failed");
    assert.match(
      result.error,
      /^shopee_awb_not_ready::create_shipping_document: The tracking number is invalid/
    );
    assert.equal(
      dependencies.setOrderStatus.calls.some(
        ([, payload]) => payload && payload.awb_status === "pending"
      ),
      true
    );
    assert.equal(
      dependencies.setOrderStatus.calls.some(
        ([, payload]) => payload && payload.awb_status === "failed"
      ),
      false
    );
  }

  {
    const dependencies = makeDependencies();
    dependencies.generateAWB = createStub(async () => {
      throw new Error(
        "create_shipping_document: The package can not print now. Detail: The document is not yet ready for printing. Please try again later."
      );
    });

    const result = await processSingleOrderPrint("order-1", "session-1", dependencies);

    assert.equal(result.status, "failed");
    assert.match(
      result.error,
      /^shopee_awb_not_ready::create_shipping_document: The package can not print now/
    );
    assert.equal(
      dependencies.setOrderStatus.calls.some(
        ([, payload]) => payload && payload.awb_status === "pending"
      ),
      true
    );
    assert.equal(
      dependencies.setOrderStatus.calls.some(
        ([, payload]) => payload && payload.awb_status === "failed"
      ),
      false
    );
  }
}

module.exports = { run };
