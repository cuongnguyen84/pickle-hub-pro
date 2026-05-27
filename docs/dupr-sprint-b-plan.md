# Sprint B — DUPR cho Quick Tables (Bracket + Round-Robin)

**Date:** 2026-05-27
**Status:** Plan — chờ Cuong review trước khi code

---

## Quyết định scope (Cuong yêu cầu)

Khi tạo bracket / quick_tables, organizer có thêm 2 lựa chọn:
1. **Yêu cầu DUPR rating** (vs skill level tự kê khai như hiện tại)
2. **Giới hạn DUPR min/max** (vd: 3.5 ≤ DUPR ≤ 4.5)

Em chia thành **2 tracks song song**:
- **Track 1 — DUPR Enforcement** (anh yêu cầu chính)
- **Track 2 — Auto-seed Bracket** (em đề xuất bổ sung, gốc trong roadmap Sprint B)

---

## Audit state hiện tại

### Đã có (schema + hook)

```
quick_tables.requires_skill_level   BOOLEAN   ✅
quick_tables.min_skill_level        NUMERIC   ✅ (chưa wire UI)
quick_tables.max_skill_level        NUMERIC   ✅ (chưa wire UI)
quick_tables.skill_rating_system    TEXT      ✅ (chưa wire UI)

useQuickTable.createTable()  ✅ accept min_skill_level, max_skill_level params
                              ❌ caller (QuickTables.tsx line 163-171) không truyền
```

### Đã có (UI hiện tại)

- `QuickTables.tsx:506-520`: 1 checkbox **"Yêu cầu trình độ"** (skill level)
- `RegistrationForm.tsx:147-149`: user nhập tự do `skillLevel`, `skillSystemName`, `skillDescription`
- `RegistrationForm.tsx:277-278`: validation chỉ check field rỗng, KHÔNG check vs `table.min_skill_level`/`max_skill_level`

### Chưa có

1. UI input min/max DUPR khi tạo table
2. UI radio "Chọn nguồn rating": DUPR | Self-reported | Either
3. Registration form: auto-pull DUPR từ `profiles.dupr_doubles` nếu user đã SSO
4. Registration form: validate `min_skill_level ≤ user_dupr ≤ max_skill_level`
5. Public table page: banner "**DUPR Required: 3.5 – 4.5**"
6. Setup wizard: gợi ý min/max dựa trên DUPR của những registered players đầu tiên
7. Auto-seed bracket bằng DUPR (Sprint B roadmap gốc)

---

## Track 1 — DUPR Enforcement

### B1.1. Schema migration (5 min)

```sql
-- Migration: add explicit rating-source enum, dupr-required flag
ALTER TABLE quick_tables
  ADD COLUMN IF NOT EXISTS dupr_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS rating_source TEXT
    CHECK (rating_source IN ('self', 'dupr', 'either')) DEFAULT 'self';

-- Khi dupr_required = true, registration form chỉ accept user đã SSO DUPR
-- với rating trong [min_skill_level, max_skill_level].
```

**Question Cuong:** thay vì thêm `dupr_required` bool, em propose mỗi table có **`rating_source`** ENUM: `'self' | 'dupr' | 'either'`. Cuong OK enum hay anh prefer bool đơn giản?

### B1.2. UI input min/max DUPR + rating source (Tạo table — `QuickTables.tsx`)

Thêm vào "Advanced settings" hoặc inline khi `requires_skill_level=true`:

```
☑ Yêu cầu trình độ

  Nguồn rating:
  ○ Tự kê khai (default — hiện tại)
  ○ DUPR (bắt buộc kết nối DUPR)
  ○ Cả hai (user chọn)

  Giới hạn rating:
  [  3.0  ] ≤ DUPR ≤ [  4.5  ]
  (để trống = không giới hạn)
```

### B1.3. Hook `createTable` — pass min/max + rating_source

Wire `QuickTables.tsx` truyền 4 fields mới vào `createTable` (signature đã accept rồi, chỉ caller chưa truyền).

### B1.4. Registration form gate

`RegistrationForm.tsx`:
- Nếu `table.rating_source === 'dupr'` + user chưa SSO DUPR → show `<DuprConnectButton>` thay form input
- Nếu user đã SSO → **auto-fill `skillLevel = profile.dupr_doubles`**, disable input
- Nếu rating ngoài range → block submit với message "Yêu cầu DUPR 3.5-4.5, rating của bạn 5.2"
- Nếu `rating_source === 'either'` → cho user chọn DUPR auto-fill hoặc self-report

### B1.5. Public table page — banner

`/t/<share_id>` (QuickTableView) — banner trên đầu form đăng ký:
```
◆ Yêu cầu: DUPR 3.5 – 4.5
   Chỉ nhận VĐV đã kết nối DUPR với rating trong khoảng này.
```

### B1.6. Admin override

Organizer có thể manual-approve registration vượt range (vd: player friend chưa connect DUPR). Add admin notes flag `dupr_override: true` trong `quick_table_registrations`.

---

## Track 2 — Auto-seed Bracket bằng DUPR (Sprint B roadmap gốc)

### B2.1. Util `seedFromDupr.ts`

```ts
fetchDuprSeeds(userIds, 'doubles' | 'singles')
  → Map<userId, dupr_rating | null>

rankBySeed(players, seeds)
  → sort by DUPR desc, null → alphabetical fallback
```

### B2.2. `BracketSetupDialog.tsx` toggle

Thêm switch ngay khi mở dialog:
```
☑ Auto-seed by DUPR rating
   ─────────────────────────────
   ✓ 8/12 players have DUPR
   ✗ 4 players will be seeded alphabetical at the bottom
```

