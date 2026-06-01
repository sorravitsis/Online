const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");
const { printZPL } = require("../lib/print.ts");

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
const agentName = process.env.LOCAL_PRINT_AGENT_NAME || os.hostname();
const printerName = process.env.LOCAL_PRINTER_NAME || "";
const printerQueue =
  process.env.LOCAL_PRINTER_QUEUE_NAME || process.env.PRINT_QUEUE_NAME || printerName || "";
const intervalMs = Number.parseInt(process.env.PRINT_AGENT_INTERVAL_MS || "3000", 10);
const sumatraPath = process.env.SUMATRA_PDF_PATH || findSumatraPdf();
const pdfPrintCommand = process.env.PDF_PRINT_COMMAND || "";

function findSumatraPdf() {
  const candidates = [
    path.join(process.env.LOCALAPPDATA || "", "SumatraPDF", "SumatraPDF.exe"),
    "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
    "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe"
  ];

  return candidates.find((candidate) => candidate && fsSync.existsSync(candidate)) || "";
}

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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

async function printPdf(tempPath) {
  if (pdfPrintCommand) {
    const rendered = pdfPrintCommand
      .replaceAll("{file}", tempPath)
      .replaceAll("{printer}", printerName);

    await runProcess("powershell.exe", ["-Command", rendered], {
      windowsHide: true
    });
    return;
  }

  if (sumatraPath) {
    const args = printerName
      ? ["-print-to", printerName, "-silent", "-exit-on-print", tempPath]
      : ["-print-to-default", "-silent", "-exit-on-print", tempPath];

    await runProcess(sumatraPath, args, {
      windowsHide: true
    });
    return;
  }

  const escapedPath = tempPath.replace(/'/g, "''");
  const escapedPrinter = printerName.replace(/'/g, "''");
  const command = printerName
    ? `Start-Process -FilePath '${escapedPath}' -Verb PrintTo -ArgumentList '${escapedPrinter}'`
    : `Start-Process -FilePath '${escapedPath}' -Verb Print`;

  await runProcess("powershell.exe", ["-Command", command], {
    windowsHide: true
  });
}

function extractUpstreamMessage(buffer) {
  try {
    const envelope = JSON.parse(buffer.toString("utf8"));
    const parts = [envelope?.error, envelope?.message].filter(Boolean);
    const resultFail = envelope?.response?.result_list?.[0]?.fail_message;
    if (resultFail) parts.push(resultFail);
    return parts.join(" — ") || "unknown upstream error";
  } catch {
    return `non-JSON payload (first 80 bytes: ${JSON.stringify(buffer.subarray(0, 80).toString("utf8"))})`;
  }
}

async function printDocument(job) {
  const buffer = Buffer.from(job.document_payload_base64, "base64");
  const firstByte = buffer.length > 0 ? buffer[0] : 0;

  if (firstByte === 0x7b /* { */ || firstByte === 0x5b /* [ */) {
    throw new Error(`upstream returned JSON instead of a label: ${extractUpstreamMessage(buffer)}`);
  }

  if (job.document_type === "zpl") {
    const text = buffer.toString("utf8");
    if (!text.includes("^XA") && !text.includes("~JA")) {
      throw new Error(`job flagged as ZPL but payload is not ZPL (${buffer.length} bytes)`);
    }
    await printZPL(text);
    return;
  }

  const header = buffer.subarray(0, 5).toString("utf8");
  if (header !== "%PDF-") {
    throw new Error(`job flagged as PDF but payload does not start with %PDF- (got ${JSON.stringify(header)}, ${buffer.length} bytes)`);
  }

  const tempPath = path.join(os.tmpdir(), `${job.id}-${randomUUID()}.pdf`);
  await fs.writeFile(tempPath, buffer);

  try {
    await printPdf(tempPath);
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

async function claimNextJob() {
  const { data, error } = await supabase.rpc("claim_next_print_job", {
    p_agent_name: agentName,
    p_printer_name: printerName || null,
    p_printer_queue: printerQueue || null
  });

  if (error) {
    throw new Error(`Unable to claim print job: ${error.message}`);
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0];
}

async function finishJob(jobId, success, errorMessage = null) {
  const { error } = await supabase.rpc("finish_print_job", {
    p_job_id: jobId,
    p_success: success,
    p_error_msg: errorMessage
  });

  if (error) {
    throw new Error(`Unable to finish print job: ${error.message}`);
  }
}

async function runOnce() {
  const job = await claimNextJob();
  if (!job) {
    return false;
  }

  console.log(
    `[print-agent] claimed job ${job.id} (${job.document_type}) for order ${job.order_id}` +
      `${job.printer_queue ? ` from queue ${job.printer_queue}` : ""}`
  );

  try {
    await printDocument(job);
    await finishJob(job.id, true, null);
    console.log(`[print-agent] printed job ${job.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "print_failed";
    await finishJob(job.id, false, message);
    console.error(`[print-agent] failed job ${job.id}: ${message}`);
  }

  return true;
}

async function main() {
  console.log(
    `[print-agent] started as ${agentName}` +
      `${printerQueue ? ` for queue ${printerQueue}` : " for any queue"}` +
      `${printerName ? ` on ${printerName}` : ""}`
  );

  const controller = new AbortController();
  const { signal } = controller;

  function shutdown() {
    console.log("[print-agent] shutting down…");
    controller.abort();
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  while (!signal.aborted) {
    const didWork = await runOnce();
    if (!signal.aborted && !didWork) {
      await sleep(intervalMs);
    }
  }

  console.log("[print-agent] stopped.");
}

main().catch((error) => {
  console.error("[print-agent] fatal error");
  console.error(error);
  process.exit(1);
});
