const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { randomUUID } = require("node:crypto");
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

const args = process.argv.slice(2);
const loginMode = args.includes("--login");
const selectedProfile = getArgValue("--profile");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const agentName = process.env.SHOPEE_SELLER_CENTER_AGENT_NAME || `${os.hostname()}-seller-center`;
const intervalMs = Number.parseInt(process.env.SHOPEE_SELLER_CENTER_INTERVAL_MS || "5000", 10);
const browserUnavailableBackoffMs = Number.parseInt(
  process.env.SHOPEE_SELLER_CENTER_BROWSER_BACKOFF_MS || "30000",
  10
);
const configPath =
  process.env.SHOPEE_SELLER_CENTER_PROFILES_PATH ||
  path.join(process.cwd(), "scripts", "windows", "shopee-seller-center-profiles.json");
const cdpUrl =
  process.env.SELLER_CENTER_CDP_URL || process.env.SHOPEE_SELLER_CENTER_CDP_URL || "";
const cdpLaunchCommand = cdpUrl ? process.env.SELLER_CENTER_CDP_LAUNCH_COMMAND || defaultCdpLaunchCommand() : "";
const browserExecutable = cdpUrl
  ? ""
  : process.env.SELLER_CENTER_BROWSER_PATH || findBrowserExecutable();
const printerName = process.env.LOCAL_PRINTER_NAME || "";
const sumatraPath = process.env.SUMATRA_PDF_PATH || findSumatraPdf();
const closeAfterJob = process.env.SHOPEE_SELLER_CENTER_CLOSE_AFTER_JOB === "true";

if (!cdpUrl && !browserExecutable) {
  throw new Error("Microsoft Edge or Chrome was not found. Set SELLER_CENTER_BROWSER_PATH.");
}

if (!loginMode && (!supabaseUrl || !serviceRoleKey)) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = !loginMode
  ? createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null;

function getArgValue(name) {
  const exact = args.find((arg) => arg.startsWith(`${name}=`));
  if (exact) {
    return exact.slice(name.length + 1);
  }

  const index = args.indexOf(name);
  if (index !== -1) {
    return args[index + 1];
  }

  return undefined;
}

function findBrowserExecutable() {
  const candidates = [
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe"
  ];

  return candidates.find((candidate) => fsSync.existsSync(candidate)) || "";
}

function findSumatraPdf() {
  const candidates = [
    path.join(process.env.LOCALAPPDATA || "", "SumatraPDF", "SumatraPDF.exe"),
    "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
    "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe"
  ];

  return candidates.find((candidate) => candidate && fsSync.existsSync(candidate)) || "";
}

