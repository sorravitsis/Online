# Development Roadmap — Unified AWB Platform

**Start Date:** 2026-03-28  
**Target Go-Live:** 2026-04-18 (3 สัปดาห์)  
**Dev Bandwidth:** 2–4 ชั่วโมง/วัน (avg 3h)  
**Total Budget:** ~63 ชั่วโมง  
**Dev Style:** Vibe coding ผ่าน OpenAI Codex  
**Campaign Deadline:** > 1 เดือน (ไม่กดดัน)

---

## Scope Decision

### Go-Live MVP (3 สัปดาห์)
✅ ต้องมีก่อน go-live ทุกข้อ:
- Auth (single password)
- Order list + realtime status
- Scan 1:1 + print AWB
- Batch print ≤ N ใบ + undo toast + reprint
- Admin UI (batch limit per store)
- **Shopee เท่านั้น** — 1 store ทดสอบ → เพิ่ม stores อื่นหลัง go-live

### Deferred หลัง Go-Live (สัปดาห์ 4+)
⏸ ไม่ทำใน 3 สัปดาห์นี้:
- Lazada adapter (เพิ่มหลัง go-live สัปดาห์ 4)
- 20 stores ทั้งหมด (onboard ทีละชุด)
- Lock expiry cleanup cron
- Load test 600 orders (ทำหลัง Lazada พร้อม)
- Error boundaries ครบทุก edge case

> **เหตุผล:** Lazada adapter คือ ~8–10 ชั่วโมง ถ้าเอาออกจาก 3 สัปดาห์แรก
> จะมี buffer พอสำหรับ debug + printer test จริง ซึ่งเป็นจุดที่ unknown มากที่สุด

---

## สัปดาห์ที่ 1 — Foundation + First Print
**วันที่:** 28 มี.ค. – 3 เม.ย.  
**เป้าหมาย:** print AWB จริงได้ 1 ใบ จาก 1 Shopee store  
**Budget:** ~21 ชั่วโมง

### วัน 1–2 | Project Setup (6h)
```
TASK-001: Next.js scaffold + dependencies
TASK-002: Supabase client (server + browser)
TASK-003: Run migration 001_initial_schema.sql
```
**Codex prompt:**
```
Read AGENTS.md first. Complete TASK-001, TASK-002, and TASK-003 from tasks.md in order.
```
**Done when:** `npm run dev` ขึ้น, Supabase tables exist, login page render

---

### วัน 3 | Auth (3h)
```
TASK-004: Middleware + login page + /api/auth/login + logout
```
**Done when:** เข้า `/` โดยไม่ login → redirect `/login` → ใส่ password → เข้าได้

---

### วัน 4–5 | n8n Sync + Order List (6h)
```
TASK-005: Order list page (static, no realtime yet)
n8n: สร้าง workflow sync Shopee → Supabase (1 store)
```
**n8n workflow spec:**
- Schedule: ทุก 5 นาที
- GET orders จาก Shopee API (status: READY_TO_SHIP)
- Upsert เข้า `orders` table ผ่าน Supabase REST
- Map fields: `platform_order_id`, `buyer_name`, `items_json`, `barcode_value`

**Done when:** orders จาก Shopee ปรากฏใน order list จริง

---

### วัน 6–7 | Print Infrastructure + First AWB (6h)
```
TASK-007: /lib/print.ts (ZPL TCP socket)
TASK-008: Shopee adapter only (lazada.ts = stub ที่ throw "not implemented")
TASK-009: /api/awb/single
```
**Physical tests (ต้องทำก่อนเดิน):**
- [ ] `nc -zv PRINTER_IP 9100` — ยืนยัน port เปิด
- [ ] ส่ง ZPL test string → เห็น label ออก printer
- [ ] Scan barcode จาก packing slip → ดู string format ที่ได้

**Done when:** scan barcode 1 ใบ → AWB print ออก thermal printer จริง

---

