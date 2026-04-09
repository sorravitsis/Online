# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Next.js dev server
npm run build        # Production build
npm test             # Run all tests (custom runner via tests/run-tests.cjs)
npm run lint         # ESLint
npm run preflight    # TypeScript check + tests + build (run before shipping)
```

Tests use Vitest but are run via a custom CommonJS runner (`tests/run-tests.cjs`). Test files live in `tests/` as `.test.cjs` files.

## Architecture

**What it does:** Unified AWB (shipping label) dashboard for a warehouse. Aggregates orders from Shopee and Lazada, generates labels, and prints to a ZPL thermal printer over TCP.

### Data Flow

```
n8n (order sync, 5-min poll) → Supabase → Next.js dashboard → AWB generation → ZPL print
```

### Print Modes

- **Scan (1:1):** Barcode scan → lock → generate AWB → send ZPL over TCP to printer
- **Batch:** Checkbox selection → 2-sec undo toast → atomic lock → sequential print loop

### Key Layers

**API routes** (`/app/api/`):
- `/api/awb/single` and `/api/awb/batch` — main print workflows
- `/api/orders` — fetch/filter orders
- `/api/admin/*` — store config, Lazada OAuth, password management
- `/api/cron/cleanup-locks` — expire orphaned locks (called by Vercel Cron or n8n)

**Business logic** (`/lib/`):
- `print-workflow.ts` — Core orchestration: acquire lock → generate AWB → convert to ZPL → print → release lock
- `adapters/shopee.ts` and `adapters/lazada.ts` — Platform-specific AWB generation; both implement `PlatformAdapter`
- `print.ts` — Raw TCP socket send to thermal printer
- `labelary.ts` — PDF → ZPL conversion via Labelary API
- `batch.ts`, `scan.ts`, `orders.ts` — Domain logic
- `auth.ts` — JWT session via httpOnly cookie
- `supabase.ts` — DB clients (anon + service role)
- `env.ts` — Env var validation at startup

**Database** (Supabase/Postgres):
- `stores` — OAuth tokens, `batch_limit`, `is_active`
- `orders` — Order state: `pending | printing | printed | failed`, AWB number
- `order_locks` — Atomic lock (`ON CONFLICT DO NOTHING`, 120s expiry)
- `print_log` — Audit trail
- `app_config` — Admin password hash

### Locking Pattern

Batch and single print both acquire a row in `order_locks` atomically. A cron job cleans up locks older than 120s. Batch failures are non-aborting — locked/failed orders are skipped, the rest continue.

### Print Transport

Controlled by `PRINT_TRANSPORT` env var:
- `direct_tcp` (default) — sends ZPL directly from server over TCP to LAN printer (port 9100)
- `local_queue` — inserts into `print_jobs` table; a Windows PC agent polls and prints via USB

### Adding a New Platform

Implement `PlatformAdapter` in `/lib/adapters/` (see existing Shopee/Lazada adapters), then register it in the adapter lookup used by `print-workflow.ts`.

## Auth

Password-based, single admin account. Login → JWT in httpOnly cookie. Middleware (`middleware.ts`) enforces auth on all routes except `/login`, `/api/auth/login`, `/api/cron/cleanup-locks`, and `/api/admin/lazada/callback`.

## Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
AUTH_SECRET                  # openssl rand -base64 32
PRINTER_HOST
PRINTER_PORT                 # default 9100
SHOPEE_APP_ID
SHOPEE_APP_KEY
SHOPEE_API_BASE
LAZADA_APP_KEY
LAZADA_APP_SECRET
LAZADA_API_BASE
LAZADA_AUTH_BASE
LAZADA_REDIRECT_URI
LABELARY_API_URL
```

Optional: `CRON_SECRET`, `PRINT_TRANSPORT`.
