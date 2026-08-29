# Round 1 — Technical prompt cho `coder` (feature: shop-ui-polish)

## Bối cảnh thi công (đọc trước, không bỏ qua)

- Làm việc TRONG worktree: `/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-ui-polish` (branch `feat/shop-ui-polish` từ origin/main `65703e41`). **KHÔNG đụng repo gốc** `/Users/cm10/pickle-hub-pro`.
- Worktree chưa có node_modules — chạy `npm ci` đầu phiên. `npm ci` KHÔNG được làm đổi `package-lock.json`; nếu đổi → dừng, báo cáo, không commit lockfile.
- **KHÔNG migration, KHÔNG đụng thư mục `supabase/`** — vòng này thuần client + CSS.
- Commit theo hạng mục (hạng mục 1 — thumbnail — là 1 commit riêng, làm ĐẦU TIÊN). **KHÔNG push.**
- Spec chính (đọc TOÀN VĂN trước khi gõ): `docs/build-feature/shop-ui-polish/03-ux-spec.md`. Phân tích chốt: `02-final-analysis.md` cùng thư mục. Chi tiết dưới đây trích từ spec — khi nghi ngờ, spec thắng.

## KỶ LUẬT PONYTAIL (luật, PO yêu cầu tường minh)

- Diff ngắn nhất còn đúng spec. Tái dùng class/token/hook có sẵn tối đa.
- Không abstraction mới ngoài đúng 2 thứ spec cho phép: component `src/components/shop/ShopMonogram.tsx` và lift hook `src/hooks/shop/useSignedPreviews.ts`.
- Không viết CSS mới cho thứ class cũ đã làm được. Không refactor ngoài chỗ đang sửa.
- "Rẻ hơn spec" nghĩa là: đạt CÙNG kết quả người dùng nhìn thấy bằng cách thực hiện rẻ hơn — được phép, phải GHI CHÚ sai lệch trong báo cáo. Anatomy/token/copy/trạng thái là kết quả bắt buộc, không được "rẻ hoá" chúng đi.
- Giữ nguyên các fix đã ghi sổ trong `shop.css` (touch target 44px, `min-width:0`, light-mode ink flip, chip count, `data-mobile-only/desktop-only`, scroll ownership) — ưu tiên THÊM class, không viết lại block cũ.

## CẤM (fail nếu vi phạm)

- KHÔNG đụng cấu trúc `SellerProductForm.tsx` (1390 dòng, 3 test hành vi). Tối đa: hưởng lợi gián tiếp từ CSS chung.
- KHÔNG đổi/xoá copy VI đã acceptance ở BẤT KỲ màn shop nào (SellLanding, SellerHome, Status…) — polish thị giác quanh lời; di chuyển markup thì chuỗi phải nguyên văn. Chỉ được THÊM 10 chuỗi VI mới liệt kê ở spec §8.
- KHÔNG thư viện UI/icon set/JS lib mới (lucide-react đã có sẵn — dùng icon từ đó là hợp lệ). KHÔNG dependency mới trong `package.json`/`package-lock.json`.
- KHÔNG token The Line gốc mới; KHÔNG hex/rgb raw mới trong `shop.css` (mọi màu mới đi qua `var(--tl-*)`/`var(--shop-*)`/`color-mix` của token); KHÔNG hạ contrast; KHÔNG sửa `--shop-on-*`; KHÔNG sửa `src/styles/__tests__/contrast.test.ts`.
- KHÔNG đổi luồng nghiệp vụ/state machine/query — ngoại lệ duy nhất đã duyệt: thêm cột vào `LIST_COLUMNS` (useSellerProducts) + dùng `useProductStatusCounts`.
- KHÔNG style nhầm hệ card proto `.tl-shop-pcard` (không dùng) — hệ thật là `.tl-pcard`.

## BƯỚC 0 — 8 điểm PHẢI xác minh trước khi gõ code (spec §10)

Ghi kết quả từng điểm vào báo cáo cuối:

