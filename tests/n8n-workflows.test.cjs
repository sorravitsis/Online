const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function readWorkflow(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", relativePath), "utf8")
  );
}

function getNode(workflow, name) {
  const node = workflow.nodes.find((candidate) => candidate.name === name);
  assert.ok(node, `Missing n8n node: ${name}`);
  return node;
}

function getAssignmentValue(workflow, assignmentName) {
  const assignments =
    getNode(workflow, "Workflow Config").parameters.assignments.assignments;
  const assignment = assignments.find((item) => item.name === assignmentName);
  assert.ok(assignment, `Missing workflow assignment: ${assignmentName}`);
  return assignment.value;
}

function getFirstMainTarget(workflow, sourceName) {
  return workflow.connections[sourceName]?.main?.[0]?.[0]?.node ?? null;
}

async function run() {
  const lazada = readWorkflow("docs/n8n/lazada_orders_sync.workflow.json");
  const shopee = readWorkflow("docs/n8n/shopee_orders_sync_v3.workflow.json");

  assert.equal(
    getFirstMainTarget(lazada, "Update Lazada Tokens In Supabase"),
    "Build Lazada Orders URL"
  );
  assert.equal(
    getFirstMainTarget(lazada, "Normalize Lazada Token Set"),
    "Update Lazada Tokens In Supabase"
  );
  assert.equal(Number(getAssignmentValue(lazada, "maxPages")), 50);
  assert.equal(Number(getAssignmentValue(lazada, "lookbackMinutes")), 30);

  const lazadaBuildOrdersCode = getNode(
    lazada,
    "Build Lazada Orders URL"
  ).parameters.jsCode;
  assert.match(lazadaBuildOrdersCode, /sort_by:\s*'updated_at'/);
  assert.match(lazadaBuildOrdersCode, /lookbackMinutes/);

  assert.equal(
    getFirstMainTarget(shopee, "Workflow Config"),
    "Get Shopee Store From Supabase"
  );
  assert.equal(
    getFirstMainTarget(shopee, "Map Detailed Orders For Supabase"),
    "Chunk Shopee Orders For Supabase"
  );
  assert.equal(
    getFirstMainTarget(shopee, "Chunk Shopee Orders For Supabase"),
    "Upsert Orders To Supabase"
  );
  assert.equal(Number(getAssignmentValue(shopee, "supabaseBatchSize")), 50);

  const normalizeShopeeStoreCode = getNode(
    shopee,
    "Normalize Shopee Store"
  ).parameters.jsCode;
  assert.match(normalizeShopeeStoreCode, /rows\.length\s*!==\s*1/);

  const buildShopeeOrderListCode = getNode(
    shopee,
    "Build Shopee Order List URL"
  ).parameters.jsCode;
  assert.match(buildShopeeOrderListCode, /cursor/);
}

module.exports = { run };
