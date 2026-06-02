const BRIDGE_URL = "http://127.0.0.1:5137";
const POLL_INTERVAL_MS = 5000;
const DOWNLOAD_TIMEOUT_MS = 45000;
const TAB_LOAD_TIMEOUT_MS = 60000;

let running = false;
let lastStatus = "idle";

function setStatus(status) {
  lastStatus = status;
  chrome.action.setBadgeText({ text: status === "idle" ? "" : status.slice(0, 4).toUpperCase() });
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${BRIDGE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(body.error || `bridge_http_${response.status}`);
  }
  return body.data ?? null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryTabs(queryInfo) {
  return chrome.tabs.query(queryInfo);
}

async function findSellerCenterTab() {
  const sellerTabs = await queryTabs({ url: "https://seller.shopee.co.th/*" });
  if (sellerTabs.length > 0) {
    return sellerTabs[0];
  }

  const accountTabs = await queryTabs({ url: "https://accounts.shopee.co.th/*" });
  if (accountTabs.length > 0) {
    return accountTabs[0];
  }

  return null;
}

async function waitForTabComplete(tabId) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < TAB_LOAD_TIMEOUT_MS) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") {
      await sleep(1500);
      return tab;
    }
    await sleep(500);
  }

  throw new Error("seller_center_tab_load_timeout");
}

async function ensureSellerCenterTab(url) {
  const existing = await findSellerCenterTab();
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true, url });
    return waitForTabComplete(existing.id);
  }

  const created = await chrome.tabs.create({ active: true, url });
  return waitForTabComplete(created.id);
}

async function sendJobToTab(tabId, job) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await chrome.tabs.sendMessage(tabId, {
        type: "PRINT_SHOPEE_ORDER",
        job
      });
    } catch (error) {
      await sleep(1000);
    }
  }

  throw new Error("seller_center_content_script_unavailable");
}

function waitForDownload(startedAt) {
  return new Promise((resolve, reject) => {
    let downloadId = null;
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error("seller_center_download_not_detected"));
    }, DOWNLOAD_TIMEOUT_MS);

    function cleanup() {
      clearTimeout(timeout);
      chrome.downloads.onCreated.removeListener(onCreated);
      chrome.downloads.onChanged.removeListener(onChanged);
    }

    function isRelevantDownload(item) {
      if (item.startTime && Date.parse(item.startTime) < startedAt - 2000) {
        return false;
      }
      const filename = item.filename || item.url || "";
      return /\.pdf($|\?)/i.test(filename) || /shipping|awb|label|air.?waybill/i.test(filename);
    }

    function onCreated(item) {
      if (!downloadId && isRelevantDownload(item)) {
        downloadId = item.id;
      }
    }

    async function onChanged(delta) {
      if (!downloadId || delta.id !== downloadId || !delta.state?.current) {
        return;
      }

      if (delta.state.current === "complete") {
        const [item] = await chrome.downloads.search({ id: downloadId });
        cleanup();
        resolve(item?.filename || "");
      } else if (delta.state.current === "interrupted") {
        cleanup();
        reject(new Error("seller_center_download_interrupted"));
      }
    }

    chrome.downloads.onCreated.addListener(onCreated);
    chrome.downloads.onChanged.addListener(onChanged);
  });
}

async function finishJob(jobId, payload) {
  await fetchJson("/job/finish", {
    method: "POST",
    body: JSON.stringify({
      jobId,
      ...payload
    })
  });
}

async function requeueBrowserUnavailable(jobId, error) {
  await fetchJson("/job/requeue-browser-unavailable", {
    method: "POST",
    body: JSON.stringify({
      jobId,
      error
    })
  });
}

async function runJob(job) {
  setStatus("job");
  const tab = await ensureSellerCenterTab(job.sellerCenterUrl);
  const downloadStartedAt = Date.now();
  const downloadPromise = waitForDownload(downloadStartedAt).catch((error) => ({ error }));
  const result = await sendJobToTab(tab.id, job);

  if (!result?.success) {
    await finishJob(job.id, {
      success: false,
      error: result?.error || "seller_center_extension_failed"
    });
    return;
  }

  const downloadedFilePath = await downloadPromise;
  if (downloadedFilePath?.error) {
    await finishJob(job.id, {
      success: false,
      error: downloadedFilePath.error.message || "seller_center_download_not_detected"
    });
    return;
  }

  await finishJob(job.id, {
    success: true,
    downloadedFilePath
  });
}

async function pollOnce() {
  if (running) {
    return;
  }

  running = true;
  try {
    setStatus("poll");
    const job = await fetchJson("/job/next");
    if (!job) {
      setStatus("idle");
      return;
    }

    await runJob(job);
    setStatus("idle");
  } catch (error) {
    console.error("[awb-shopee-extension]", error);
    setStatus("err");
  } finally {
    running = false;
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("awb-shopee-poll", { periodInMinutes: 1 });
  pollOnce();
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("awb-shopee-poll", { periodInMinutes: 1 });
  pollOnce();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "awb-shopee-poll") {
    pollOnce();
  }
});

chrome.action.onClicked.addListener(() => {
  pollOnce();
});

setInterval(pollOnce, POLL_INTERVAL_MS);
