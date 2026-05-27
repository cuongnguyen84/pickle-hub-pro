# Sprint A — Vietnam Rankings + Social DUPR — Test Guide

**Date:** 2026-05-27
**Branch:** `feat/dupr-vietnam-rankings`
**Author:** Claude (Cowork session)

---

## 0. TL;DR

Sprint A đã ship 4 thay đổi UI + 2 RPC migrations + 1 SSR upgrade. Cần Cuong:

1. **Xóa stale git locks + commit + push** (Section 1)
2. **Apply 2 migrations** lên Supabase production (Section 2)
3. **Test UI** trên CF preview URL theo từng surface (Section 3)
4. **Verify SEO/SSR** với Googlebot curl (Section 4)

Toàn bộ tổng ~30 phút manual work.

---

## 1. Commit + push (anh chạy trên máy local)

Sandbox của em không xóa được `.git/HEAD.lock` và `.git/index.lock` (read-only mount). Anh chạy trên Terminal trong project root:

```sh
cd ~/pickle-hub-pro

# 1. Xóa stale lock files (từ May 24)
rm -f .git/HEAD.lock .git/index.lock

# 2. Tạo feature branch
git checkout -b feat/dupr-vietnam-rankings

# 3. Stage ONLY các file của Sprint A (KHÔNG add các file pending khác của anh)
git add \
  supabase/migrations/20260528010000_dupr_leaderboard_vietnam_rpc.sql \
  supabase/migrations/20260528020000_dupr_players_near_rating_rpc.sql \
  src/content/dupr-rankings.ts \
  src/hooks/dupr/useVietnamRankings.ts \
  src/hooks/dupr/usePlayersNearRating.ts \
  src/pages/Rankings.tsx \
  src/components/dupr/DuprChip.tsx \
  src/components/social/PlayersNearRating.tsx \
  src/lib/dupr/staleness.ts \
  src/pages/PlayerProfile.tsx \
  functions/_lib/render/index.ts \
  functions/_middleware.ts \
  docs/dupr-integration-roadmap.md \
  docs/dupr-sprint-a-test-guide.md

# 4. Verify staged đúng
git status --short

# 5. Commit
git commit -m "feat(dupr): Sprint A — Vietnam Rankings + PlayersNearRating + DuprChip

- supabase: add dupr_leaderboard_vietnam + dupr_players_near_rating RPCs
- content: extend DuprScope union with vietnam, add singles/doubles formats
- hooks: useVietnamRankings + usePlayersNearRating (React Query)
- pages/Rankings: branch on scope, render VietnamRankingsTable when vietnam
- components: DuprChip (reusable rating pill) + PlayersNearRating widget
- pages/PlayerProfile: mount PlayersNearRating between chart and history
- functions/_lib/render: renderRankings async, fetch top-25 + ItemList JSON-LD
- functions/_middleware: pass supabase to renderRankings

Skipped from original Sprint A scope:
- A1-A5 (privacy migration + opt-in toggle + onboarding username pick)
  - reason: needs production backfill query first, separate PR
- A13 (FeedBlog/News DUPR chip)
  - reason: these cards have no author DUPR data field
- A15-A16 (coverage SQL + blog post)
  - reason: separate operational tasks

DoD met: Rankings.tsx renders Vietnam scope with live data, PlayerProfile
shows nearby-rating sidebar, both tsc and lint clean."

# 6. Push
git push -u origin feat/dupr-vietnam-rankings
```

Sau khi push, Cloudflare Pages sẽ deploy preview URL trong vòng 2-3 phút. URL format: `https://feat-dupr-vietnam-rankings.pickle-hub-pro.pages.dev`.

---

## 2. Apply migrations (anh chạy trên Supabase Dashboard hoặc CLI)

**Migrations cần apply trước khi test UI** — nếu không có RPC, Rankings vietnam scope sẽ hiện loading mãi mãi (UI hook fail silently).

### Option A — Supabase CLI (nhanh hơn nếu anh đã login)

```sh
cd ~/pickle-hub-pro
supabase db push --project-ref ajvlcamxemgbxduhiqrl
```

### Option B — Dashboard SQL Editor (chắc chắn nhất)