1. `useMyShop` có trả `id` (và slug shop) không? Nếu không → `useMyShopMembership().data.shop_id`. Đồng thời chốt nguồn slug để xây href "Xem shop của tôi" (`/shop/store/<slug>`).
2. **Seller đọc được `public_path`/`draft_path` qua join `product_media` trong list query** — bài học "RLS không lọc CỘT nhưng có thể chặn HÀNG/JOIN". Xác minh bằng CHẠY THẬT: `supabase db reset` local + fixture (seller + product + media row) rồi chạy đúng query list với JWT seller; HOẶC nếu local stack không khả thi, nêu căn cứ cụ thể (file migration + tên policy SELECT trên `product_media` cho seller) chứng minh join trả được cột. "Chắc là được" không tính.
3. Grep `"Đang bán"` trong `src/**/__tests__` TRƯỚC khi bỏ dòng dl "Đang bán / N sản phẩm" ở ShopStore — nếu có test assert chuỗi này, sửa test cùng commit và ghi chú.
4. Grep `zalo` (case-insensitive) toàn repo tìm URL/kênh Zalo sẵn có — ghi URL ứng viên (nếu có) vào báo cáo cho PO duyệt. **Vòng này ZALO_URL chưa được PO xác nhận → SHIP KHÔNG NÚT "Nhắn Zalo", chỉ giữ câu chữ khối liên hệ** (spec §4), kể cả khi grep có kết quả.
5. `SellerHome.copy.test.tsx` KHÔNG bọc QueryClientProvider — khi SellerHome bắt đầu gọi hook react-query, test sẽ crash. Cùng commit hạng mục 3 PHẢI `vi.mock` module `useSellerProducts` (+ hook shopId nếu dùng thêm).
6. Bundle gate chỉ đo JS (CSS tự do): JS mới (hook lift + monogram + counts wiring) phải nằm trong headroom Total ~13.6 KB gz. Chạy `npm run build && node scripts/check-bundle-size.mjs` sớm sau hạng mục 1+2 để biết còn bao nhiêu.
7. Sau mỗi đợt sửa CSS: chạy `contrast.test.ts`; tự soát ràng buộc B01 — card sản phẩm đầu tiên của ShopHome còn lộ (mép trên card nằm trong viewport) ở 320px. Kiểm chính thức trên trình duyệt là việc của tester vòng sau — coder chỉ cần không thêm chiều cao mới phía trên grid.
8. (Tuỳ chọn, cuối vòng, chỉ khi mọi gate xanh) thêm `/shop`, `/shop/sell`, PDP vào `tests/visual.spec.ts`. KHÔNG chạy workflow_dispatch (không push vòng này) — chỉ chuẩn bị file, ghi chú lại.

## HẠNG MỤC (làm theo thứ tự 1→5)

### 1. Thumbnail thật ở SellerProducts — COMMIT RIÊNG, làm đầu tiên

- `src/hooks/shop/useSellerProducts.ts` (~dòng 83-84): `LIST_COLUMNS` đang có `product_media(id,position)` → thêm `public_path,draft_path`.
- Lift `useSignedPreviews` từ `src/components/shop/MediaEditor.tsx:56-82` ra file mới `src/hooks/shop/useSignedPreviews.ts` — **giữ nguyên body** (bucket `shop-product-media-draft`, TTL 300s); `MediaEditor.tsx` import lại từ chỗ mới; test MediaEditor hiện có phải vẫn xanh.
- Chọn media hiển thị: row có `position` nhỏ nhất. Ưu tiên `public_path` (qua helper `publicMediaUrl` — không hết hạn); chỉ khi không có mới mint signed URL cho `draft_path`. Gom **MỘT** call `createSignedUrls` cho cả page (~20 rows) — không mint từng card.
- Viết lại component `Thumb` (`SellerProducts.tsx:407-415`) theo anatomy spec §1:
  - `<span class="tl-shop-thumb">` chứa 1 trong 3: `<img class="tl-shop-thumb-img">` | shimmer `tl-shop-sk` phủ kín | `<ImageOff/>` 18px.
  - CSS mới trong shop.css: `.tl-shop-thumb { aspect-ratio:1/1; width:100%; border-radius:var(--tl-radius); overflow:hidden; background:var(--tl-surface-2); border:1px solid var(--tl-border); display:grid; place-items:center; color:var(--tl-fg-3); }` · `.tl-shop-thumb-img { width:100%; height:100%; object-fit:cover; display:block; }`
  - Kích thước giữ chỗ hiện tại: 44px table row, 56px mobile card — KHÔNG đổi layout hàng.
