# Task Breakdown — Unified AWB Platform

Tasks are ordered by dependency. Complete them in sequence.
Each task is scoped so Codex can execute it in one session.

---

## Phase 1 — Foundation

### TASK-001: Project scaffold
- Init Next.js 14 with TypeScript and Tailwind CSS
- Install dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `bcryptjs`, `jose`, `zpl-image` (or labelary fetch), `@types/bcryptjs`
- Create folder structure exactly as defined in AGENTS.md
- Create `.env.local` from `.env.example`
- Verify `npm run dev` starts without errors

### TASK-002: Supabase client setup
- Create `/lib/supabase.ts` with:
  - `createServerClient()` — for API routes and server components (uses cookies)
  - `createBrowserClient()` — for client components
- Follow Supabase SSR pattern for Next.js App Router
- Export both clients

### TASK-003: Run database migration
- Apply `/supabase/migrations/001_initial_schema.sql` to Supabase project
- Verify all tables exist: `stores`, `orders`, `order_locks`, `print_log`, `app_config`
- Insert initial admin password hash: `bcrypt('changeme', 10)` into `app_config`

### TASK-004: Auth middleware
- Create `/middleware.ts`:
  - Public route: `/login`
  - All other routes: check `awb_session` cookie (JWT signed with `AUTH_SECRET`)
  - Redirect to `/login` if invalid/missing
- Create `/app/login/page.tsx`:
  - Single password input form
  - POST to `/api/auth/login`
- Create `/app/api/auth/login/route.ts`:
  - Compare submitted password with bcrypt hash from `app_config`
  - On match: sign JWT with `jose`, set `awb_session` cookie (httpOnly, 24h)
  - Return 401 on mismatch
- Create `/app/api/auth/logout/route.ts`: clear cookie

---

## Phase 2 — Order List Dashboard

### TASK-005: Order list page
- Create `/app/(warehouse)/page.tsx` (server component)
- Fetch orders from Supabase with filters:
  - `status` filter: all / pending / printed / failed
  - `store_id` filter: dropdown of all stores
  - `date` filter: today (default) / date picker
- Display columns: order ID, store name, buyer name, items (from items_json), AWB status, created_at
- Show badge color per status: pending=yellow, printing=blue, printed=green, failed=red
- Paginate: 50 orders per page
- Add "Scan Mode" button → `/scan`
- Add "Batch Print" button → `/batch`

### TASK-006: Realtime order status updates
- Convert order list to client component
- Subscribe to Supabase Realtime on `orders` table (`awb_status` changes)
- Update row in-place when status changes (no full reload)
- Show subtle flash animation on updated row

---

## Phase 3 — Scan & Print (1:1)

### TASK-007: ZPL print utility
- Create `/lib/print.ts`:
  ```ts
  export async function printZPL(zpl: string): Promise<void>
  ```
  - Open TCP socket to `PRINTER_HOST:PRINTER_PORT` (default 9100)
  - Write ZPL string as raw bytes
  - Close socket
  - Throw error with message if connection fails
- Use Node.js `net` module (built-in)

### TASK-008: Platform adapters
- Create `/lib/adapters/shopee.ts`:
  - Implement `generateAWB(order: Order): Promise<{ pdf: Buffer; awbNumber: string }>`
  - Call Shopee Open API `logistics/init` then `logistics/getTrackingNumber`
  - Handle token refresh if expired
- Create `/lib/adapters/lazada.ts`:
  - Same interface
  - Call Lazada Open API equivalent endpoints
- Create `/lib/awb.ts`:
  - `getAdapter(platform: string)` → returns correct adapter
  - Export `generateAWB(order: Order)` that routes to correct adapter

### TASK-009: AWB single print API
- Create `/app/api/awb/single/route.ts` (POST):
  ```
  Body: { orderId: string }
  ```
  1. Fetch order by ID, verify `awb_status = 'pending'`
  2. If already printed: return `{ success: false, error: 'already_printed' }`
  3. `INSERT INTO order_locks (order_id, locked_by, expires_at) VALUES (?, sessionId, now()+120s) ON CONFLICT DO NOTHING`
  4. If 0 rows inserted: return `{ success: false, error: 'locked' }`
  5. Call `generateAWB(order)` → get PDF buffer + AWB number
  6. Fetch ZPL from Labelary API (POST PDF, get ZPL back)
  7. Call `printZPL(zpl)`
  8. UPDATE order: `awb_status='printed'`, `awb_number`, `printed_at`
  9. INSERT print_log: `{ order_id, awb_number, mode:'1to1', status:'printed' }`
  10. DELETE from order_locks
  11. Return `{ success: true, awbNumber }`
  - On any error: UPDATE order `awb_status='failed'`, DELETE lock, INSERT print_log with `status:'failed'`, return error

