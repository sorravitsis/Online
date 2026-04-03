-- 001_initial_schema.sql
-- Unified AWB Platform — Initial Schema
-- Run this in Supabase SQL Editor

-- ─────────────────────────────────────────
-- STORES
-- ─────────────────────────────────────────
CREATE TABLE stores (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text        NOT NULL,
  platform      text        NOT NULL CHECK (platform IN ('shopee', 'lazada')),
  shop_id       text        NOT NULL,
  access_token  text,
  refresh_token text,
  token_expiry  timestamptz,
  batch_limit   integer     NOT NULL DEFAULT 20,
  is_active     boolean     NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ─────────────────────────────────────────
-- ORDERS (written by n8n sync — never by app)
-- ─────────────────────────────────────────
CREATE TABLE orders (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id            uuid        NOT NULL REFERENCES stores(id),
  platform_order_id   text        NOT NULL,
  barcode_value       text,
  buyer_name          text,
  items_json          jsonb       NOT NULL DEFAULT '[]',
  awb_status          text        NOT NULL DEFAULT 'pending'
                                  CHECK (awb_status IN ('pending','printing','printed','failed')),
  awb_number          text,
  printed_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (store_id, platform_order_id)
);

CREATE INDEX ON orders (store_id);
CREATE INDEX ON orders (awb_status) WHERE awb_status = 'pending';
CREATE INDEX ON orders (barcode_value) WHERE barcode_value IS NOT NULL;
CREATE INDEX ON orders (created_at DESC);

-- ─────────────────────────────────────────
-- ORDER LOCKS (distributed lock, auto-expire 120s)
-- ─────────────────────────────────────────
CREATE TABLE order_locks (
  order_id    uuid        PRIMARY KEY REFERENCES orders(id),
  locked_by   text        NOT NULL,  -- session token or batch_id
  locked_at   timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '120 seconds'
);

-- ─────────────────────────────────────────
-- PRINT LOG (audit trail, never deleted)
-- ─────────────────────────────────────────
CREATE TABLE print_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid        NOT NULL REFERENCES orders(id),
  batch_id    uuid,                  -- null for 1:1 prints
  awb_number  text,
  mode        text        NOT NULL CHECK (mode IN ('1to1', 'batch')),
  batch_size  integer,               -- null for 1:1 prints
  status      text        NOT NULL DEFAULT 'printed'
                          CHECK (status IN ('printed', 'failed')),
  error_msg   text,
  printed_by  text,                  -- session identifier
  printed_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON print_log (order_id);
CREATE INDEX ON print_log (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX ON print_log (printed_at DESC);

-- ─────────────────────────────────────────
-- APP CONFIG (single-row settings)
-- ─────────────────────────────────────────
CREATE TABLE app_config (
  key    text PRIMARY KEY,
  value  text NOT NULL
);

-- Insert default password hash for 'changeme'
-- IMPORTANT: change this immediately after first login
INSERT INTO app_config (key, value) VALUES
  ('admin_password_hash', 'REDACTED');
-- ^ bcrypt hash of 'changeme' — replace via Admin UI after setup

-- ─────────────────────────────────────────
-- REALTIME (enable for order status updates)
-- ─────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
