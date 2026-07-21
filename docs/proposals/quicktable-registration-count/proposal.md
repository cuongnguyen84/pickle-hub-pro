# QuickTable registration count — social-proof badge trên /tournaments

> Slug: `quicktable-registration-count` · Ngày: `2026-07-21` · Trạng thái: `draft`
> Sinh bởi `/idea`. Panel: `solution-architect` · `ui-ux-critic` (+GPT-5.6) · `risk-auditor` (+GPT-5.6) · `pre-mortem`.
> Model thiếu key lần chạy này: `none` (cả 2 lần GPT-5.6 đều chạy).
>
> **Raw audit trail:** `round1/*.md` · `round2/*.json` · `external/*` (prompt+reply GPT-5.6 + `.meta.json`) · `debate.json`
> ⚠️ Harness gắn cờ security "data exfiltration" ở lần risk-auditor gọi GPT-5.6 — CỐ Ý (pipeline luôn pull cross-vendor), nhưng brief có mô tả lỗ RLS `team_match_teams`. Xem mục 6.

---

## 0. 🔶 Cần anh quyết

| # | Vấn đề | Phía A | Phía B | Chọn sai thì sao |
|---|--------|--------|--------|------------------|
| **D3** | **QuickTable có ĐỦ data để làm social proof không?** | **Làm cho QuickTable** như intake | **Chuyển team_match / đo trước**: `quick_table_registrations` nằm `pending` tới khi BTC duyệt tay + prod thưa → badge QuickTable **gần như không bao giờ hiện**. Data approved thật chỉ có ở `team_match_teams` (15 approved) | Ship xong badge vô hình trên QuickTable, tốn công 0 tác dụng, không ai biết vì thiếu telemetry |
| **D4** | Có kèm sửa pill "CHUẨN BỊ"→"Đang mở đăng ký"? | **Gộp**: không sửa thì chỗ-dựa-dưới-ngưỡng không tồn tại (mở đăng ký hiện pill gold "chưa mở") | **Tách**: badge ship độc lập | Gộp: +scope nhỏ. Tách: card mở đăng ký vẫn phát tín hiệu "chưa sẵn sàng" ngay cạnh badge |

> **Khuyến nghị của em cho D3:** không chọn A/B mù. **Ship + 1 dòng telemetry** (log khi badge *đáng lẽ* hiện ≥1 và *thật sự* hiện ≥ngưỡng), đo 1-2 tuần trên data thật rồi quyết QuickTable có đáng giữ badge không. team_match có data thật ngay → badge team_match có giá trị ngày đầu. Đây là đường pre-mortem chỉ ra để "ship xong vô tác dụng" từ tàng hình thành đo được.

---

## 1. Ý tưởng gốc

Follow-up **D1** từ proposal `codex-review-de-integrity`. `OpenRegistrationSection` là dead code (progress bar hard-code 25%, 0 render caller). Hiện SỐ ĐĂNG KÝ THẬT trên card giải QuickTable ở `/tournaments` list làm **social proof kéo đăng ký**. KHÔNG cap cứng, chỉ hiện số thật. Hiện cho cả anon.

| Hỏi | Trả lời (Cuong 2026-07-21) |
|---|---|
| Ai dùng | Người xem `/tournaments` (browse), ~95% VN mobile, cả anon |
| Đau ở đâu | Card hiện `player_count` = QUOTA (sức chứa lúc tạo), không phải đăng ký thật → không tạo momentum |
| Thành công = | **Social proof kéo đăng ký** (không phải chỉ-thông-tin) |
| Ràng buộc | Badge trên CARD ở list; song ngữ VI/EN; hiện cho anon |

---

## 2. Verdict — đọc trước

| | |
|---|---|
| **Rủi ro** | 🟡 **AMBER** (risk-tier tự động = AMBER, auditor giữ AMBER với 2 điều kiện chặn cứng) |
| **Khuyến nghị** | **Option A** — 1 query gộp + approved-only + split đơn/đôi; 0 migration → revert sạch |
| **Công sức** | **2 nửa ngày** (badge + split đơn/đôi + telemetry; +1 nửa ngày nếu gộp D4 pill) |
| **Rủi ro lớn nhất** | Badge có thể **vô hình** trên QuickTable (data pending/thưa) — đó chính là D3, phải đo bằng telemetry |
| **Auto-merge** | Được sau gate — **NHƯNG chỉ khi giữ 2 điều kiện**: (1) query có `.eq(status,approved)`; (2) 0 migration trong diff. Vi phạm → RED |