### TASK-010: Scan mode UI
- Create `/app/(warehouse)/scan/page.tsx` (client component)
- Auto-focus hidden input on mount (captures barcode scanner keystrokes)
- On barcode scan (Enter key after input):
  1. Look up order by `barcode_value` field
  2. Show order details card (buyer, items, store)
  3. POST to `/api/awb/single`
  4. Show success (green flash + AWB number) or error (red + reason)
  5. Clear input, re-focus, ready for next scan
- Keyboard shortcut: `Escape` → back to order list

---

## Phase 4 — Batch Print

### TASK-011: AWB batch print API
- Create `/app/api/awb/batch/route.ts` (POST):
  ```
  Body: { orderIds: string[] }  // max enforced by store.batch_limit
  ```
  1. Fetch all orders, verify all `awb_status = 'pending'`
  2. For each order: attempt lock INSERT → collect `locked: string[]`, `failed: string[]`
  3. For each locked order (sequential, not parallel):
     a. generateAWB → ZPL → printZPL
     b. On success: UPDATE printed, INSERT print_log status='printed', release lock
     c. On error: UPDATE failed, INSERT print_log status='failed', release lock
  4. Return `{ success: true, results: [{ orderId, status, awbNumber?, error? }] }`
  - Generate one `batch_id` (uuid) shared across all print_log entries in this batch

### TASK-012: Batch print UI
- Create `/app/(warehouse)/batch/page.tsx` (client component)
- Fetch pending orders (same filters as order list)
- Checkbox selection — enforce max = store's `batch_limit` (fetch from store record)
- Counter: "N / 20 selected"
- "Print Selected" button (disabled if 0 selected):
  1. Start 2-second countdown toast: "Printing N orders in 2s — Undo"
  2. Undo button cancels the timeout
  3. After 2s: POST to `/api/awb/batch`
  4. Show progress: processing spinner while waiting
  5. Show summary: ✅ M printed / ❌ K failed
  6. "Reprint Failed" button: re-submits only failed order IDs to `/api/awb/batch`

---

## Phase 5 — Admin UI

### TASK-013: Admin store management
- Create `/app/admin/page.tsx` (client component)
- Display table of all stores: name, platform, shop_id, batch_limit, is_active
- Inline edit `batch_limit` (number input, min 1 max 50)
- Save button per row → PATCH `/api/admin/stores/[id]`
- Toggle `is_active` per store
- Create `/app/api/admin/stores/[id]/route.ts` (PATCH):
  - Update `batch_limit` and/or `is_active`
  - Return updated store

### TASK-014: Admin password change
- Add password change form to `/app/admin/page.tsx`
- POST to `/api/admin/password`:
  - Verify current password
  - Hash new password with bcrypt(10)
  - UPDATE `app_config` SET value = newHash WHERE key = 'admin_password_hash'

---

## Phase 6 — Hardening

### TASK-015: Error boundaries + loading states
- Add `error.tsx` and `loading.tsx` to each route segment
- Wrap all client components with ErrorBoundary
- All API routes must return proper HTTP status codes (200/400/401/409/500)

### TASK-016: Lock expiry cleanup
- Create `/app/api/cron/cleanup-locks/route.ts`:
  - DELETE FROM order_locks WHERE expires_at < now()
  - Called by Vercel Cron every 5 minutes
- Add to `vercel.json`:
  ```json
  { "crons": [{ "path": "/api/cron/cleanup-locks", "schedule": "*/5 * * * *" }] }
  ```

### TASK-017: Load test
- Simulate 600 orders in DB (seed script)
- Manually trigger 20-order batch 5 times in quick succession
- Verify no duplicate AWB numbers in print_log
- Verify all locks released after each batch

---

## Deferred (Phase 2 — post go-live)
- TASK-018: Supabase Auth (email/password per user)
- TASK-019: Role system (admin / staff)
- TASK-020: Analytics dashboard (orders per day, print success rate)
- TASK-021: Multi-warehouse routing