**Gate สัปดาห์ 1 ✅**
> print AWB จาก Shopee ได้ 1 ใบ จริงบน thermal printer จริง
> ถ้าผ่าน gate นี้ได้ → สัปดาห์ 2–3 เป็น UI work ที่ predictable กว่ามาก
> ถ้าไม่ผ่าน → หยุด debug printer/API ก่อน ไม่เดินหน้า

---

## สัปดาห์ที่ 2 — Scan Mode + Batch
**วันที่:** 4–10 เม.ย.  
**เป้าหมาย:** ทีม warehouse ใช้งานได้จริง (Shopee, 1 store)  
**Budget:** ~21 ชั่วโมง

### วัน 8–9 | Scan Mode UI (6h)
```
TASK-010: /app/(warehouse)/scan/page.tsx
```
- Auto-focus hidden input
- Scan → lookup → show order card → POST /api/awb/single
- Error states ครบ (not found, already printed, locked, printer offline)
- Keyboard: Enter = trigger, Escape = back

**Done when:** warehouse staff ทดสอบ scan จริงได้โดยไม่มี bug

---

### วัน 10–11 | Realtime + Batch API (6h)
```
TASK-006: Realtime order status (Supabase Realtime subscription)
TASK-011: /api/awb/batch
```
- Orders อัปเดต live ไม่ต้อง refresh
- Batch API: atomic lock → loop → per-order result

**Done when:** print 1 order ใน tab A → tab B status เปลี่ยนทันที

---

### วัน 12–13 | Batch UI (6h)
```
TASK-012: /app/(warehouse)/batch/page.tsx
```
- Checkbox อิสระ ≤ batch_limit
- Undo toast 2 วินาที
- Progress bar ทีละใบ
- Summary + reprint failed button

**Done when:** batch 5 orders → print ครบ → reprint failed ทำงานได้

---

### วัน 14 | Buffer + Bug Fix (3h)
- Fix bugs จากการทดสอบจริง
- ทดสอบ edge case: printer ดับระหว่าง batch, 2 sessions scan order เดียวกัน

---

**Gate สัปดาห์ 2 ✅**
> ทีม warehouse ใช้ scan + batch ได้จริง บน Shopee 1 store
> ไม่มี duplicate AWB เกิดขึ้น

---

## สัปดาห์ที่ 3 — Admin + Hardening + Go-Live
**วันที่:** 11–17 เม.ย.  
**เป้าหมาย:** production-ready, go-live ทุก Shopee stores  
**Budget:** ~21 ชั่วโมง

### วัน 15–16 | Admin UI (6h)
```
TASK-013: /app/admin/page.tsx — store list + batch_limit edit
TASK-014: Password change
```
**Done when:** แก้ batch_limit store ใดก็ได้ผ่าน UI, เปลี่ยน password ได้

---

### วัน 17–18 | Onboard Shopee Stores (4h)
- เพิ่ม stores ที่เหลือใน Supabase (INSERT stores)
- ทดสอบ n8n sync ทุก store
- ยืนยัน batch_limit ของแต่ละ store

**Done when:** orders จากทุก Shopee stores sync เข้า dashboard

---

### วัน 19 | Error Handling + Loading States (3h)
```
TASK-015 (partial): error.tsx + loading.tsx ในทุก route
```
- ไม่ต้องครบ 100% — focus แค่ scan mode และ batch (critical path)

---

### วัน 20 | Pre-Launch Testing (4h)
**Checklist:**
- [ ] Scan 10 orders ต่อเนื่อง ไม่มี error
- [ ] Batch 20 orders — ไม่มี duplicate
- [ ] Simulate printer offline ระหว่าง batch — reprint ทำงาน
- [ ] 2 browser tab scan order เดียวกันพร้อมกัน — tab 2 เห็น "locked"
- [ ] เปลี่ยน password — login ด้วย password เก่าไม่ได้
- [ ] Vercel deploy ด้วย production env vars

---