- 4 trạng thái (bảng spec §1, đủ cả 4): `mediaCount===0` → ImageOff (+ pill "Chưa có ảnh" đã có, giữ) · có `public_path` → `<img loading="lazy" decoding="async">` ngay · chỉ `draft_path` URL chưa về → shimmer (KHÔNG ImageOff — chưa-tải ≠ không-có) · mint lỗi / `onError` ảnh 404 → rơi về ImageOff, không notice/retry.
- A11y: `alt=""` + `aria-hidden="true"` (trang trí; link vẫn là title, thumb không phải touch target).
- Test (mock `createSignedUrls` theo pattern `MediaEditor.test.tsx`) — 4 case: (a) public_path → img src đúng output `publicMediaUrl(public_path)`; (b) draft-only → skeleton, rồi img sau khi mock resolve, VÀ `createSignedUrls` được gọi đúng 1 lần cho cả danh sách; (c) 0 media → ImageOff; (d) mint reject → ImageOff. Nếu rẻ, gộp thêm 1 row có 2 media lộn thứ tự position để chốt "position nhỏ nhất".

### 2. ShopStore — monogram + header có mặt mũi

- `src/components/shop/ShopMonogram.tsx` MỚI (thuần, 0 data, 0 dep):
  - Props `name: string`, `size?: number` (default 40). Chữ: `[...name.trim()][0]` uppercase (code point — "Đạt" → "Đ"); rỗng → "?".
  - Hash: `sum codePoints % 5` → PALETTE 5 token accent: `--tl-green / --tl-blue / --tl-gold / --tl-accent-team / --tl-accent-qt`.
  - Màu: nền `color-mix(in srgb, <accent> 16%, var(--tl-surface))`, viền `color-mix(in srgb, <accent> 45%, transparent)`, chữ `var(--tl-fg)`. Accent truyền qua CSS var `--mono-accent` inline (giá trị là `var(--tl-…)` — vẫn token, không hex).
  - `.tl-shop-monogram`: `border-radius:var(--tl-radius-lg); display:grid; place-items:center; font-weight:700; font-size:size*0.42; flex:none;` · `aria-hidden="true"`.
  - Test nhỏ: "Đạt Shop" → "Đ"; `"  "`/rỗng → "?"; cùng name → cùng accent (hash ổn định).
- `ShopStore.tsx:84-95`: thay khối h1 bằng `<header class="tl-shop-storehead">` đúng anatomy spec §2 — banner `aria-hidden` + row (`ShopMonogram size={56}` + `tl-shop-storehead-id`: h1 giữ nguyên BadgeCheck + sr text, `<p class="tl-shop-storehead-meta">{product_count} sản phẩm{region && \` · ${region}\`}</p>`); `shop.intro` giữ dạng `tl-shop-sub` dưới header. Breadcrumb giữ.
- Banner: cao 56px mobile / 72px ≥768px; `border-radius:var(--tl-radius-lg)`; gradient token: `linear-gradient(140deg, var(--tl-surface-2), color-mix(in srgb, <accent-hash> 14%, var(--tl-surface)))` — **accent-hash là CÙNG accent mà ShopMonogram chọn cho tên shop đó** (cùng thuật toán hash, đừng viết 2 thuật toán). Công thức gradient theo mẫu `.tl-shop-media--a/b/c` có sẵn.
- Row flex gap 12; monogram đè banner `margin-top:-28px` (banner không tốn thêm chiều cao thực). Cấm hero to — ở 390px catalog không bị đẩy sâu thêm quá ~1 chiều cao banner+header so với hiện trạng.
- Card dl giữ vị trí/copy, TRỪ dòng "Đang bán / N sản phẩm" (đã lên header — bỏ SAU khi verify Bước 0.3).
- Loading/not-found/redirect giữ nguyên; header render từ data sẵn có, KHÔNG query mới.
- Monogram 22px ở PDP storecard: TUỲ CHỌN (mục cắt đầu tiên — spec §9).

