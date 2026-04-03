# Go-Live Checklist

Use this checklist after the repo is deployed and connected to real services.

## 1. Supabase

- run `001_initial_schema.sql`
- confirm `stores`, `orders`, `order_locks`, `print_log`, and `app_config` exist
- confirm `admin_password_hash` exists in `app_config`
- insert or update real store rows
- verify each store has the right `batch_limit`

## 2. Vercel

- create the project from this repository
- add all env vars from `.env.example`
- set `CRON_SECRET`
- deploy `main`
- if you are on Vercel Hobby, do not use Vercel Cron for cleanup
- if you are on Vercel Hobby, create an `n8n` workflow that calls `/api/cron/cleanup-locks` every 5 minutes with `Authorization: Bearer <CRON_SECRET>`
- if you are on Vercel Pro or above, you may reintroduce a native cron schedule later

## 3. n8n

- point the Shopee workflow to the correct Supabase project
- confirm sync is writing `READY_TO_SHIP` orders into `orders`
- validate `barcode_value` matches the physical scanner output
- repeat for each production Shopee store before go-live
- create a second workflow for stale lock cleanup that calls `GET /api/cron/cleanup-locks`

## 4. Printer

- confirm `PRINTER_HOST` and `PRINTER_PORT`
- verify the warehouse network can reach the printer on TCP `9100`
- run a real ZPL smoke test
- confirm the printer understands the generated label format

## 5. Functional Smoke Test

- log in with the shared password
- change the password from `/admin`
- scan 1 pending order and confirm a single AWB is printed
- retry the same order and confirm `already_printed`
- open 2 browser sessions and confirm the second sees `locked`
- run one batch print with mixed success and confirm `reprint failed` works
- confirm `print_log.printed_by` is populated with a session-specific identifier

## 6. Launch Readiness

- verify no stale rows remain in `order_locks`
- inspect `print_log` for duplicate `awb_number`
- confirm warehouse staff know `/`, `/scan`, `/batch`, and `/admin`
- keep the first-day monitoring window open for Vercel logs and Supabase activity