1. Mở https://supabase.com/dashboard/project/ajvlcamxemgbxduhiqrl/sql
2. New Query → paste nội dung file `supabase/migrations/20260528010000_dupr_leaderboard_vietnam_rpc.sql` → Run
3. Verify success: `SELECT * FROM dupr_leaderboard_vietnam('doubles', 5);` → trả về tối đa 5 rows (có thể empty nếu chưa có ai VN connect DUPR)
4. New Query → paste `supabase/migrations/20260528020000_dupr_players_near_rating_rpc.sql` → Run
5. Verify: `SELECT * FROM dupr_players_near_rating(4.0, 0.3, NULL, 5);` → trả về tối đa 5 rows

### Verify coverage (optional — biết trước data sẽ trống/đầy):

```sql
-- Total VN profiles connected to DUPR
SELECT COUNT(*) AS total_vn_with_dupr
FROM profiles
WHERE is_ghost = false
  AND onboarding_completed_at IS NOT NULL
  AND username IS NOT NULL
  AND (country_code = 'VN' OR country ILIKE '%viet%' OR (country_code IS NULL AND country IS NULL))
  AND dupr_doubles IS NOT NULL;

-- Top 5 by doubles
SELECT username, display_name, city, dupr_doubles, dupr_synced_at
FROM profiles
WHERE is_ghost = false
  AND onboarding_completed_at IS NOT NULL
  AND username IS NOT NULL
  AND (country_code = 'VN' OR country ILIKE '%viet%' OR (country_code IS NULL AND country IS NULL))
  AND dupr_doubles IS NOT NULL
ORDER BY dupr_doubles DESC NULLS LAST
LIMIT 5;
```

Nếu kết quả < 5 → leaderboard sẽ có empty state với CTA "Hãy là người đầu tiên" — đúng theo spec.

---

## 3. Test UI step-by-step (CF preview URL)

URL preview: `https://feat-dupr-vietnam-rankings.pickle-hub-pro.pages.dev`

### 3.1 Vietnam Rankings — primary feature

**Step 1.** Mở `/vi/rankings`. Expected:
- Hero text vẫn nguyên ("Ai đang đứng top...")
- Scope chooser có **3 rows**: "QUỐC GIA" (mới), "TOÀN CẦU", "CHÂU LỤC"
- Row "QUỐC GIA" có 1 button **"Việt Nam"** đang active mặc định
- Format tabs hiện **2 nút**: "Đôi" và "Đơn" (không phải 4)

**Step 2.** Quan sát table:
- Cột: # | Vận động viên | Thành phố | DUPR
- Nếu có data: tên VĐV là link đến `/nguoi-choi/:username`
- Nếu DUPR sync > 30 ngày: bên cạnh số rating có ký hiệu **◐** (stale)
- Nếu empty: "Chưa có VĐV Việt Nam nào kết nối DUPR công khai. Hãy là người đầu tiên..."

**Step 3.** Click sang "Đơn" tab — table refresh sang dupr_singles ranking.

**Step 4.** Click sang scope "Mở rộng" (group TOÀN CẦU). Expected:
- Format tabs đổi về **4 nút** cũ: Đơn nam / Đơn nữ / Đôi nam / Đôi nữ
- Table render từ static data (Ben Johns top doubles, vv) — KHÔNG đụng RPC
- Cột Tuổi xuất hiện trở lại (chỉ có ở static scope)

**Step 5.** Click lại "Việt Nam" — UI switch nhanh, không có flash.

**Step 6.** Test attribution copy phía dưới — phải hiện disclaimer riêng cho vietnam ("Đọc trực tiếp từ profile VĐV đã kết nối DUPR và bật chế độ công khai..."), khác với disclaimer global ("Snapshot từ dupr.com/rankings...").

### 3.2 PlayersNearRating widget — PlayerProfile

**Step 1.** Mở `/nguoi-choi/<username>` của 1 player **có DUPR doubles**. Ví dụ anh có thể vào profile của chính anh.

**Step 2.** Scroll xuống dưới DuprRatingChart. Expected:
- Có panel mới `<aside>` với heading "**CÙNG TẦM DUPR**"
- Subhead bên phải: `±0.3 · <rating của player>`
- Danh sách 1-8 players gần rating
- Mỗi row: avatar (hoặc letter circle) | tên + city | DuprChip + `Δ +0.15` diff

**Step 3.** Click 1 row — chuyển sang `/nguoi-choi/<username>` của người đó.

**Step 4.** Mở profile của player **KHÔNG có DUPR** (vd player chưa connect). Expected: panel "Cùng tầm DUPR" KHÔNG hiện ra (hidden gracefully).

**Step 5.** Mở profile có DUPR nhưng không có ai gần rating (rare). Expected: empty state "Chưa có ai cùng tầm. Mời bạn bè lên ThePickleHub..."