### 3. SellerHome → dashboard thật

- Notice trạng thái: **GIỮ NGUYÊN TỪNG CHỮ** (`SellerHome.copy.test.tsx` là guard — không xoá/sửa assert cũ nào).
- MỚI — hàng CTA (CHỈ khi `state === "active"`; các state khác không render): `div.tl-shop-cta-row` gồm `<a>` "Xem shop của tôi" (`tl-shop-btn--primary`, icon `Store` 16, `target="_blank"` + `rel="noopener noreferrer"`, href = `/shop/store/<slug>` từ Bước 0.1) + `<Link>` "Đăng sản phẩm" → `/seller/products/new`. Mobile <560px: mỗi nút `flex:1 1 100%` xếp dọc.
- MỚI — ô số liệu dùng `useProductStatusCounts(shopId)` có sẵn:
  - `.tl-shop-stats`: grid 2 cột mobile (`minmax(0,1fr)`) / 4 cột ≥768px, gap `var(--shop-gap)`.
  - `.tl-shop-stat` là `<Link to="/seller/products">` (không deep-filter): nền `var(--tl-surface)`, border, radius, padding 14, **min-height 76px** (spec §3 ghi 44, §7 ghi ≥76 — lấy 76, thoả cả hai; ghi chú sai lệch).
  - `.tl-shop-stat-n`: 26px/700/`tabular-nums`/`var(--tl-fg)`. Ô "Cần sửa" khi >0: số `var(--shop-danger)` + viền `color-mix(in srgb, var(--shop-danger) 45%, transparent)` — ô duy nhất có màu.
  - `.tl-shop-stat-l`: 12px `var(--tl-fg-3)`.
  - 4 ô: **Đã duyệt**=approved · **Chờ duyệt**=pending_review · **Cần sửa**=needs_changes+rejected · **Nháp**=draft. (KHÔNG dùng chữ "Đang bán".)
- Trạng thái stats: loading = 4 ô `tl-shop-sk` cao 76px, `aria-busy`; error = 1 dòng `tl-shop-hint` "Chưa tải được số liệu sản phẩm." + nút `--sm` "Thử lại" (refetch, KHÔNG ErrorState toàn màn); empty (tổng=0) = empty nhỏ "Chưa có sản phẩm nào" + nút "Đăng sản phẩm đầu tiên"; stats/CTA chỉ render khi có `shop.data`.
- Card DefList + "Bước tiếp theo": giữ nguyên.
- Test cùng commit (trong `SellerHome.copy.test.tsx` hoặc file test mới cạnh nó): `vi.mock` `useSellerProducts` (+ hook shopId); assert (a) nút "Xem shop của tôi" khi active: đúng href + `target="_blank"` + `rel` chứa cả `noopener` và `noreferrer`; (b) CTA row KHÔNG render ở 1 state khác active; (c) stats với mock counts: đúng 4 nhãn, ô "Cần sửa" = needs_changes + rejected cộng dồn.

### 4. SellLanding + SellerApplicationStatus

SellLanding (`SellLanding.tsx:87-128` là vùng "6 khối xám") — copy giữ 100%, chỉ đổi markup/class:
- Hero: bọc `div.tl-shop-hero` — sub 15px, CTA `--primary` + `--block` <560px, hint giữ. Eyebrow MỚI trên h1: `<p class="tl-shop-eyebrow">Thử nghiệm kín · Chưa thu phí</p>`.
- Card checklist "Cần chuẩn bị gì": giữ.
- 4 section notice → nhịp editorial `.tl-shop-faq`: mỗi item `border-top:1px solid var(--tl-border); padding:16px 0;` — h2 giữ text + icon inline (`var(--tl-fg-3)`), body giữ nguyên. Riêng "Huy hiệu Đã xác minh": `border-left:3px solid var(--shop-verified); padding-left:14px` — 1 điểm màu duy nhất.
- Notice "thử nghiệm kín / chưa trong nhóm": giữ nguyên trạng.

