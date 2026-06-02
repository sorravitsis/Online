const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { createClient } = require("@supabase/supabase-js");

function loadEnvFile(filePath) {
  if (!fsSync.existsSync(filePath)) {
    return;
  }

  const content = fsSync.readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    const commentIndex = value.search(/\s#/);
    if (commentIndex !== -1) {
      value = value.slice(0, commentIndex).trim();
    }

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(process.cwd(), ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const agentName =
  process.env.SHOPEE_SELLER_CENTER_AGENT_NAME || `${os.hostname()}-seller-center-extension`;
const bridgeHost = process.env.SELLER_CENTER_EXTENSION_BRIDGE_HOST || "127.0.0.1";
const bridgePort = Number.parseInt(process.env.SELLER_CENTER_EXTENSION_BRIDGE_PORT || "5137", 10);
const configPath =
  process.env.SHOPEE_SELLER_CENTER_PROFILES_PATH ||
  path.join(process.cwd(), "scripts", "windows", "shopee-seller-center-profiles.json");
const fallbackSellerCenterUrl =
  process.env.SHOPEE_SELLER_CENTER_URL ||
  "https://seller.shopee.co.th/portal/sale/order?type=toship&source=to_process";
const printerName = process.env.LOCAL_PRINTER_NAME || "";
const sumatraPath = process.env.SUMATRA_PDF_PATH || findSumatraPdf();

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function findSumatraPdf() {
  const candidates = [
    path.join(process.env.LOCALAPPDATA || "", "SumatraPDF", "SumatraPDF.exe"),
    "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
    "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe"
  ];

  return candidates.find((candidate) => candidate && fsSync.existsSync(candidate)) || "";
}

function runProcess(command, processArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, processArgs, {
      stdio: "inherit",
      shell: false,
      ...options
    });

    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function printPdf(filePath) {
  const resolvedPath = path.resolve(filePath);
  if (!fsSync.existsSync(resolvedPath)) {
    throw new Error(`downloaded_file_not_found:${resolvedPath}`);
  }

  const header = await fs.readFile(resolvedPath, { encoding: null }).then((buffer) => buffer.subarray(0, 5));
  if (!header.toString("utf8").startsWith("%PDF-")) {
    throw new Error(`downloaded_file_is_not_pdf:${resolvedPath}`);
  }

  if (sumatraPath) {
    const printArgs = printerName
      ? ["-print-to", printerName, "-silent", "-exit-on-print", resolvedPath]
      : ["-print-to-default", "-silent", "-exit-on-print", resolvedPath];

    await runProcess(sumatraPath, printArgs, {
      windowsHide: true
    });
    return;
  }

  const escapedPath = resolvedPath.replace(/'/g, "''");
  const escapedPrinter = printerName.replace(/'/g, "''");
  const command = printerName
    ? `Start-Process -FilePath '${escapedPath}' -Verb PrintTo -ArgumentList '${escapedPrinter}'`
    : `Start-Process -FilePath '${escapedPath}' -Verb Print`;

  await runProcess("powershell.exe", ["-Command", command], {
    windowsHide: true
  });
}

async function readProfiles() {
  if (!fsSync.existsSync(configPath)) {
    throw new Error(
      `Seller Center profile config not found: ${configPath}. Run npm run seller-center:profiles first.`
    );
  }

  const parsed = JSON.parse(await fs.readFile(configPath, "utf8"));
  const profiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];

  return profiles
    .map((profile) => ({
      storeId: profile.storeId,
      storeName: profile.storeName || profile.profileName || profile.storeId,
      profileName: profile.profileName || profile.storeName || profile.storeId,
      shopId: profile.shopId || null,
      sellerCenterUrl: fallbackSellerCenterUrl || profile.sellerCenterUrl || parsed.sellerCenterUrl
    }))
    .filter((profile) => profile.storeId);
}

let profiles = [];

async function claimNextJob() {
  if (profiles.length === 0) {
    profiles = await readProfiles();
  }

  for (const profile of profiles) {
    const { data, error } = await supabase.rpc("claim_next_seller_center_job", {
      p_agent_name: agentName,
      p_store_id: profile.storeId,
      p_browser_profile: "chrome-extension-main-profile"
    });

    if (error) {
      throw new Error(`Unable to claim Seller Center job: ${error.message}`);
    }

    if (Array.isArray(data) && data.length > 0) {
      const job = data[0];
      return {
        id: job.id,
        orderId: job.order_id,
        storeId: job.store_id,
        storeName: profile.storeName,
        shopId: profile.shopId,
        platformOrderId: job.platform_order_id,
        sellerCenterUrl: profile.sellerCenterUrl,
        claimedBy: agentName
      };
    }
  }

  return null;
}

async function requeueBrowserUnavailable(jobId, errorMessage) {
  const { error } = await supabase
    .from("seller_center_jobs")
    .update({
      status: "queued",
      error_msg: `extension_browser_unavailable::${errorMessage}`,
      claimed_by: null,
      browser_profile: null,
      updated_at: new Date().toISOString(),
      last_claimed_at: null,
      processed_at: null
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Unable to requeue Seller Center job: ${error.message}`);
  }
}

async function finishJob(jobId, success, errorMessage = null, downloadedFilePath = null) {
  if (success && downloadedFilePath) {
    await printPdf(downloadedFilePath);
  }

  const { error } = await supabase.rpc("finish_seller_center_job", {
    p_job_id: jobId,
    p_success: success,
    p_error_msg: errorMessage
  });

  if (error) {
    throw new Error(`Unable to finish Seller Center job: ${error.message}`);
  }
}

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleRequest(request, response) {
  if (request.method === "OPTIONS") {
    sendJson(response, 200, { success: true });
    return;
  }

  const url = new URL(request.url, `http://${bridgeHost}:${bridgePort}`);

  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, {
      success: true,
      data: {
        agentName,
        profiles: profiles.length || (await readProfiles()).length
      }
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/job/next") {
    const job = await claimNextJob();
    sendJson(response, 200, {
      success: true,
      data: job
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/job/requeue-browser-unavailable") {
    const body = await readJsonBody(request);
    if (!body.jobId) {
      sendJson(response, 400, { success: false, error: "job_id_required" });
      return;
    }

    await requeueBrowserUnavailable(body.jobId, body.error || "extension_browser_unavailable");
    sendJson(response, 200, { success: true });
    return;
  }

  if (request.method === "POST" && url.pathname === "/job/finish") {
    const body = await readJsonBody(request);
    if (!body.jobId) {
      sendJson(response, 400, { success: false, error: "job_id_required" });
      return;
    }

    await finishJob(
      body.jobId,
      body.success === true,
      typeof body.error === "string" ? body.error : null,
      typeof body.downloadedFilePath === "string" ? body.downloadedFilePath : null
    );
    sendJson(response, 200, { success: true });
    return;
  }

  sendJson(response, 404, { success: false, error: "not_found" });
}

async function main() {
  profiles = await readProfiles();

  const server = http.createServer((request, response) => {
    handleRequest(request, response).catch((error) => {
      const message = error instanceof Error ? error.message : "extension_bridge_failed";
      console.error(`[seller-center-extension-bridge] ${message}`);
      sendJson(response, 500, { success: false, error: message });
    });
  });

  server.listen(bridgePort, bridgeHost, () => {
    console.log(
      `[seller-center-extension-bridge] listening on http://${bridgeHost}:${bridgePort} as ${agentName}`
    );
    console.log(
      `[seller-center-extension-bridge] profiles=${profiles.length} printer=${printerName || "default"}`
    );
  });
}

main().catch((error) => {
  console.error("[seller-center-extension-bridge] fatal error");
  console.error(error);
  process.exit(1);
});