### วัน 21 | Go-Live 🚀 (4h)
- Deploy to Vercel production
- ตั้ง custom domain (ถ้ามี)
- Monitor first day: เช็ค print_log, เช็ค error ใน Vercel logs
- Brief ทีม warehouse

**Gate สัปดาห์ 3 ✅ = Go-Live**

---

## สัปดาห์ที่ 4+ — Post Go-Live
**หลัง 18 เม.ย. — ก่อน campaign**

| Priority | Task | Estimate |
|---|---|---|
| P0 | Lazada adapter + n8n Lazada workflow | 8–10h |
| P0 | Onboard Lazada stores (ทีละชุด) | 3h |
| P1 | Lock expiry cleanup cron (TASK-016) | 1h |
| P1 | Load test 600 orders/วัน (TASK-017) | 4h |
| P2 | Error boundaries ครบทุก edge | 4h |
| P3 | Analytics dashboard | defer |

---

## Timeline Summary

```
สัปดาห์ 1 (28 มี.ค.–3 เม.ย.)
├── Day 1–2:  Project setup + Supabase
├── Day 3:    Auth middleware + login
├── Day 4–5:  n8n sync + order list
└── Day 6–7:  Print infra + first AWB ← GATE

สัปดาห์ 2 (4–10 เม.ย.)
├── Day 8–9:  Scan mode UI
├── Day 10–11: Realtime + batch API
├── Day 12–13: Batch UI
└── Day 14:   Buffer + bugs ← GATE

สัปดาห์ 3 (11–18 เม.ย.)
├── Day 15–16: Admin UI
├── Day 17–18: Onboard Shopee stores
├── Day 19:   Error handling
├── Day 20:   Pre-launch testing
└── Day 21:   🚀 GO-LIVE ← GATE

สัปดาห์ 4+ (หลัง 18 เม.ย.)
├── Lazada adapter
├── Load test
└── ก่อน campaign ✅
```

---

## Risk & Contingency

| Risk | Probability | Plan B |
|---|---|---|
| Printer TCP integration ใช้เวลานาน | สูง | ทดสอบ Day 6 ก่อน — ถ้าเกิน 1 วัน cut Admin UI ออกไป Phase 2 |
| Shopee AWB API format แปลก | กลาง | ทดสอบ sandbox ก่อน — มี 2 วัน buffer |
| n8n sync barcode format ไม่ตรง | กลาง | ทดสอบ Day 4 — แก้ mapping ใน n8n ไม่แตะ code |
| Vercel latency > 500ms สำหรับ scan | ต่ำ | ยังไม่แก้ — monitor หลัง go-live |
| ใช้เวลาเกิน budget วันใดวันหนึ่ง | กลาง | ใช้ buffer วัน 14 ก่อน — ถ้าหมด ตัด Admin UI |

---

## Daily Codex Workflow

ทุกวันที่เปิด Codex ใช้ prompt นี้เป็น template:

```
Context: Read AGENTS.md and PRD.md first.
Today's task: [TASK-XXX] from tasks.md
Current state: [อธิบายสั้นๆ ว่าทำถึงไหนแล้ว]
Goal: [done criteria จาก tasks.md]
Do NOT change files outside the scope of this task.
```

หลังทำเสร็จแต่ละ task:
```
git add -A && git commit -m "feat: TASK-XXX — [task name]"
```

---

## Done Criteria สำหรับ Go-Live

ก่อน go-live ต้องผ่านทั้ง 6 ข้อ:

- [ ] Scan 1 order → AWB print ออก thermal printer ภายใน 10 วินาที
- [ ] Scan order ที่ print แล้ว → เห็น alert "already printed" ไม่ print ซ้ำ
- [ ] Batch 20 orders → print ครบ ไม่มี duplicate ใน print_log
- [ ] 2 sessions scan order เดียวกันพร้อมกัน → session ที่ 2 เห็น error ทันที
- [ ] แก้ batch_limit ผ่าน Admin UI → limit เปลี่ยนทันทีใน batch page
- [ ] Vercel production deploy สำเร็จ → ทีม warehouse login ได้