SellerApplicationStatus:
- Thứ tự mới: notice → "Cần sửa N chỗ" → **Diễn biến (timeline)** → Thông tin đã gửi → hàng nút (đảo "Diễn biến" lên trên "Thông tin đã gửi").
- Timeline ghost MỚI trên cùng khi status ∈ {submitted, under_review}: `.tl-shop-timeline li.is-next` (dot rỗng `border:1px dashed var(--tl-border-2)`), text "Quản trị viên xem hồ sơ và trả lời tại đây" — không hứa SLA.
- Khối liên hệ MỚI cuối trang (mọi status TRỪ draft): card "Cần hỏi nhanh? Hồ sơ do người thật xem — nhắn Zalo cho ThePickleHub, kèm tên shop dự kiến." — **KHÔNG nút "Nhắn Zalo"** vòng này (Bước 0.4).
- Nút "Rút hồ sơ": loading label "Đang rút…" + `aria-busy`; lỗi mutation hiện notice `--danger` + `shopErrorMessage` (verify hành vi thật `useWithdrawApplication` — lỗi có thể đang rơi im lặng; nếu đã có xử lý lỗi rồi thì KHÔNG viết lại).

### 5. ShopHome + ProductCard + empty states

- ProductCard: `tl-pcard-noimg` thêm nội dung `<ImageOff size={20}/> + "Chưa có ảnh"` — `display:grid; place-items:center; gap:4px; color:var(--tl-fg-3); font-size:11px;`. Giá `.tl-pcard-price`: 14.5px → **15.5px**. KHÔNG đổi gì khác ở card.
- ShopHome: chips loading thay chữ bằng 4 chip skeleton `span.tl-shop-sk` (88×44, radius 999) trong `div aria-busy aria-label="Đang tải ngành hàng"`. Giữ B01 (không hero; tự soát fold 320px sau sửa — Bước 0.7).
- Empty states (nâng `.tl-shop-empty`: icon lucide 28px `var(--tl-fg-3)` trên title) — CHỈ THÊM, không đổi chữ sẵn có:
  - ShopHome "Mới đăng" rỗng: + link "Anh/chị có đồ pickleball muốn bán? **Tìm hiểu cách mở shop**" → `/shop/sell`.
  - ShopSearch/Category rỗng: icon `SearchX`. ShopStore catalog rỗng: icon `Package`. SellerProducts rỗng: icon `PackageOpen` cho empty đầu (GIỮ cả 2 loại empty). Status chưa có hồ sơ: icon `FileText`.
  - `ResultsGrid` (CatalogResults) nhận prop mới `emptyAction?: ReactNode` — 1 prop, không fork component. Giữ nguyên phân biệt error ≠ empty.

### Xuyên suốt (spec §6-§7)

- THÊM 1 rule: `.tl-shop-btn:active:not(:disabled), .tl-shop-stat:active { transform: translateY(1px); }` (reduced-motion đã cover sẵn).
- Touch ≥44px; monogram/thumb/icon trang trí `aria-hidden`; section mới có `aria-labelledby`; không chữ nhỏ `--tl-fg-4` trên surface; light mode tự flip qua token — không viết màu riêng cho light mode. (Nghiệm thu trình duyệt 2 mode + các viewport là việc của tester vòng sau.)

## LUẬT CẮT khi chạm trần (spec §9)

Chỉ được cắt khi CHẠM TRẦN THẬT (bundle gate fail dù đã tối giản, hoặc vướng blocker kỹ thuật ghi được bằng chứng) — không cắt vì tiện. Cắt từ trên xuống: (1) monogram 22px PDP (vốn tuỳ chọn) · (2) timeline ghost · (3) icon empty states · (4) chip skeleton ShopHome · (5) nhịp FAQ SellLanding (tối thiểu vẫn làm hero + eyebrow) · (6) khối Zalo.
**KHÔNG BAO GIỜ cắt:** thumbnail thật · nút "Xem shop của tôi" · monogram ShopStore. Mỗi mục cắt: ghi vào báo cáo kèm bằng chứng chạm trần.