function defaultCdpLaunchCommand() {
  if (process.platform !== "win32") {
    return "";
  }

  const candidate = path.join(
    process.cwd(),
    "scripts",
    "windows",
    "start-chrome-seller-center-debug.cmd"
  );

  return fsSync.existsSync(candidate) ? candidate : "";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function printPdf(tempPath) {
  if (sumatraPath) {
    const printArgs = printerName
      ? ["-print-to", printerName, "-silent", "-exit-on-print", tempPath]
      : ["-print-to-default", "-silent", "-exit-on-print", tempPath];

    await runProcess(sumatraPath, printArgs, {
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

async function readConfig() {
  if (!fsSync.existsSync(configPath)) {
    throw new Error(
      `Seller Center profile config not found: ${configPath}. Run npm run seller-center:profiles first.`
    );
  }

  const parsed = JSON.parse(await fs.readFile(configPath, "utf8"));
  const profiles = Array.isArray(parsed.profiles) ? parsed.profiles : [];
  const defaultSelectors = parsed.defaultSelectors || {};

  return profiles
    .filter((profile) => !selectedProfile || profile.profileName === selectedProfile)
    .map((profile) => {
      const profileName = profile.profileName || profile.storeName || profile.storeId;
      return {
        ...profile,
        profileName,
        selectors: {
          ...defaultSelectors,
          ...(profile.selectors || {})
        },
        sellerCenterUrl:
          profile.sellerCenterUrl ||
          parsed.sellerCenterUrl ||
          "https://seller.shopee.co.th/portal/sale/shipment?type=toship",
        userDataDir:
          profile.userDataDir ||
          path.join(os.homedir(), ".awb-shopee-profiles", String(profileName).replace(/[^\w.-]+/g, "-"))
      };
    })
    .filter((profile) => profile.storeId);
}

function selector(profile, key) {
  return profile.selectors?.[key] || profile[`${key}Selector`] || "";
}

async function clickSelector(page, css, timeout = 8000) {
  if (!css) {
    return false;
  }

  const locator = page.locator(css).first();
  try {
    await locator.waitFor({ state: "visible", timeout });
    await locator.click();
    return true;
  } catch {
    return false;
  }
}

async function fillSelector(page, css, value, timeout = 10000) {
  if (!css) {
    return false;
  }

  const locator = page.locator(css).first();
  try {
    await locator.waitFor({ state: "visible", timeout });
    await locator.fill(value);
    return locator;
  } catch {
    return false;
  }
}

async function clickByRoleOrText(page, pattern, timeout = 8000) {
  const roleLocator = page.getByRole("button", { name: pattern }).first();
  try {
    await roleLocator.waitFor({ state: "visible", timeout });
    await roleLocator.click();
    return true;
  } catch {
    // Fall through to text matching.
  }

  const textLocator = page.getByText(pattern).first();
  try {
    await textLocator.waitFor({ state: "visible", timeout });
    await textLocator.click();
    return true;
  } catch {
    return false;
  }
}

async function ensureLoggedIn(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 30000 }).catch(() => undefined);
  const currentUrl = page.url().toLowerCase();
  if (currentUrl.includes("login") || currentUrl.includes("signin") || currentUrl.includes("/account/")) {
    throw new Error("seller_center_login_required");
  }

  const passwordInputCount = await page.locator("input[type='password']").count().catch(() => 0);
  if (passwordInputCount > 0) {
    throw new Error("seller_center_login_required");
  }
}

async function searchOrder(page, profile, orderSn) {
  const template = profile.orderSearchUrlTemplate || process.env.SHOPEE_ORDER_SEARCH_URL_TEMPLATE || "";
  if (template) {
    await page.goto(template.replaceAll("{orderSn}", encodeURIComponent(orderSn)), {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
    await ensureLoggedIn(page);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
    return;
  }

  await page.goto(profile.sellerCenterUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });
  await ensureLoggedIn(page);

  const configuredInput = await fillSelector(page, selector(profile, "searchInput"), orderSn);
  let input = configuredInput;

  if (!input) {
    const candidates = [
      "input[placeholder*='Order']",
      "input[placeholder*='order']",
      "input[placeholder*='เลข']",
      "input[placeholder*='คำสั่งซื้อ']",
      "input[type='search']",
      "input"
    ];

    for (const candidate of candidates) {
      input = await fillSelector(page, candidate, orderSn, 3000);
      if (input) {
        break;
      }
    }
  }

  if (!input) {
    throw new Error("seller_center_search_input_not_found");
  }

  const clickedSearch = await clickSelector(page, selector(profile, "searchButton"), 3000);
  if (!clickedSearch) {
    await input.press("Enter");
  }

  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
  await page.waitForTimeout(Number.parseInt(profile.afterSearchDelayMs || "2500", 10));
}

async function triggerPrint(page, profile, orderSn) {
  await ensureLoggedIn(page);

  if (profile.clickOrderBeforePrint) {
    const orderText = page.getByText(orderSn, { exact: true }).first();
    await orderText.click({ timeout: 8000 }).catch(() => undefined);
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
  }

  await clickSelector(page, selector(profile, "rowCheckbox"), 2500);

  const downloadPromise = page.waitForEvent("download", { timeout: 30000 }).catch(() => null);
  const popupPromise = page.waitForEvent("popup", { timeout: 30000 }).catch(() => null);

  const clickedPrint =
    (await clickSelector(page, selector(profile, "printButton"))) ||
    (await clickByRoleOrText(page, /print|awb|air waybill|shipping label|ใบปะหน้า|พิมพ์/i));

  if (!clickedPrint) {
    throw new Error("seller_center_print_button_not_found");
  }

  await clickSelector(page, selector(profile, "confirmButton"), 5000);
  await clickByRoleOrText(page, /confirm|ok|yes|print|ยืนยัน|ตกลง|พิมพ์/i, 3000);

  const event = await Promise.race([
    downloadPromise.then((download) => ({ type: "download", download })),
    popupPromise.then((popup) => ({ type: "popup", popup })),
    sleep(Number.parseInt(profile.printSettlingMs || "10000", 10)).then(() => ({ type: "settled" }))
  ]);

  if (event.type === "download" && event.download) {
    const tempPath = path.join(os.tmpdir(), `${randomUUID()}-${event.download.suggestedFilename() || "awb.pdf"}`);
    await event.download.saveAs(tempPath);
    try {
      await printPdf(tempPath);
    } finally {
      await fs.unlink(tempPath).catch(() => undefined);
    }
    return;
  }

  if (event.type === "popup" && event.popup) {
    const popup = event.popup;
    await popup.waitForLoadState("domcontentloaded", { timeout: 15000 }).catch(() => undefined);
    await popup.keyboard.press("Control+P").catch(() => undefined);
    await sleep(Number.parseInt(profile.printSettlingMs || "10000", 10));
  }
}

async function claimNextJob(profile) {
  const { data, error } = await supabase.rpc("claim_next_seller_center_job", {
    p_agent_name: agentName,
    p_store_id: profile.storeId,
    p_browser_profile: profile.profileName
  });

  if (error) {
    throw new Error(`Unable to claim Seller Center job: ${error.message}`);
  }

  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return data[0];
}

async function finishJob(jobId, success, errorMessage = null) {
  const { error } = await supabase.rpc("finish_seller_center_job", {
    p_job_id: jobId,
    p_success: success,
    p_error_msg: errorMessage
  });

  if (error) {
    throw new Error(`Unable to finish Seller Center job: ${error.message}`);
  }
}

function isBrowserUnavailableError(message) {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("failed to launch") ||
    normalized.includes("browser was not found") ||
    normalized.includes("eacces") ||
    normalized.includes("enoent") ||
    normalized.includes("econnrefused") ||
    normalized.includes("ecanceled") ||
    normalized.includes("target page, context or browser has been closed") ||
    normalized.includes("seller_center_cdp_context_not_found")
  );
}

async function requeueJob(jobId, errorMessage) {
  const { error } = await supabase
    .from("seller_center_jobs")
    .update({
      status: "queued",
      error_msg: `automation_browser_unavailable::${errorMessage}`,
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

function loadPlaywright() {
  try {
    return require("playwright-core");
  } catch {
    throw new Error("playwright-core is required. Run npm install before starting the Seller Center agent.");
  }
}

let cdpBrowser = null;
let cdpContext = null;
let lastCdpLaunchAttemptAt = 0;

async function ensureCdpContext(chromium) {
  if (!cdpUrl) {
    return null;
  }

  if (cdpBrowser?.isConnected() && cdpContext) {
    return cdpContext;
  }

  cdpBrowser = await chromium.connectOverCDP(cdpUrl, {
    timeout: 10000
  });
  cdpContext = cdpBrowser.contexts()[0] || null;

  if (!cdpContext) {
    throw new Error("seller_center_cdp_context_not_found");
  }

  return cdpContext;
}

async function openPersistentContext(chromium, profile) {
  await fs.mkdir(profile.userDataDir, { recursive: true });
  return chromium.launchPersistentContext(profile.userDataDir, {
    executablePath: browserExecutable,
    headless: false,
    acceptDownloads: true,
    args: [
      "--kiosk-printing",
      "--disable-crash-reporter",
      "--disable-crashpad",
      "--disable-features=Translate",
      "--no-first-run",
      "--disable-default-apps"
    ]
  });
}

async function openContext(chromium, profile) {
  if (cdpUrl) {
    return ensureCdpContext(chromium);
  }

  return openPersistentContext(chromium, profile);
}

async function tryLaunchCdpBrowser() {
  if (!cdpLaunchCommand) {
    return;
  }

  const now = Date.now();
  if (now - lastCdpLaunchAttemptAt < browserUnavailableBackoffMs) {
    return;
  }

  lastCdpLaunchAttemptAt = now;
  console.error(`[seller-center-agent] trying Chrome CDP launch helper: ${cdpLaunchCommand}`);

  if (process.platform === "win32" && cdpLaunchCommand.toLowerCase().endsWith(".cmd")) {
    await runProcess("cmd.exe", ["/c", cdpLaunchCommand], {
      windowsHide: true
    });
    return;
  }

  await runProcess(cdpLaunchCommand, [], {
    windowsHide: true
  });
}

async function runLoginMode(profiles) {
  const { chromium } = loadPlaywright();
  const contexts = [];

  for (const profile of profiles) {
    console.log(`[seller-center-login] opening ${profile.profileName} (${profile.storeName || profile.storeId})`);
    const context = await openPersistentContext(chromium, profile);
    contexts.push(context);
    const page = context.pages()[0] || (await context.newPage());
    await page.goto(profile.sellerCenterUrl, {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });
  }

  console.log("[seller-center-login] log in to each store window, then press Ctrl+C here.");
  await new Promise((resolve) => {
    process.once("SIGINT", resolve);
    process.once("SIGTERM", resolve);
  });

  await Promise.all(contexts.map((context) => context.close().catch(() => undefined)));
}

async function runJob(chromium, contexts, profile, job) {
  console.log(
    `[seller-center-agent] claimed job ${job.id} for ${job.platform_order_id} (${profile.profileName})`
  );

  const contextKey = cdpUrl ? "__cdp__" : profile.profileName;
  let context = contexts.get(contextKey);
  let page = null;
  let shouldClosePage = false;

  try {
    if (!context) {
      context = await openContext(chromium, profile);
      contexts.set(contextKey, context);
    }

    if (cdpUrl) {
      page = await context.newPage();
      shouldClosePage = true;
    } else {
      page = context.pages()[0] || (await context.newPage());
    }

    await searchOrder(page, profile, job.platform_order_id);
    await triggerPrint(page, profile, job.platform_order_id);
    await finishJob(job.id, true, null);
    console.log(`[seller-center-agent] printed ${job.platform_order_id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "seller_center_automation_failed";
    if (isBrowserUnavailableError(message)) {
      await requeueJob(job.id, message);
      contexts.delete(contextKey);
      console.error(
        `[seller-center-agent] browser unavailable for ${job.platform_order_id}; job requeued: ${message}`
      );
      await sleep(browserUnavailableBackoffMs);
      return;
    }

    await finishJob(job.id, false, message);
    console.error(`[seller-center-agent] failed ${job.platform_order_id}: ${message}`);
  } finally {
    if (shouldClosePage && page) {
      await page.close().catch(() => undefined);
    }

    if (context && closeAfterJob && !cdpUrl) {
      await context.close().catch(() => undefined);
      contexts.delete(contextKey);
    }
  }
}

async function main() {
  const profiles = await readConfig();
  if (profiles.length === 0) {
    throw new Error("No Seller Center profiles are configured.");
  }

  if (loginMode) {
    await runLoginMode(profiles);
    return;
  }

  const { chromium } = loadPlaywright();
  const contexts = new Map();
  const controller = new AbortController();

  function shutdown() {
    console.log("[seller-center-agent] shutting down...");
    controller.abort();
  }

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  console.log(
    `[seller-center-agent] started as ${agentName} with ${profiles.length} profile(s)`
  );

  while (!controller.signal.aborted) {
    let didWork = false;

    if (cdpUrl) {
      try {
        await ensureCdpContext(chromium);
      } catch (error) {
        const message = error instanceof Error ? error.message : "seller_center_browser_unavailable";
        console.error(`[seller-center-agent] Chrome CDP unavailable at ${cdpUrl}: ${message}`);
        await tryLaunchCdpBrowser().catch((launchError) => {
          const launchMessage =
            launchError instanceof Error ? launchError.message : "seller_center_browser_launch_failed";
          console.error(`[seller-center-agent] Chrome CDP launch helper failed: ${launchMessage}`);
        });
        await sleep(browserUnavailableBackoffMs);
        continue;
      }
    }

    for (const profile of profiles) {
      if (controller.signal.aborted) {
        break;
      }

      const job = await claimNextJob(profile);
      if (!job) {
        continue;
      }

      didWork = true;
      await runJob(chromium, contexts, profile, job);
    }

    if (!controller.signal.aborted && !didWork) {
      await sleep(intervalMs);
    }
  }

  if (!cdpUrl) {
    await Promise.all([...contexts.values()].map((context) => context.close().catch(() => undefined)));
  }
  console.log("[seller-center-agent] stopped.");
}

main().catch((error) => {
  console.error("[seller-center-agent] fatal error");
  console.error(error);
  process.exit(1);
});