🔴 RED nghĩa: không revert được bằng `git revert`. Bản này client-only, 0 migration → **không RED, MIỄN LÀ** không lén thêm RPC/migration.

---

## 3. Đã có sẵn gì (recon)

**Prior art:** Card `/tournaments` đã render số qua `renderMeta` (`Tournaments.tsx:80-81,94,120`) NHƯNG là `player_count`/`team_count` = **cột QUOTA set lúc tạo** (CHECK `>=2`), không phải đăng ký thật. Pattern badge X/Y đã có ở `useUpcomingSocialEvents.ts:40-65` (fan-out `count:exact,head:true`) — **nhưng là N+1, KHÔNG lặp lại** (xem mục 6).

**Sẽ đụng:** `src/hooks/useTournamentData.ts` (hook open-reg/active), `src/pages/Tournaments.tsx` (badge trong renderMeta), `src/components/quicktable/OpenRegistrationSection.tsx` + `index.ts` (xóa dead code), `src/styles/the-line.css` (token badge). **0 migration.**

**Ràng buộc repo:**
- Doubles đăng ký ở bảng KHÁC: `quick_table_teams`/`team_status`, không phải `quick_table_registrations`/`status` (`useInteractionData.ts:117-141`, `RegisteredPlayersList.tsx:105-121`).
- `quick_table_registrations` INSERT luôn `pending` (`useRegistration.ts:123`); `approveRegistration` (`:213-217`) là **thủ công**; **0 consumer** của cờ `auto_approve_registrations` trong code/edge/migration → đơn nằm pending tới khi BTC duyệt tay.
- `team_match_teams` INSERT thẳng `approved` (`useTeamMatchTeams.ts:168`), bảng không có cờ auto_approve.
- SSR `renderTournaments` (`functions/_lib/render/tournaments.ts:75`) chỉ query bảng `tournaments`, KHÔNG render community-bracket card → badge client-only.
- 0 test coverage trên trang/hook/bảng này.

---

## 4. Phương án (solution-architect)

### Option A — 1 query gộp trên tập ongoing/open-reg (KHUYẾN NGHỊ)
Effort **~2 nửa ngày** · Files: `useTournamentData.ts`, `Tournaments.tsx`, xóa `OpenRegistrationSection.tsx`+`index.ts`, `the-line.css` · Data: **none (0 migration)**

Cách hoạt động (đã hợp nhất phản biện vòng 2):
- **1 truy vấn gộp** `quick_table_registrations?select=table_id&status=eq.approved&table_id=in.(ids)` cho MỌI id đang hiện, đếm client-side theo table_id. KHÔNG N+1 Promise.all. **Chỉ chạy trên ids list ongoing/open-reg**, KHÔNG gắn tab Ended/completed (limit 100).
- **Split đơn/đôi**: `is_doubles` → đếm `quick_table_teams` (`team_status='approved'`, tương đương 1 query gộp thứ 2); singles → `quick_table_registrations` (`status='approved'`).
- **approved-only** (không pending — xem D2 mục 7).
- Badge ẩn khi count < ngưỡng (đề xuất **4**, hằng số client 1 dòng, chỉnh sau khi đọc số prod).
- Thêm `staleTime: 30_000` vào hook (pattern gốc có, đừng đánh rơi).

Được: diff nhỏ, 0 migration/0 KB, anon OK, revert sạch. · Mất: chưa realtime (staleTime). · Đóng cửa: gần như không — list vượt ~vài trăm id thì nâng lên RPC = refactor 1 hook.

### Option B — RPC aggregate GROUP BY
Effort **+1 nửa ngày** · 1 migration SECURITY DEFINER trả `table_id,cnt` + regen types. Thắng khi list dài / muốn gộp team_match server-side. **Thua** vì thêm migration → **RED-tier** (không revert `git revert`), và query gộp client đã đủ cho quy mô hiện tại.

