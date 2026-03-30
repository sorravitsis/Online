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

- `vercel.json` schedules `/api/cron/cleanup-locks` every 5 minutes
- set `CRON_SECRET` in Vercel so cleanup is protected in production
- add the same runtime env vars in Vercel and Supabase before go-live

## Still Requires Real-World Validation

These steps cannot be completed from the repo alone:

- onboard real Shopee and Lazada stores into Supabase
- verify n8n order sync against live platform credentials
- test printer TCP connectivity on the warehouse LAN
- validate Shopee and Lazada AWB API response shapes with real tokens
- run go-live verification on production infrastructure
