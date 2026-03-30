# Unified AWB Platform — Agent Context

## What this project is
A web dashboard for a warehouse team to manage and print AWB (shipping labels) across 20 stores on Shopee and Lazada. All in one place. No more switching between platform tabs.

## Stack (do not deviate)
- **Framework**: Next.js 14 App Router (TypeScript)
- **Database**: Supabase (Postgres + Realtime)
- **Background sync**: n8n (external, already running at n8n.nongkoko.cloud)
- **Styling**: Tailwind CSS
- **Auth**: Custom single-password middleware (bcrypt + cookie), no NextAuth
- **Print**: ZPL via raw TCP socket to thermal printer (port 9100)
- **PDF→ZPL**: Labelary API (REST, free tier)
- **Deploy**: Vercel (frontend) + Supabase (DB)

## Folder structure
```
/app
  /(warehouse)/           # staff-facing pages (no auth required beyond app password)
    page.tsx              # order list — main screen
    scan/page.tsx         # barcode scan mode (1:1)
    batch/page.tsx        # batch print mode (≤N orders)
  /admin/                 # admin pages (same password, single-user)
    page.tsx              # store list + batch_limit config
  /api/
    orders/route.ts       # GET orders with filters
    awb/
      single/route.ts     # POST: lock → AWB → ZPL → print (1:1)
      batch/route.ts      # POST: batch lock → loop AWB → ZPL → print
    admin/
      stores/route.ts     # GET/PATCH stores (batch_limit)
      password/route.ts   # POST: change app password
  /login/page.tsx         # single password login
/lib
  supabase.ts             # supabase client (server + browser)
  print.ts                # TCP ZPL print function
  awb.ts                  # AWB generation per platform (adapter pattern)
  adapters/
    shopee.ts             # Shopee AWB API
    lazada.ts             # Lazada AWB API
/middleware.ts            # protect /admin and /(warehouse) routes
/supabase/migrations/     # SQL migration files
```

## Core conventions
- All DB queries go through `/lib/supabase.ts` — never raw fetch to Supabase REST
- Platform adapters MUST implement `generateAWB(orderId): Promise<{ pdf: Buffer; awbNumber: string }>` — no exceptions
- ZPL print ALWAYS goes through `/lib/print.ts` — never inline TCP code
- Never hardcode printer IP — use `PRINTER_HOST` env var
- All API routes return `{ success: boolean; data?: any; error?: string }`
- Lock expiry is 120 seconds (not 60) — batch of 20 orders needs the headroom
- Batch limit per store comes from `stores.batch_limit` column (default 20)

## Critical business rules
1. **Never print the same AWB twice** — always check + acquire `order_locks` before calling AWB API
2. **Lock is atomic** — use `INSERT INTO order_locks ... ON CONFLICT DO NOTHING` and check rows affected
3. **Batch lock is all-or-nothing per order** — if lock fails for an order, mark it failed and continue (do NOT abort whole batch)
4. **Undo toast** — batch print has a 2-second delay before execution; show "Undo" button during countdown
5. **Reprint** — after batch, show per-order result; failed orders can be reprinted via reprint button
6. **n8n is the ONLY thing that writes new orders to DB** — API routes never pull from Shopee/Lazada directly except for AWB generation

## Auth
- Single password for entire app, stored as bcrypt hash in `app_config` table (`key = 'admin_password_hash'`)
- Middleware checks `awb_session` cookie (signed JWT, 24h expiry)
- `/login` is the only public route
- No roles — everyone who knows the password has full access including /admin

## Environment variables required
See `.env.example` — never commit real values