### B2.3. `<SeedExplainerCard>`

Sau khi auto-seed, hiển thị explanation:
```
Group A (4 players, avg DUPR 4.12):
  Seed 1: Erne King (5.57)
  Seed 8: Đỗ Hùng (4.00)
  Seed 9: Phạm Quang (3.50)
  Seed 16: Nguyễn Anh Vũ (3.37)
```

### B2.4. Re-seed flow

Sau khi roster đổi (player join/leave), button "Re-seed" → diff preview:
```
Player X moves Group A → Group B
Player Y moves Group B → Group A
[Confirm Re-seed] [Cancel]
```

### B2.5. Stale DUPR badge trong seed

Nếu `dupr_synced_at > 30 ngày`, badge `◐` next to seed number + warning banner "5 players have stale DUPR (>30d) — seeding may be inaccurate".

---

## Task list đề xuất (chia nhỏ để anh review)

### Track 1 — DUPR Enforcement (8 tasks, ~3-4h)

| # | Task | File | Risk |
|---|---|---|---|
| B1.1 | Migration: `dupr_required`, `rating_source` enum check | `supabase/migrations/20260528050000_quick_tables_dupr_required.sql` | Low |
| B1.2a | UI: rating source radio (self/dupr/either) trong QuickTables.tsx | `src/pages/QuickTables.tsx` | Med |
| B1.2b | UI: min/max DUPR input pair khi requires_skill_level=true | `src/pages/QuickTables.tsx` | Low |
| B1.3 | Wire createTable caller truyền 4 fields mới | `src/pages/QuickTables.tsx` + `src/hooks/useQuickTable.ts` | Low |
| B1.4a | RegistrationForm: auto-fill DUPR khi user đã SSO | `src/components/quicktable/RegistrationForm.tsx` | Med |
| B1.4b | RegistrationForm: validate rating ∈ [min, max] | `src/components/quicktable/RegistrationForm.tsx` | Med |
| B1.5 | Public table page banner "Requires DUPR 3.5-4.5" | `src/pages/QuickTableView.tsx` | Low |
| B1.6 | Admin override toggle khi approve registration ngoài range | `src/components/quicktable/RegistrationManager.tsx` | Med |

**DoD Track 1:** organizer tạo table chọn `rating_source=dupr` + min=3.5/max=4.5 → user 5.2 DUPR bị block với message rõ ràng, user 4.0 DUPR được auto-fill + approve nhanh.

### Track 2 — Auto-seed Bracket (5 tasks, ~2-3h)

| # | Task | File | Risk |
|---|---|---|---|
| B2.1 | Util `seedFromDupr.ts` + tests | `src/lib/dupr/seedFromDupr.ts` | Low |
| B2.2 | `BracketSetupDialog` toggle "Auto-seed by DUPR" | `src/components/quicktable/BracketSetupDialog.tsx` | Med |
| B2.3 | Component `<SeedExplainerCard>` | `src/components/dupr/SeedExplainerCard.tsx` | Low |
| B2.4 | Re-seed flow với diff preview | `src/components/dupr/ReseedDialog.tsx` | Med |
| B2.5 | Stale DUPR badge integration | `src/components/quicktable/BracketSetupDialog.tsx` (reuse `<DuprChip>`) | Low |

**DoD Track 2:** organizer 16-player table click "Auto-seed by DUPR" → snake distribution chính xác theo rating, coverage banner + stale warning hiển thị, re-seed flow hoạt động.

---

## Em recommend thứ tự build

**Phase 1 (Track 1 — high user value):** B1.1 → B1.3 → B1.4 → B1.5 → B1.2 → B1.6
- Ship enforcement trước: ngay khi user thấy "DUPR 3.5-4.5" thì cộng đồng sẽ self-select
- B1.2 (UI input) ship cuối vì còn organizer tạo manual qua admin được

**Phase 2 (Track 2 — value cho organizer):** B2.1 → B2.2 → B2.3 → B2.5 → B2.4
- Auto-seed core trước (util + dialog toggle), explainer + stale sau, re-seed flow cuối

---

## Câu hỏi Cuong cần chốt trước khi code

1. **`rating_source` enum vs `dupr_required` bool?** Em recommend ENUM 3 giá trị (self/dupr/either) — flexibility cho organizer, vẫn dùng 1 column.

2. **Track scope?** Build cả 2 tracks hay chỉ Track 1 (anh yêu cầu) trước?

3. **Min/max defaults?** Khi organizer bật `rating_source=dupr` mà không nhập min/max, default là:
   - Option a: Không giới hạn (NULL/NULL — accept mọi DUPR)
   - Option b: Suggest range ±0.5 quanh organizer's DUPR
   - Option c: Buộc nhập ít nhất 1 trong 2

4. **Self-reported flow khi `rating_source=dupr`?** User chưa SSO DUPR và muốn đăng ký:
   - Option a: Block hoàn toàn — show `<DuprConnectButton>`
   - Option b: Cho phép manual entry, mark `pending_dupr_verify`, organizer review tay

5. **`requires_skill_level` legacy field giữ hay drop?** Em propose:
   - Giữ cho backward compat
   - Mới: `rating_source ≠ 'self'` implies `requires_skill_level=true`
   - Migration auto-set `rating_source='self'` cho tất cả existing tables (giữ behavior hiện tại)

6. **Bracket auto-seed dùng singles hay doubles DUPR?** Em recommend: dựa vào `is_doubles` field của table.
