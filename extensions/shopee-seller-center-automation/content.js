function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isVisible(element) {
  if (!element) {
    return false;
  }
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function textOf(element) {
  return (element?.innerText || element?.textContent || "").replace(/\s+/g, " ").trim();
}

function isLoginPage() {
  return (
    location.href.includes("accounts.shopee.co.th") ||
    location.href.includes("/seller/login") ||
    document.querySelectorAll("input[type='password']").length > 0
  );
}

function setNativeValue(input, value) {
  const prototype = Object.getPrototypeOf(input);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  if (descriptor?.set) {
    descriptor.set.call(input, value);
  } else {
    input.value = value;
  }
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

async function waitUntil(predicate, timeoutMs = 30000, intervalMs = 500) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const value = await predicate();
    if (value) {
      return value;
    }
    await sleep(intervalMs);
  }
  return null;
}

function findVisibleInput() {
  const selectors = [
    "input[placeholder*='Order']",
    "input[placeholder*='order']",
    "input[placeholder*='คำสั่งซื้อ']",
    "input[placeholder*='เลข']",
    "input[placeholder*='ค้นหา']",
    "input[type='search']",
    "input[role='combobox']",
    "input:not([type='hidden']):not([type='password'])"
  ];

  for (const selector of selectors) {
    const input = [...document.querySelectorAll(selector)].find(isVisible);
    if (input) {
      return input;
    }
  }

  return null;
}

function clickFirstByText(patterns) {
  const candidates = [
    ...document.querySelectorAll("button, [role='button'], a, div, span")
  ].filter(isVisible);

  for (const pattern of patterns) {
    const match = candidates.find((element) => pattern.test(textOf(element)));
    if (match) {
      match.click();
      return true;
    }
  }

  return false;
}

function findOrderContainer(orderSn) {
  const textNode = [...document.querySelectorAll("body *")]
    .filter(isVisible)
    .find((element) => textOf(element).includes(orderSn));

  if (!textNode) {
    return null;
  }

  let current = textNode;
  for (let depth = 0; depth < 8 && current?.parentElement; depth += 1) {
    const rect = current.getBoundingClientRect();
    if (rect.width > 500 && rect.height > 40 && rect.height < 500) {
      return current;
    }
    current = current.parentElement;
  }

  return textNode;
}

function clickCheckboxIn(container) {
  const checkbox =
    [...container.querySelectorAll("input[type='checkbox'], [role='checkbox']")].find(isVisible) ||
    [...document.querySelectorAll("input[type='checkbox'], [role='checkbox']")].find(isVisible);
  if (!checkbox) {
    return false;
  }

  checkbox.click();
  return true;
}

async function searchOrder(orderSn) {
  const input = await waitUntil(findVisibleInput, 30000);
  if (!input) {
    throw new Error("seller_center_search_input_not_found");
  }

  input.focus();
  setNativeValue(input, orderSn);
  await sleep(200);

  if (
    !clickFirstByText([
      /^Search$/i,
      /ค้นหา/,
      /ค้นหาออเดอร์/,
      /Search Order/i
    ])
  ) {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", bubbles: true }));
  }

  await sleep(2500);
}

async function triggerPrint(orderSn) {
  const orderContainer = await waitUntil(() => findOrderContainer(orderSn), 30000);
  if (!orderContainer) {
    throw new Error("seller_center_order_not_found");
  }

  const rowPrintButton = [...orderContainer.querySelectorAll("button, [role='button'], a")]
    .filter(isVisible)
    .find((element) => /พิมพ์|print|awb|air waybill|shipping label|ใบปะหน้า/i.test(textOf(element)));

  if (rowPrintButton) {
    rowPrintButton.click();
  } else {
    clickCheckboxIn(orderContainer);
    await sleep(500);
    if (
      !clickFirstByText([
        /พิมพ์ใบปะหน้า/i,
        /ใบปะหน้า/i,
        /shipping label/i,
        /air waybill/i,
        /\bAWB\b/i,
        /\bPrint\b/i,
        /พิมพ์/i
      ])
    ) {
      throw new Error("seller_center_print_button_not_found");
    }
  }

  await sleep(700);
  clickFirstByText([
    /^Confirm$/i,
    /^OK$/i,
    /^Yes$/i,
    /ยืนยัน/,
    /ตกลง/,
    /พิมพ์/
  ]);
}

async function printShopeeOrder(job) {
  await waitUntil(() => document.readyState === "complete" || document.readyState === "interactive", 30000);
  await sleep(1000);

  if (isLoginPage()) {
    return {
      success: false,
      error: "seller_center_login_required"
    };
  }

  try {
    await searchOrder(job.platformOrderId);
    await triggerPrint(job.platformOrderId);
    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "seller_center_extension_failed"
    };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "PRINT_SHOPEE_ORDER") {
    return false;
  }

  printShopeeOrder(message.job).then(sendResponse);
  return true;
});