### Option C — Cột denormalized + trigger
Effort **3+ nửa ngày**. Counter column + trigger write-path. **Thua nặng**: trigger trên đường ghi đăng ký = counter drift + lost-update (DB-01/02), nợ vận hành cho 1 người trực. Loại.

### Khuyến nghị: **Option A**
B/C thêm migration = RED-tier + revert khó, giải bài toán scale chưa tồn tại. A ship client-only, revert 5 phút.

### Increments
1. Query gộp `registered_count` (split đơn/đôi, approved-only) vào hook — verify: test hook + `curl` anon count 1 bảng public trả đúng số approved.
2. Badge có ngưỡng + copy VI/EN ở `Tournaments.tsx` + telemetry 1 event — verify visual `/tournaments?tab=community&fmt=quick-tables`. **Điểm dừng nhìn lại:** đọc số approved prod chốt ngưỡng.
3. Xóa `OpenRegistrationSection.tsx`+export — verify `npm run build` + grep 0 ref.

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

### Tổng thể
Giá trị nằm ở **làm đúng dữ liệu**, không ở badge. Card hiện show quota tĩnh; thêm số thứ 2 cạnh nó là bẫy nhầm lẫn → phải **THAY** quota bằng count ở row đủ điều kiện, không hiện cả hai.

### Luồng
Entry `/tournaments?tab=community&fmt=quick-tables` (browse, ít hơn deep-link Facebook) → chọn giải → bracket → đăng ký. Badge sống đúng khoảnh khắc "chọn giải nào". Chỉ có nghĩa với bracket **đang mở đăng ký** (`requires_registration && status='setup'`); ad-hoc/đang chơi/đã xong gắn "đã đăng ký" = sai ngữ nghĩa.

### Vấn đề
| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| 1 | Blocker | Quota + count cạnh nhau = mơ hồ | THAY quota bằng count ở row đủ điều kiện, KHÔNG hiện cả hai |
| 2 | Blocker | Chỉ gắn nhãn cho `requires_registration && status='setup'` | Gate cứng |
| 3 | Blocker | Doubles đếm **đội** (`quick_table_teams`), singles đếm **người** — không trộn | Rẽ theo `is_doubles`, copy theo đơn vị |
| 4 | Blocker | N+1 per-card → CLS + 4G | 1 query gộp, count sẵn lúc render (→ mục 6) |
| 5 | Blocker (a11y) | Màu badge ≥4.5:1, axe #426 vừa bật | `--tl-fg-2 #c7c3bb` w600 hoặc `--tl-green`, tránh `--tl-blue` |
| 6 | Nên sửa | pill "CHUẨN BỊ" gold đọc như "chưa mở" (enum không có `registration`, types.ts:8655) | Override → blue "Đang mở đăng ký" (= **D4**) |
| 7 | Nên sửa | Ngưỡng chống phản-social-proof | Ẩn khi `<4` |
| 8 | Nên sửa | Badge không nổi hơn pill, gãy dòng 390px | Sau `Đơn/Đôi`, `flex:0 0 auto`, cắt "Round robin" trước |
| 9 | Nit | Icon Users thừa | Bỏ |

### Trạng thái màn hình
- **Empty:** `tl-empty` sẵn, không đổi.
- **Loading:** KHÔNG render `0 đã đăng ký`; count batch vào payload → có mặt khi render.
- **Error:** count fail → degrade im lặng (không badge). TUYỆT ĐỐI không show `0`.
- **Offline:** cache count cuối, chấp nhận cũ.

### A11y
Contrast ≥4.5:1 (dark the-line). Badge = plain text trong `<Link>` row (không lồng interactive, không 44px, không aria-live).

### Copy (VI / EN)
```
Singles VI: "{N} người đã đăng ký"   EN: "{N} players registered"
Doubles VI: "{N} đội đã đăng ký"      EN: "{N} teams registered"
```
KHÔNG `14/16` (ngụ ý cap cứng — trái mô hình). Dưới ngưỡng: bỏ token, dựa pill.