## ACCEPTANCE CRITERIA (đánh số, đo được — chạy trong worktree)

- AC1. `npm run lint` — 0 error.
- AC2. `npx tsc -b` — exit 0.
- AC3. `npm run test -- --coverage` — toàn bộ pass, statements ≥83% (gate repo).
- AC4. Test Thumb pass đủ 4 case: (a) public_path → img src = `publicMediaUrl(public_path)`; (b) draft-only → skeleton rồi img sau resolve + `createSignedUrls` gọi đúng 1 lần; (c) 0 media → ImageOff; (d) mint reject → ImageOff.
- AC5. Test SellerHome pass: (a) CTA "Xem shop của tôi" khi active — đúng href, `target="_blank"`, `rel` chứa `noopener` VÀ `noreferrer`; (b) CTA vắng mặt ở state khác active; (c) stats mock counts — đúng 4 nhãn "Đã duyệt · Chờ duyệt · Cần sửa · Nháp", "Cần sửa" = needs_changes + rejected.
- AC6. Guard copy còn nguyên: `git diff origin/main -- <đường dẫn SellerHome.copy.test.tsx>` KHÔNG xoá/sửa assert nào có sẵn — chỉ THÊM (mock + assert mới). Dán diff vào báo cáo.
- AC7. Không màu raw mới trong shop.css: `git diff origin/main -- src/styles/shop.css | grep '^+' | grep -Ec '#[0-9a-fA-F]{3}|rgb\('` trả về **0**.
- AC8. `npm run build` exit 0 VÀ `node scripts/check-bundle-size.mjs` exit 0.
- AC9. `contrast.test.ts` pass, và `git diff --name-only origin/main` KHÔNG chứa `src/styles/__tests__/contrast.test.ts`.
- AC10. File source MỚI chỉ gồm: `ShopMonogram.tsx`, `useSignedPreviews.ts`; file mới còn lại phải là `__tests__` của các file đang sửa. `MediaEditor.tsx` import hook từ chỗ mới, test MediaEditor vẫn xanh. Có test ShopMonogram (chữ đầu VI, rỗng → "?", hash ổn định).
- AC11. `git diff --name-only origin/main` KHÔNG chứa: `SellerProductForm.tsx`, `contrast.test.ts`, bất kỳ file `supabase/`, `package.json`, `package-lock.json`.
- AC12. Copy acceptance nguyên vẹn: diff SellLanding/SellerApplicationStatus/SellerHome/ShopStore không XOÁ chuỗi văn bản VI sẵn có nào (di chuyển markup phải giữ nguyên văn; ngoại lệ duy nhất: dòng dl "Đang bán / N sản phẩm" ở ShopStore). Chuỗi MỚI chỉ nằm trong danh sách 10 mục spec §8 (trừ mục Zalo-URL bị hoãn nút).
- AC13. Commit: commit đầu tiên chứa trọn hạng mục 1 (thumbnail) và không lẫn hạng mục khác; mỗi hạng mục sau ≥1 commit; `git ls-remote origin feat/shop-ui-polish` rỗng (chưa push).

## BÁO CÁO CUỐI (format bắt buộc)

1. **Tóm tắt** — làm gì, mấy commit, mục nào cắt theo §9 (kèm bằng chứng chạm trần).
2. **Kết quả 8 điểm xác minh Bước 0** — từng điểm: kiểm thế nào, kết quả, bằng chứng (lệnh + output rút gọn). Riêng điểm 2: ghi rõ chạy thật hay căn cứ policy nào (file + tên policy). Riêng điểm 4: URL Zalo ứng viên tìm được (nếu có) để PO duyệt.
3. **`git diff --stat origin/main`** nguyên văn + danh sách commit (`git log --oneline origin/main..HEAD`).
4. **Kết quả từng AC1-AC13** — pass/fail + bằng chứng (exit code, số coverage, output grep, trích diff cho AC6/AC12).
5. **Sai lệch so với spec + lý do** — mọi chỗ làm khác/rẻ hơn, kèm lý do; gồm cả quyết định 76px cho `.tl-shop-stat` đã nêu sẵn.
