const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const os = require("node:os");
const path = require("node:path");
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

function slug(value) {
  return String(value || "shopee-store")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "shopee-store";
}

loadEnvFile(path.join(process.cwd(), ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const configPath =
  process.env.SHOPEE_SELLER_CENTER_PROFILES_PATH ||
  path.join(process.cwd(), "scripts", "windows", "shopee-seller-center-profiles.json");

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function readExistingConfig() {
  if (!fsSync.existsSync(configPath)) {
    return {
      sellerCenterUrl: "https://seller.shopee.co.th/portal/sale/shipment?type=toship",
      defaultSelectors: {},
      profiles: []
    };
  }

  return JSON.parse(await fs.readFile(configPath, "utf8"));
}

async function main() {
  const { data, error } = await supabase
    .from("stores")
    .select("id,name,shop_id")
    .eq("platform", "shopee")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Unable to load Shopee stores: ${error.message}`);
  }

  const config = await readExistingConfig();
  const existingProfiles = Array.isArray(config.profiles) ? config.profiles : [];
  const byStoreId = new Map(existingProfiles.map((profile) => [profile.storeId, profile]));

  const profiles = (data || []).map((store) => {
    const existing = byStoreId.get(store.id) || {};
    const profileName = existing.profileName || slug(store.name);

    return {
      storeId: store.id,
      storeName: store.name,
      shopId: store.shop_id,
      profileName,
      userDataDir:
        existing.userDataDir ||
        path.join(os.homedir(), ".awb-shopee-profiles", profileName),
      sellerCenterUrl:
        existing.sellerCenterUrl ||
        config.sellerCenterUrl ||
        "https://seller.shopee.co.th/portal/sale/shipment?type=toship",
      orderSearchUrlTemplate: existing.orderSearchUrlTemplate || "",
      selectors: existing.selectors || {}
    };
  });

  const nextConfig = {
    sellerCenterUrl:
      config.sellerCenterUrl ||
      "https://seller.shopee.co.th/portal/sale/shipment?type=toship",
    defaultSelectors: config.defaultSelectors || {},
    profiles
  };

  await fs.mkdir(path.dirname(configPath), { recursive: true });
  await fs.writeFile(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");

  console.log(`Wrote ${profiles.length} Shopee profile(s) to ${configPath}`);
  for (const profile of profiles) {
    console.log(`- ${profile.storeName}: ${profile.profileName}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
