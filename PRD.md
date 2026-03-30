# Product Requirements Document
# Unified AWB Platform

**Version:** 1.0  
**Status:** Approved — Ready for Development  
**Last Updated:** 2026-03-28  
**Author:** Product & Engineering  

---

## Table of Contents

1. [Overview](#1-overview)
2. [Problem Statement](#2-problem-statement)
3. [Goals & Success Metrics](#3-goals--success-metrics)
4. [Users & Context](#4-users--context)
5. [Functional Requirements](#5-functional-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [System Architecture](#7-system-architecture)
8. [Data Model](#8-data-model)
9. [Feature Specifications](#9-feature-specifications)
10. [Out of Scope](#10-out-of-scope)
11. [Risks & Mitigations](#11-risks--mitigations)
12. [Delivery Phases](#12-delivery-phases)
13. [Open Questions](#13-open-questions)
14. [Decision Log](#14-decision-log)

---

## 1. Overview

Unified AWB Platform คือ web dashboard สำหรับทีม warehouse ที่ใช้จัดการและพิมพ์ใบ AWB (shipping label) จาก 20 ร้านค้าบน Shopee และ Lazada ในที่เดียว โดยไม่ต้องสลับไปมาระหว่าง platform tabs

**Core value proposition:** scan barcode → print AWB → เสร็จ ภายใน 5 วินาที

---

## 2. Problem Statement

### สถานการณ์ปัจจุบัน

ทีม fulfillment ต้องเปิดหลาย browser tab (Shopee Seller Center + Lazada Seller Center × 20 ร้านค้า) เพื่อพิมพ์ AWB ทีละใบ

| ปัญหา | ผลกระทบ |
|---|---|
| สลับ tab บ่อย ใช้เวลานาน | throughput ต่ำ |
| ไม่มี duplicate check | AWB print ซ้ำ → ค่าส่งเกิน, platform error |
| ไม่มี audit trail | ไม่รู้ว่าใครพิมพ์อะไร เมื่อไหร่ |
| Campaign peak 600 orders/วัน | ทีมรับไม่ไหว เกิด error มาก |

### ขนาดปัญหา

- 20 stores × 2 platforms = 40 accounts
- 300 orders/วัน ปกติ, 600 orders/วัน campaign
- เป้าหมาย: < 10 วินาทีต่อ order (จาก ~2–3 นาที)

---

## 3. Goals & Success Metrics

### Goals

1. รวม order feed จากทุก store/platform ให้เห็นในหน้าเดียว
2. ลดเวลา print AWB ต่อ order จาก ~2 นาที เหลือ < 10 วินาที
3. ขจัด duplicate AWB print ให้เป็น 0
4. รองรับ 600 orders/วัน โดยไม่มีระบบหยุดทำงาน

### Success Metrics (วัดหลัง go-live 2 สัปดาห์)

| Metric | Target |
|---|---|
| เวลา scan → print สำเร็จ | < 5 วินาที (p95) |
| Duplicate AWB ต่อวัน | 0 |
| Print failure rate | < 1% |
| System uptime ช่วง campaign | ≥ 99.5% |
| Staff adoption | 100% ใช้ผ่าน dashboard |

---

## 4. Users & Context

### Primary User: Warehouse Staff

- ใช้ PC/laptop ใน warehouse
- ถือ USB barcode scanner
- ทำงานเร็ว มือไม่ว่าง — UI ต้องรองรับ keyboard-first
- ใช้พร้อมกัน 2–3 คน

### Secondary User: Admin / Supervisor

- คนเดียวกับ dev (single-person team)
- config batch limit per store
- ดู print history / audit log

### Environment

- เครือข่าย LAN ใน warehouse
- Thermal label printer (Zebra/Godex/TSC) ต่อ LAN IP fixed
- USB barcode scanner → string + Enter เข้า browser
- Internet connection สำหรับ Supabase + platform API

---

## 5. Functional Requirements

### FR-001: Order Aggregation

| # | Requirement | Priority |
|---|---|---|
| FR-001-1 | แสดง orders จากทุก store/platform ในหน้าเดียว | P0 |
| FR-001-2 | Filter by: store, platform, awb_status, วันที่ | P0 |
| FR-001-3 | Default filter: วันนี้ + status=pending | P0 |
| FR-001-4 | Paginate 50 orders ต่อหน้า | P0 |
| FR-001-5 | Columns: order ID, store, buyer, items, status, เวลา | P0 |
| FR-001-6 | Status badge: pending=เหลือง, printing=น้ำเงิน, printed=เขียว, failed=แดง | P0 |
| FR-001-7 | Order status อัปเดต realtime ไม่ต้อง refresh | P1 |

### FR-002: Scan-to-Print (1:1 Mode)

| # | Requirement | Priority |
|---|---|---|
| FR-002-1 | Scan mode มี hidden input auto-focus รับ barcode scanner | P0 |
| FR-002-2 | Scan barcode → lookup order → แสดง order details | P0 |
| FR-002-3 | Enter trigger → เริ่ม print ทันที | P0 |
| FR-002-4 | Already printed → alert + AWB number เดิม | P0 |
| FR-002-5 | Locked by another session → alert ชัดเจน | P0 |
| FR-002-6 | Success → flash เขียว + AWB number + ready for next scan | P0 |
| FR-002-7 | Failed → flash แดง + error + retry button | P0 |
| FR-002-8 | Escape → กลับ order list | P0 |

### FR-003: Batch Print Mode

| # | Requirement | Priority |
|---|---|---|
| FR-003-1 | เลือก orders ด้วย checkbox — อิสระ ไม่มี SKU filter | P0 |
| FR-003-2 | สูงสุด = `stores.batch_limit` ของ store นั้น (default 20) | P0 |
| FR-003-3 | Counter "N / max เลือกแล้ว" | P0 |
| FR-003-4 | เลือกได้เฉพาะ orders status = pending | P0 |
| FR-003-5 | กด "Batch Print" → Toast countdown 2 วินาที + Undo button | P0 |
| FR-003-6 | กด Undo → ยกเลิกทันที | P0 |
| FR-003-7 | หลัง 2s → lock ทั้ง batch → loop print ทีละใบ | P0 |
| FR-003-8 | Progress bar ระหว่าง batch | P0 |
| FR-003-9 | Summary หลังจบ: ✅ N printed / ❌ K failed | P0 |
| FR-003-10 | Reprint Failed button → ส่ง failed IDs กลับ batch flow | P0 |
| FR-003-11 | Lock fail บางตัว → skip + mark failed, ไม่ abort batch | P0 |

### FR-004: Admin UI

| # | Requirement | Priority |
|---|---|---|
| FR-004-1 | /admin แสดง store list: ชื่อ, platform, shop_id, batch_limit, is_active | P0 |
| FR-004-2 | แก้ batch_limit per store (min=1, max=50) | P0 |
| FR-004-3 | Toggle is_active per store | P0 |
| FR-004-4 | เปลี่ยน app password | P0 |

### FR-005: Authentication

| # | Requirement | Priority |
|---|---|---|
| FR-005-1 | /login รับ password เดียว ใช้ได้ทั้ง app | P0 |
| FR-005-2 | Password เก็บเป็น bcrypt hash ใน app_config | P0 |
| FR-005-3 | Session = JWT httpOnly cookie (24h) | P0 |
| FR-005-4 | ทุก route ยกเว้น /login ต้อง authenticate | P0 |
| FR-005-5 | ไม่มี role system — ทุกคนที่ login มี access เท่ากัน | P0 |

### FR-006: Print Infrastructure

| # | Requirement | Priority |
|---|---|---|
| FR-006-1 | ZPL raw TCP socket port 9100 → PRINTER_HOST | P0 |
| FR-006-2 | แปลง PDF → ZPL ผ่าน Labelary API | P0 |
| FR-006-3 | Printer offline → error ชัด + ไม่ mark order ว่า printed | P0 |
| FR-006-4 | Lock expiry 120 วินาที | P0 |
| FR-006-5 | Cron ลบ expired locks ทุก 5 นาที | P1 |

---

## 6. Non-Functional Requirements

### Performance

| Requirement | Target |
|---|---|
| Scan → AWB API response | < 3 วินาที (p95) |
| ZPL print (TCP send) | < 1 วินาที |
| Order list load (50 rows) | < 1 วินาที |
| Batch 20 orders ทั้งหมด | < 90 วินาที |
| Concurrent users | ≥ 5 |

### Reliability

- ไม่มี data loss: print_log ทุก job ทั้งสำเร็จและไม่สำเร็จ
- Duplicate AWB = 0: lock บังคับก่อน call AWB API ทุกครั้ง
- Lock orphan: expire 120s + cron cleanup

### Security

- Password: bcrypt(10)
- Session: JWT httpOnly cookie
- Service role key: server-side เท่านั้น
- Platform token: ไม่เก็บใน browser

### Cost

- Infrastructure: $0/month (Vercel free + Supabase free)
- Labelary API: free

---

## 7. System Architecture

```
┌─────────────────────────────────────────────┐
│              EXTERNAL PLATFORMS              │
│         Shopee API       Lazada API          │
└──────────────┬──────────────┬───────────────┘
               │ poll 5 min   │
               ▼              ▼
┌─────────────────────────────────────────────┐
│           n8n (background sync only)         │
│   Order Sync Workflow  │  Status Webhook     │
└──────────────────┬──────────────────────────┘
                   │ INSERT orders
                   ▼
┌─────────────────────────────────────────────┐
│         Supabase Postgres + Realtime         │
│  stores│orders│order_locks│print_log│config  │
└─────────┬───────────────────────┬───────────┘
          │ read/write            │ realtime push
          ▼                       ▼
┌─────────────────────────────────────────────┐
│           Next.js App (Vercel)               │
│  /(warehouse)  /admin  /login  /api/*        │
└─────────────────────────┬───────────────────┘
                          │ ZPL via TCP :9100
                          ▼
               ┌─────────────────────┐
               │   Thermal Printer   │
               │   LAN, fixed IP     │
               └─────────────────────┘
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| n8n สำหรับ sync เท่านั้น | มีอยู่แล้ว, เพิ่ม platform ใหม่โดยไม่แตะ app code |
| Next.js สำหรับ scan/print | latency ต่ำ, AI codegen-friendly |
| Supabase Realtime | order status อัปเดต live |
| ZPL raw TCP | ไม่ต้อง print driver, latency ต่ำสุด |
| Single password auth | MVP team เดียว ไม่มี role complexity |

---

## 8. Data Model

### stores
| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| name | text | ชื่อร้านค้า |
| platform | text | 'shopee' \| 'lazada' |
| shop_id | text | ID จาก platform |
| access_token | text | OAuth token |
| refresh_token | text | |
| token_expiry | timestamptz | |
| batch_limit | integer | สูงสุดต่อ batch (default 20) |
| is_active | boolean | เปิด/ปิด sync |

### orders
| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| store_id | uuid FK | → stores |
| platform_order_id | text UNIQUE | order ID จาก platform |
| barcode_value | text | ค่าที่ได้จาก scan |
| buyer_name | text | |
| items_json | jsonb | รายการสินค้า |
| awb_status | text | pending\|printing\|printed\|failed |
| awb_number | text | |
| printed_at | timestamptz | |
| created_at | timestamptz | |

### order_locks
| Column | Type | Description |
|---|---|---|
| order_id | uuid PK FK | → orders |
| locked_by | text | session token หรือ batch_id |
| locked_at | timestamptz | |
| expires_at | timestamptz | now() + 120s |

### print_log
| Column | Type | Description |
|---|---|---|
| id | uuid PK | |
| order_id | uuid FK | → orders |
| batch_id | uuid | null สำหรับ 1:1 |
| awb_number | text | |
| mode | text | '1to1' \| 'batch' |
| batch_size | integer | |
| status | text | 'printed' \| 'failed' |
| error_msg | text | |
| printed_by | text | session identifier |
| printed_at | timestamptz | |

### app_config
| Column | Type | Description |
|---|---|---|
| key | text PK | |
| value | text | |

Default: `key='admin_password_hash'`, `value=bcrypt('changeme')`

---

## 9. Feature Specifications

### 9.1 Scan-to-Print Flow (1:1)

```
Scan barcode
    │
    ├─ NOT FOUND → alert "ไม่พบ order"
    ├─ status=printed → alert "พิมพ์แล้ว: AWB {number}"
    └─ status=pending
          │
          ▼
    INSERT order_locks ON CONFLICT DO NOTHING
          │
          ├─ 0 rows → alert "session อื่นกำลังพิมพ์"
          └─ 1 row → proceed
                │
                ▼
          generateAWB(order) → PDF + AWB number
          Labelary: PDF → ZPL
          printZPL via TCP :9100
                │
                ├─ ERROR → UPDATE failed, DELETE lock, INSERT print_log failed
                └─ SUCCESS → UPDATE printed, DELETE lock, INSERT print_log printed
                             flash เขียว + AWB number + auto-focus
```

### 9.2 Batch Print Flow

```
เลือก orders ≤ batch_limit (checkbox อิสระ, pending only)
กด "Batch Print"
    │
    ▼
Toast countdown 2s + [Undo]
    │
    ├─ กด Undo → ยกเลิก
    └─ หมด 2s
          │
          ▼
    Lock ทั้ง batch พร้อมกัน (atomic INSERT)
    บันทึก locked list vs failed-to-lock list
          │
          ▼
    สำหรับแต่ละ order ที่ lock สำเร็จ (sequential):
      generateAWB → Labelary → printZPL
      UPDATE order + INSERT print_log + DELETE lock
      อัปเดต progress bar
          │
          ▼
    Summary: ✅ N printed / ❌ K failed
    [Reprint Failed] → ส่ง failed IDs กลับ batch flow
```

### 9.3 Lock Mechanism (Critical)

```sql
-- Atomic lock — ตรวจ rowsAffected
INSERT INTO order_locks (order_id, locked_by, expires_at)
VALUES ($1, $2, now() + interval '120 seconds')
ON CONFLICT (order_id) DO NOTHING;
-- rowsAffected = 1 → lock สำเร็จ
-- rowsAffected = 0 → มี lock อยู่แล้ว → return error
```

Lock ต้อง release ทันทีหลัง print เสร็จหรือ error — ไม่รอ expire

### 9.4 Platform Adapter Interface

```typescript
interface PlatformAdapter {
  generateAWB(order: Order): Promise<{
    pdf: Buffer;
    awbNumber: string;
  }>;
}
```

เพิ่ม platform ใหม่: สร้าง `/lib/adapters/{platform}.ts` + register ใน `getAdapter()` + n8n workflow ใหม่ — ไม่ต้องแก้อะไรอื่น

---

## 10. Out of Scope (MVP)

| Feature | เหตุผล |
|---|---|
| Role-based access control | Single-user team |
| Inventory management | คนละ domain |
| Returns / refund flow | ต้องการ discovery เพิ่ม |
| Customer messaging | คนละ domain |
| Analytics dashboard | ดูจาก print_log โดยตรง |
| Mobile responsive | ใช้บน desktop เท่านั้น |
| Offline mode | Internet มีใน warehouse |

---

## 11. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| AWB print ซ้ำ | 🔴 High | Postgres atomic lock ทุก print path |
| Platform API ล่มระหว่าง campaign | 🔴 High | Retry + error message + manual fallback |
| API rate limit เกิน quota | 🟡 Medium | Cache orders ใน DB, monitor quota |
| PDF→ZPL conversion ล้มเหลว | 🟡 Medium | ทดสอบ label sample จริงก่อน go-live |
| Platform เปลี่ยน API spec | 🟡 Medium | Adapter pattern — แก้ file เดียว |
| Printer offline ระหว่าง batch | 🟢 Low | TCP check + per-order status + reprint |
| Misclick กด batch ไม่ทัน undo | 🟢 Low | Accepted — มี reprint button |

---

## 12. Delivery Phases

### Phase 1 — Foundation (Week 1–2)
- [ ] Next.js 14 scaffold + Tailwind
- [ ] Supabase schema migration
- [ ] Auth middleware + /login
- [ ] n8n Shopee sync (1 store)
- [ ] ทดสอบ barcode format จริง
- [ ] ทดสอบ TCP :9100 กับ printer จริง

**Gate:** orders sync เข้า DB + login ทำงาน

### Phase 2 — Order Dashboard (Week 2–3)
- [ ] Order list UI (filter, paginate, badge)
- [ ] Supabase Realtime subscription
- [ ] Row flash animation

**Gate:** ทีมเห็น orders realtime

### Phase 3 — Scan & Print 1:1 (Week 3–4)
- [ ] `/lib/print.ts` ZPL TCP
- [ ] Shopee AWB adapter
- [ ] `/api/awb/single` route
- [ ] Scan mode UI
- [ ] ทดสอบ print label จริง

**Gate:** scan → label ออกจาก printer

### Phase 4 — Batch Print (Week 5)
- [ ] Lazada AWB adapter
- [ ] `/api/awb/batch` route
- [ ] Batch UI: checkbox, undo toast, progress, summary
- [ ] Reprint failed button

**Gate:** batch 20 ใบ ไม่มี duplicate

### Phase 5 — Admin + Hardening (Week 6)
- [ ] Admin UI: store config, batch_limit, password change
- [ ] n8n workflows ครบ 20 stores × 2 platforms
- [ ] Error boundaries + loading states
- [ ] Cron cleanup expired locks
- [ ] Load test: 600 orders/วัน
- [ ] เปลี่ยน default password

**Gate:** go-live ready

---

## 13. Open Questions

| # | คำถาม | Owner | Deadline |
|---|---|---|---|
| OQ-001 | Barcode format จาก packing slip = string format ใด? | Dev | ก่อน TASK-010 |
| OQ-002 | Shopee AWB endpoint — `logistics/init` หรือ `logistics/getShipmentParameter`? | Dev | ก่อน TASK-008 |
| OQ-003 | Printer รองรับ ZPL หรือ TSPL? | Dev + Ops | ก่อน TASK-007 |
| OQ-004 | Hosting: Vercel cloud หรือ local server? | Dev + Ops | หลัง go-live 1 สัปดาห์ |
| OQ-005 | Token refresh — n8n จัดการ หรือ app จัดการ? | Dev | ก่อน TASK-008 |

---

## 14. Decision Log

| Date | Decision | Rationale | Alternatives |
|---|---|---|---|
| 2026-03-28 | Batch = free checkbox ไม่ใช่ same-SKU filter | SKU filter ไม่ match real workflow | SKU filter, store filter |
| 2026-03-28 | No confirm dialog | ลด friction high-volume workflow | Confirm dialog |
| 2026-03-28 | Safety = 2-second undo toast | เบา ไม่หยุด flow แต่กัน misclick | Confirm dialog, no safety |
| 2026-03-28 | Partial fail = skip + mark failed | ทำ order ได้มากที่สุด | Abort all |
| 2026-03-28 | Lock expiry = 120s | 20 × ~4s = ~80s worst case | 60s, 180s |
| 2026-03-28 | Admin UI ใน MVP (Week 6) | batch_limit ต้องปรับได้ก่อน go-live | Phase 2, env var |
| 2026-03-28 | Auth = single password ไม่มี role | Single-dev, single-user context | Supabase Auth + roles |
| 2026-03-28 | n8n = sync only | latency ~500–1500ms ไม่เหมาะ scan path | n8n ทั้งหมด |
| 2026-03-28 | Stack = Next.js 14 + Supabase + Vercel | AI codegen-friendly, free tier | FastAPI + React |

---

*PRD v1.0 — approved and frozen for MVP. การเปลี่ยนแปลง scope ต้องผ่าน decision log และ update version*
