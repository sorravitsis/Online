# AWB Platform

A Next.js 14 warehouse/order management platform for printing airway bills (AWBs) and managing orders from Shopee and Lazada marketplaces.

## Architecture

- **Framework**: Next.js 14 (App Router)
- **Auth**: Custom JWT session auth via `jose`, stored in HTTP-only cookies
- **Database**: Supabase (PostgreSQL) via `@supabase/ssr` and `@supabase/supabase-js`
- **Styling**: Tailwind CSS
- **Validation**: Zod

## Key Directories

- `app/` — Next.js App Router pages and API routes
- `components/` — Shared React components
- `lib/` — Server and client utilities (auth, supabase, env, api helpers)
- `middleware.ts` — Auth guard; redirects unauthenticated users to `/login`
- `tests/` — Integration/unit tests
- `scripts/` — Utility scripts (seeding, load testing)
- `supabase/` — Supabase config/migrations

## Environment Variables

See `.env.example` for the full list. Required variables:

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (server-side only)
- `AUTH_SECRET` — 32-char random secret for JWT signing
- `PRINTER_HOST` — Thermal printer IP address
- `SHOPEE_APP_ID`, `SHOPEE_APP_KEY`, `SHOPEE_API_BASE` — Shopee Open API credentials
- `LAZADA_APP_KEY`, `LAZADA_APP_SECRET`, `LAZADA_API_BASE`, `LAZADA_REDIRECT_URI` — Lazada Open API credentials
- `LABELARY_API_URL` — Label conversion API

## Running on Replit

- Dev server: `npm run dev` (port 5000, 0.0.0.0)
- The workflow "Start application" runs `npm run dev` automatically
- Package manager: npm (package-lock.json)
