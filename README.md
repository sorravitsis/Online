# Unified AWB Platform

Warehouse-first AWB dashboard for Shopee and Lazada stores using Next.js 14, Supabase, and raw TCP printing.

## Current Status

The local web app now includes:

- shared password auth with middleware
- order list with filters, pagination, and Supabase Realtime refresh
- scan mode for 1:1 printing
- batch print queue with undo, progress, and reprint failed
- admin controls for `batch_limit`, store activation, and password rotation
- route loading states, error boundaries, cron cleanup endpoint, and load-test helper scripts

## Required Environment Variables

Copy `.env.example` to `.env.local` and fill in real values:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_SECRET`
- `CRON_SECRET`
- `PRINTER_HOST`
- `PRINTER_PORT`
- `SHOPEE_APP_ID`
- `SHOPEE_APP_KEY`
- `SHOPEE_API_BASE`
- `LAZADA_APP_KEY`
- `LAZADA_APP_SECRET`
- `LAZADA_API_BASE`
- `LAZADA_AUTH_BASE`
- `LAZADA_REDIRECT_URI`
- `LABELARY_API_URL`

## Local Commands

```bash
npm install
npm run dev
npm test
npm run build
```

Preflight verification:

```bash
npm run preflight
```

Load-test helpers:

```bash
npm run seed:load-test
npm run verify:load-test
```

Optional overrides:

- `LOAD_TEST_COUNT=600`
- `LOAD_TEST_PREFIX=LT-2026-03-30`
- `LOAD_TEST_STORE_ID=<existing-store-uuid>`

## Deploy Notes

- set `CRON_SECRET` in Vercel so `/api/cron/cleanup-locks` stays protected
- on Vercel Hobby, use `n8n` to call `/api/cron/cleanup-locks` every 5 minutes instead of Vercel Cron
- add the same runtime env vars in Vercel and Supabase before go-live
- follow [docs/go-live-checklist.md](./docs/go-live-checklist.md) during production rollout
- use [supabase/seeds/store-onboarding-template.sql](./supabase/seeds/store-onboarding-template.sql) as the starting SQL for each real store
- for Lazada store connection, register `LAZADA_REDIRECT_URI` in the Lazada Open Platform app and then use the `Connect Lazada store` button in `/admin`

## Local Queue Mode For USB Printers

Use this mode when the warehouse printer is attached to a Windows PC by USB and cannot accept raw TCP ZPL from Vercel.

1. Run [supabase/migrations/002_print_jobs_queue.sql](./supabase/migrations/002_print_jobs_queue.sql) in Supabase.
2. Set `PRINT_TRANSPORT=local_queue` in Vercel.
3. Push and redeploy `main`.
4. On the warehouse Windows PC, pull the repo and run:

```bash
npm install
npm run print:agent
```

Recommended agent env vars on the warehouse PC:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PRINT_TRANSPORT=local_queue`
- `LOCAL_PRINT_AGENT_NAME=warehouse-deli-01`
- `LOCAL_PRINTER_NAME=<Windows printer name>`
- `PRINT_AGENT_INTERVAL_MS=3000`

Optional PDF printing env vars:

- `SUMATRA_PDF_PATH=C:\\Path\\To\\SumatraPDF.exe`
- `PDF_PRINT_COMMAND=<custom PowerShell command with {file} and {printer}>`

Behavior in local queue mode:

- the web app still acquires the order lock and generates the AWB
- the app stores a `print_jobs` row and keeps the order in `printing`
- the local Windows agent claims the job, prints it through the local driver, and finalizes `orders` + `print_log`
- failed local prints move the order to `failed` without marking it as printed

## Still Requires Real-World Validation

These steps cannot be completed from the repo alone:

- onboard real Shopee and Lazada stores into Supabase
- verify n8n order sync against live platform credentials
- test printer TCP connectivity on the warehouse LAN
- validate Shopee and Lazada AWB API response shapes with real tokens
- run go-live verification on production infrastructure