### Panel đa model
- **Claude + GPT-5.6 đồng thuận** (2 vendor độc lập → bằng chứng thật): N+1=Blocker phải batch; không show quota+count cùng lúc; chỉ gắn nhãn open-reg setup; doubles đếm đội; ngưỡng ẩn `<4`; copy theo đơn vị bỏ X/Y bỏ icon; badge non-tappable contrast ≥4.5:1.
- **Bất đồng (nội bộ, đã chốt)**: GPT muốn xóa quota MỌI row (critic không đồng ý — scope creep, chỉ thay ở row đủ điều kiện). Critic thắng bằng lập luận diff-nhỏ-nhất.

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🟡 AMBER (2 điều kiện chặn cứng — vi phạm → RED)

| # | Mức | Cơ chế hỏng | User thấy | Giảm thiểu |
|---|-----|-------------|-----------|------------|
| 1 | **Cao** | RLS `20251225041737:42-51` không lọc status; count thiếu `.eq(status,approved)` | Số phồng: `team_match_teams` **15 approved+3 rejected+1 pending → hiện 19 thay 15**; đội bị-từ-chối vẫn "đã đăng ký" | BẮT BUỘC `.eq(status,approved)` mọi bảng |
| 2 | **Cao** | N+1 fan-out; tab Ended limit 100+100 (`Tournaments.tsx:167,170`) → ~200 round-trip | Badge muộn hàng giây / timeout trắng trên p75 mobile VN | 1 query gộp, KHÔNG gắn completed |
| 3 | **Cao (pre-mortem #1)** | Doubles đếm nhầm bảng → count 0 → badge ẩn ~nửa số giải (đôi là format phổ biến), im lặng 3 tuần | Giải đôi kín người vẫn hiện trống | Split đơn/đôi trong hook |
| 4 | TB | Count phụ thuộc viewer (anon 0 vs creator ≠0) | Số không canonical | Đếm rows anon thấy (chấp nhận) |
| 5 | **Giá trị (→D3)** | `quick_table_registrations` pending/thưa → approved-only badge QuickTable gần như không hiện | Feature vô hình, 0 telemetry = tàng hình | **1 dòng telemetry** + đo trước khi tin |

### ⚠️ Adjacent live defect (KHÔNG do change này — báo Cuong riêng)
Anon `select=*` trên `team_match_teams` trả `invite_code`, `captain_user_id`, `payment_status` — lỗ RLS **có sẵn**. Badge dùng `head:true` nên KHÔNG lộ, nhưng ai copy pattern sang `select=*` là lộ. Fix riêng: siết SELECT anon xuống cột an toàn.

### ⚠️ Adjacent latent defect (lộ ra khi audit)
Toggle `auto_approve_registrations` trong UI tạo bàn (`QuickTables.tsx:189`) **hiện không làm gì** — 0 consumer flip status. Đơn luôn pending tới khi BTC duyệt tay. Đáng báo Cuong (feature dở dang hoặc bug).

### SLO / Perf / SEO / Rollback
- **SLO p75**: N+1 waterfall là đe doạ chính → 1 query gộp = non-issue. Không chạm bracket slot (SLO 4).
- **Bundle** +~0 KB (1 query, 0 dep). Trần 1970 KB an toàn.
- **SEO none**: badge client-only, không vào SSR. **Không bump `pr:v30`.** Verify `curl -A Googlebot .../tournaments` không chứa số.
- **Rollback**: `git revert` + redeploy ~5 phút — SẠCH **chỉ khi** client-only + 0 migration. Thêm RPC/migration → RED (down-migration thủ công).

### Phản biện độc lập (GPT-5.6 — vendor khác)
- Xác minh repo/prod: count sai do thiếu status filter (đo 15/19); request storm ~260 op do limit 100; badge client-only HEAD-count không lộ invite_code (GPT tự giới hạn đúng).
- Bác bỏ: không có (GPT chỉ suy luận trên facts, không hư cấu cơ chế).

---

## 7. Tranh luận trong panel

| # | Chủ đề | Vòng 2 | Trạng thái | Kết luận |
|---|--------|--------|------------|----------|
| D1 | N+1 fan-out vs 1 query gộp | architect CONCEDE (`Tournaments.tsx:161,193-196`) | ✅ RESOLVED | 1 query gộp table_id=in.(ids ongoing), KHÔNG N+1, KHÔNG gắn Ended. 4 agent/2 vendor hội tụ |
| D2 | approved-only vs include-pending vs hybrid | architect CONCEDE→hybrid; risk-auditor HOLD approved-only (`useRegistration.ts:123`) | ✅ RESOLVED | **approved-only** — orchestrator verify hybrid dựa cơ chế không tồn tại (0 consumer auto_approve) → loại |
| D3 | Premise QuickTable đủ data? | — | 🔶 OPEN_FOR_CUONG | cần Cuong |
| D4 | Gộp sửa pill "CHUẨN BỊ"? | — | 🔶 OPEN_FOR_CUONG | cần Cuong |

_(Ledger `--strict` xanh: 4 bất đồng · 2 giải bằng bằng chứng · 2 mở cho Cuong. Raw: `debate.json`.)_

### Bất đồng bị giết ở vòng 2 (ảo — thiếu thông tin)
- **D1 (N+1 vs batch)**: architect CONCEDE kèm `Tournaments.tsx:161,193-196` (tab mặc định render 4 format ongoing cho anon, không phải 1 list cap-20 như tưởng) + `useUpcomingSocialEvents.ts:64` (pattern gốc sống nhờ staleTime hook mới thiếu). → **1 query gộp**. 4 agent (2 vendor) hội tụ.

### Bất đồng sống sót nhưng giải bằng dữ kiện
- **D2 (status count)**: architect R1 include-pending → R2 CONCEDE sang hybrid; risk-auditor **HOLD approved-only** kèm `useRegistration.ts:123` (INSERT luôn pending, 0 trigger flip theo auto_approve). **Orchestrator TỰ KIỂM CHỨNG**: trigger duy nhất trên bảng = timestamp (`mig 20251225041737:85-88`); 0 consumer auto_approve trong code/edge/migration. → **hybrid dựa cơ chế KHÔNG tồn tại, bị loại. approved-only thắng.** Đây là ví dụ cross-vendor (risk GPT-5.6 + Claude) bắt lỗi mà architect+pre-mortem (2 Claude) bỏ sót.

### Bất đồng sống sót (thật — lên mục 0)
- **D3** (premise QuickTable đủ data?) + **D4** (gộp sửa pill?) → OPEN_FOR_CUONG.

### Nhượng bộ bị LOẠI
- Không có. (architect CONCEDE D1+D2 đều kèm file hợp lệ; ledger `--strict` xanh.)

---

## 8. Kế hoạch verify

**Tự động:**
- [ ] `npx eslint <changed>`
- [ ] `node scripts/check-theline.mjs src/pages/Tournaments.tsx`
- [ ] `npx tsc -b --noEmit` (KHÔNG `-p`)
- [ ] `npm run test` (thêm test hook: split đơn/đôi đếm đúng bảng; approved-only; ẩn <ngưỡng)
- [ ] `npm run build` + `check-bundle-size.mjs`
- [ ] `npm run e2e:smoke`
- [ ] **grep gate (risk-auditor)**: diff có `.eq('status','approved')`; `git diff --name-only | grep supabase/migrations` = RỖNG; không `Promise.all(rows.map(...count...))`
- [ ] `curl -A Googlebot .../tournaments` không chứa số → client-only, không bump pr:v30

**Cuong phải tự làm:**
- [ ] Nhìn `/tournaments` trên iPhone thật — badge chỉ hiện ở giải ≥ngưỡng, không gãy dòng 390px
- [ ] Quyết **D3** (đọc số telemetry sau 1-2 tuần) + **D4** (gộp pill hay tách)
- [ ] Native /apple parity nếu card giải có trên native (fix-both standing) — ghi manual-test-backlog nếu ship web trước

---

## 9. Sau khi ship
- SHA: · PR: · Ngày:
- Khác kế hoạch:
- Học được (→ `.claude/memory/lessons-learned.md`): copy-pattern qua ranh mô hình dữ liệu (1 bảng→2 bảng đơn/đôi) là điểm mù panel; bundle-gate mù với N+1 network cost; auto_approve_registrations không có consumer.