### 3.3 DuprChip — visual smoke test

DuprChip dùng trong PlayersNearRating + Rankings vietnam scope. Verify:
- Pill xanh lá, border `rgba(34,197,94,0.4)`, font Geist Mono
- Text "DUPR 4.32" (số có `tabular-nums` — không nhảy ngang khi rating đổi)
- Stale rating (`◐` mờ bên phải) chỉ hiện khi `dupr_synced_at` > 30 ngày
- Tooltip hover: "DUPR đôi 4.32" / "Not synced in 30 days"

---

## 4. Verify SEO / SSR (Googlebot)

Production sau khi merge — anh chạy:

```sh
# Vietnam rankings — bot view
curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" \
  "https://www.thepicklehub.net/vi/rankings" | grep -E "ItemList|nguoi-choi" | head -5
```

Expected output:
- `<script type="application/ld+json">{...,"@type":"ItemList",...,"itemListElement":[...]}</script>` — JSON-LD ItemList có
- Mỗi item URL `https://www.thepicklehub.net/nguoi-choi/<username>` — internal linking đến player profile
- Title tag: "Bảng xếp hạng DUPR Pickleball Việt Nam | ThePickleHub"

**Test Rich Results Tool** (sau khi merge prod):
1. https://search.google.com/test/rich-results
2. Paste `https://www.thepicklehub.net/vi/rankings`
3. Verify "Detected items" → "ItemList" → "Valid"

**Request indexing** (sau khi merge prod):
1. GSC URL Inspection → paste `https://www.thepicklehub.net/vi/rankings`
2. "Request Indexing"
3. Tương tự cho EN: `https://www.thepicklehub.net/rankings`

---

## 5. Rollback plan

Nếu phát hiện bug sau merge prod:

### Rollback code
```sh
git revert <merge-commit-sha>
git push origin main
# CF auto-deploys revert
```

### Rollback migration (RPC drop)
```sql
-- chạy trong Supabase SQL Editor
DROP FUNCTION IF EXISTS public.dupr_leaderboard_vietnam(TEXT, INT);
DROP FUNCTION IF EXISTS public.dupr_players_near_rating(NUMERIC, NUMERIC, UUID, INT);
DROP INDEX IF EXISTS idx_profiles_vn_dupr_doubles;
DROP INDEX IF EXISTS idx_profiles_vn_dupr_singles;
```

Hoặc giữ RPC nhưng revert UI — RPC không break gì khi không có caller.

---

## 6. Tasks còn lại của Sprint A (chưa làm, document để track)

| # | Task | Reason hoãn |
|---|---|---|
| A1 | Migration `profiles.is_public_profile` + backfill `true` cho onboarded users | Cần Cuong chạy backfill query trên production DB trước — em không có write access. Sau khi backfill OK, tạo PR riêng wire `is_public_profile = true` filter vào RPC + SSR. |
| A2 | Filter `is_public_profile` vào usePlayerProfile + renderPlayer | Phụ thuộc A1 |
| A3 | Account page opt-in toggle | Phụ thuộc A1 |
| A4 | sitemap-players re-enable + filter | Phụ thuộc A1 (nếu re-enable trước migration, sitemap emit cả profile riêng tư) |
| A5 | Onboarding username pick (thay auto-generate) | Standalone change — có thể làm trong sprint A.5 riêng |
| A13 | DUPR chip cho FeedBlog/News | KHÔNG khả thi v1 — blog static không có author, news scrape không có DUPR |
| A15 | Pre-flight coverage SQL | Em đã viết query trong Section 2.3 trên — anh chạy 1 lần là xong |
| A16 | Blog post bilingual announce | Sau khi data có ít nhất 20 VN players để screenshot |

Sprint B (Bracket DUPR seeding) và Sprint C (RR Mexicano DUPR balance) chưa start.

---

## 7. Questions cho Cuong sau khi test

1. Vietnam scope mặc định OK chứ? Hay anh muốn default về "Mở rộng" cho user EN?
2. PlayersNearRating window ±0.3 OK chứ? Anh muốn cho user adjust (0.2/0.3/0.5)?
3. DuprChip size mặc định là `xs` (11px) — anh thấy đủ rõ trên mobile chưa?
4. Bao giờ anh muốn start A1-A5 (privacy migration)? Em recommend tuần sau, sau khi anh review Vietnam Rankings có user thực sự.
5. Sprint B (Bracket DUPR seeding) — start ngay sau A merge, hay đợi data Sprint A có traction?
