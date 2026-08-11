# ThePickleHub Shop — marketplace (Phase 0 + slice đầu)

> Slug: `shop-marketplace` · Ngày: `2026-08-09` · Trạng thái: `draft`
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài chính xác: xem `external/*.meta.json`.
> Model thiếu key trong lần chạy này: `none` (cả 2 pass GPT-5.6 đều chạy)
>
> **Raw audit trail:** `round1/*.md` · `round2/*.json` · `external/*.md` · `debate.json`
> ⚠️ `scripts/agents/debate-ledger.mjs` + `ask-model.mjs` KHÔNG tồn tại trong repo — ledger cưỡng chế **thủ công** (ghi trong `debate.json.ledger`), GPT-5.6 gọi qua đường thay thế (OpenAI API trực tiếp / `codex exec`). Cả hai agent ngoài đều tự báo cáo việc này thay vì ứng biến im lặng.

---

## −1. ⚠️ Phần đã bị thay thế (đọc trước)

Ngày **2026-08-11** Product Owner ký trực tiếp **D1–D4**. Nguồn sự thật về phạm vi
và thứ tự phase từ đây là **`production-implementation-map.md` §11**, không phải
mục 2/4 dưới đây.

| Mục dưới đây | Trạng thái |
|---|---|
| §2 "Khuyến nghị Option B′ — KHÔNG application flow" | **Đã thay thế.** Phase 1 thực tế đã dựng application flow + admin review (commit `1fac6b4f`), theo implementation map. |
| §4 "Increments" (PR1 shops / PR2 products) | **Đã thay thế** bởi bảng phase P1 · P2a · P2b · P3a · P3b trong map §1. |
| §4 "PR2 … bucket `product-media` public theo khuôn clubs-logos" | **Đã thay thế** bởi D1: private draft + public rendition chỉ cho sản phẩm đã duyệt. |
| §5/§6 "không catalogue công khai, không route buyer" | **Vẫn đúng cho Phase 2a**; catalogue công khai + PDP + CTA "Liên hệ shop" là **P2b** (D2, D3). |
| Verdict 🔴 RED, cấm auto-merge, không thu KYC/bank ở pilot | **Vẫn hiệu lực.** |
| Q1–Q4 mục 0 | **Vẫn mở** — D1–D4 là bộ quyết định khác, không trả lời Q1–Q4. |

Vòng 2 `/idea` **cố ý bỏ**: Product Owner tự giải quyết 4 bất đồng thay vì chạy
lại panel. Hai script thiếu (`debate-ledger.mjs`, `ask-model.mjs`) ghi backlog
tooling riêng — không tự dựng framework đó trong Phase 2.

---

## 0. 🔶 Cần anh quyết

Panel đối chất xong **không còn bất đồng mở** — cả 3 bất đồng đều được giải quyết bằng bằng chứng file (mục 7). Nhưng 4 quyết định sau chỉ anh làm được, và 2 cái đầu chặn code:

| # | Vấn đề | Chi tiết | Nếu bỏ qua |
|---|--------|----------|------------|
| Q1 | **Ký RED** | Slice có 1-2 migration (RED theo cả classifier lẫn auditor — không hạ được). Reverse-SQL sẽ nằm sẵn trong PR body. | Pipeline dừng, không auto-merge. |
| Q2 | **Văn bản "Quy chế người bán v1" (VI) chưa tồn tại** | ui-ux-critic grep repo: 0 kết quả. Nút "Tôi đồng ý…" đang ghi nhận chấp thuận một văn bản không có thật. Anh viết/duyệt văn bản (hoặc nhờ luật sư), HOẶC slice bỏ nút, ghi `verified_method`+`verified_at`. | Hồ sơ pháp lý §23 rỗng ruột. |
| Q3 | **CLS error-budget** | `docs/slo.md`: SLO cháy thì pause feature trong domain đó; CLS p75 ≈ 0.67 đang cháy. Slice này KHÔNG làm CLS tệ hơn (GPT-5.6 xác nhận, auditor nhận) — nhưng chính sách đã viết thì phải áp: anh tuyên bố `/seller/*` là domain tách biệt, hoặc slice chờ CLS attribution xong. | Chính sách SLO thành giấy. |
| Q4 | **Trạng thái đăng ký sàn TMĐT với Bộ Công Thương** | Intake nói đã có pháp nhân; đăng ký BCT là launch gate cho public (không chặn closed pilot code). GPT-5.6 dẫn luật mới (122/2025/QH15, NĐ 248/2026, định danh người bán từ 01/01/2027) — **chưa kiểm chứng được, cần luật sư VN xác nhận**, đừng chép vào bất kỳ policy nào. | Mở public là rủi ro pháp lý thật. |

---

## 1. Ý tưởng gốc

"Phân tích proposal ThePickleHub Shop marketplace theo docs/proposals/shop-marketplace-plan.md — đánh giá tính khả thi, rủi ro, phạm vi MVP (Phase 0 + vertical slice Phase 1: seller application + admin review), chưa code."

**Làm rõ ở bước 0:**

| Hỏi | Trả lời |
|---|---|
| Ai dùng | 1-3 pilot seller **quen, đã có sẵn** (không phải seller lạ) |
| Đau ở đâu | Seller pickleball VN bán qua Facebook/Shopee, chưa có sàn chuyên ngành |
| Thành công = | **Seller thật chịu đăng bán** — số shop duyệt + số sản phẩm thật published |
| Ràng buộc | Đã có pháp nhân; hard constraints §0 plan gốc (không VietQR=paid, không slot nav 6, không seller role global, không lộ KYC…) |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🔴 **RED** (slice đầu) · 🔴 RED (toàn plan 5 phase) |
| **Khuyến nghị** | **Option B′** — admin tạo shop tay cho 3 seller quen + product editor tối thiểu, 2 PR nhỏ. KHÔNG application flow, KHÔNG KYC upload, KHÔNG bank, KHÔNG catalogue công khai. |
| **Công sức** | ~9-10 nửa ngày (PR1 shops ~5 + PR2 products/editor ~4-5) + 0.5 cho fix login in-app browser bản (b) |
| **Rủi ro lớn nhất** | Migration không revert được trên nền ledger đang drift (3 migration untracked phải commit TRƯỚC); nếu sau này làm KYC: bucket "private" copy nhầm template = CCCD đọc được bằng anon key, **không có cơ chế phát hiện** |
| **Auto-merge** | **Chặn — cần Cuong duyệt** (RED) |

🔴 RED nghĩa là: không revert được bằng `git revert`. Ở đây là migration; bản Option B′ đã cắt hết phần một-chiều nặng nhất (PII/KYC/bank) nên reverse = vài câu `DROP TABLE` + xoá prefix ảnh.

**Điểm mấu chốt cả panel hội tụ (Claude × GPT-5.6 độc lập, 2 lần):**
1. Plan gốc §21 tự mâu thuẫn: exit Phase 1 là "publish one real product" (L936) nhưng PR đầu cấm products (L991). Slice không chạm điểm publish = không đo được thước đo anh đặt ra.
2. **Không thu CCCD/bank ở pilot.** Slice đầu không có chức năng nào cần chúng; thu là tự nhận nghĩa vụ NĐ 13/2023 + dựng pattern private-bucket đầu tiên của repo trên dữ liệu nhạy cảm nhất — pre-mortem chỉ ra sự cố lộ CCCD **không có cơ chế phát hiện nào**. Giấy tờ 3 người quen: nhận qua Zalo, ghi `verified_method`+`verified_at`.
3. **B3 — seller mở link từ Zalo/Messenger sẽ không đăng nhập được** (`Login.tsx` chỉ có OAuth Google/Apple; Google chặn OAuth trong in-app browser). Không sửa thì mọi số liệu pilot là rác: "không ai đăng bán" có thể chỉ là "không ai vào được cửa".

---

## 3. Đã có sẵn gì (recon)

Marketplace **0% built** — không bảng, không route, không seller concept. Nhưng scaffolding tái dùng 60-80%:

**Prior art:** RPC khuôn `btc_manage_team` (SECURITY DEFINER + FOR UPDATE + approve/reject + notes) cho state transition; handler/index split của `create-payment-order` cho edge function (nhưng slice này dùng RPC, không edge function); `is_admin()` đã bao aal2 từ `20260730090000` → RPC được MFA miễn phí; upload ảnh không-PII: khuôn `clubs-logos` (`20260512160000:100-143` + `useClubLogoUpload.ts`); notification thật = insert `notifications` + invoke `send-push-notification` (mẫu `mark-payment-claimed/index.ts:131-139`) — **`notification-send` là skeleton trả HTTP 200, cấm gọi**.

**Sẽ đụng:** `src/App.tsx` (lazy routes), `AdminLayout.tsx` (gộp 1 mục Shop — sidebar đã 18 mục), `route-snapshot.json`, `functions/_middleware.ts` (NOINDEX `/seller`), 2 file robots.txt, `Localizable`/i18n, types regen.

**Ràng buộc repo:** GRANT-block-sau-RLS (lỗi lặp nhiều nhất lịch sử repo); pgTAP `rls_auth_matrix` **mù với storage.objects** và chỉ nổ khi đã có policy; edge functions không nằm trong tsc/vitest/lint nào; deploy-guard đỏ kinh niên vì drift — **3 migration untracked (`20260801070000`, `20260801111500`, `20260805110000`) phải commit trước khi chồng thêm**; native không bắt buộc cho feature mới (ADR-001) — web-first, ghi rõ để phiên sau không tự port.

---

## 4. Phương án (solution-architect)

### Option A — Full self-serve application flow (đúng plan §21)
Effort: 14 nửa ngày · 4 bảng + 3 enum + private KYC bucket · **Thua:** không chạm thước đo; dựng kho PII khi Phase 0 chưa chốt retention (§22.13); private bucket net-new trên dữ liệu nhạy cảm nhất. Đúng cho giai đoạn có seller lạ.

### Option B → B′ (sau vòng 2) — Admin tạo shop + product editor tối giản ✅
Effort: ~9-10 nửa ngày, 2 PR:

**PR1 (~5):** migration `shops` (enum 5 state, UI chỉ render theo hành vi) + `is_shop_member(uuid)` STABLE SECURITY DEFINER + RPC `admin_manage_shop()` / `shop_accept_policy()` + GRANT block + widen CHECK `audit_logs` → `/admin/shops` (search user qua `admin_get_profile_emails`, tạo/activate/suspend, confirm email+tên trước khi gán) → `/seller` cổng chấp thuận toàn màn hình (nếu Q2 có văn bản) → noindex + robots + i18n + pgTAP.

**PR2 (~4-5):** migration `products` (+`product_media` nếu tách) + bucket `product-media` **theo khuôn clubs-logos** (folder-scope `auth.uid()`, mime jpeg/png/webp không svg, **8MB** + canvas downscale ~30 dòng, path random, `upsert:false`) → editor tối thiểu: tên, giá VND (`formatPriceVnd`), 1-3 ảnh (`aspect-ratio` cố định), tồn kho, mô tả ngắn, `draft/published` → RLS: chỉ shop `active` mới publish (đây là chỗ `pending_activation` có hành vi thật) → `/seller` liệt kê sản phẩm của mình. **Không variant, không catalogue công khai, không route buyer.**

Kèm PR1: fix B3 bản (b) — UA-detect in-app browser, ẩn nút Google, banner "Mở bằng trình duyệt" + Sao chép liên kết (~1 KB).

**Được:** chạm đúng thước đo (sản phẩm published) với RED nhỏ nhất có thể; 0 PII; 0 dependency mới (bundle còn 66 KB headroom — đo thật); reverse đơn giản.
**Mất:** seller lạ chưa có đường tự đăng ký (người thứ 4 nhắn Zalo, Cuong nhập tay — ở N<10 là tính năng).
**Đóng cửa gì:** không — với điều kiện mọi policy gọi `is_shop_member()`, cấm literal `owner_user_id` (có pgTAP guard).

### Option C — Form đăng ký công khai không upload giấy tờ
Effort: 9 nửa ngày · **Thua:** trả thêm để mua kênh tiếp nhận có lưu lượng ~0 trong 4-8 tuần; mở `/shop/sell` công khai trên sàn 0 sản phẩm. Đúng cho slice 3 khi có người lạ hỏi.

### Khuyến nghị
**Option B′.** Lý do các option kia thua đã ghi trên. Điểm dừng-và-nhìn (bài học soak/baseline): sau PR2, tạo 3 shop thật, gửi link, **gọi cả 3 seller vào ngày T+3** (pre-mortem: một cuộc gọi thay thế toàn bộ analytics Phase 3). Phễu admin tách **3 số riêng**: shop tạo / seller login+accept / sản phẩm published — gộp lại thì lỗi OAuth WebView bị đọc thành "seller không quan tâm".

### Increments
1. Commit 3 migration untracked (dọn drift) — verify `git status` sạch phần supabase/migrations
2. PR1 shops + admin + fix login (b) — verify pgTAP mới đỏ-trước-xanh-sau + route-snapshot + preview tạo 1 shop có audit log
3. PR2 products + editor — verify seller đăng 1 sản phẩm thật trên preview bằng điện thoại, ảnh 4MB từ camera đi lọt
4. PR riêng (RED auth, xếp TRƯỚC khi gửi link seller): phone-OTP vào `/login` — tái dùng `phone-otp-send`/`verify` đã chạy prod

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

**Đánh giá tổng thể:** plan gốc chắc về pháp lý/dữ liệu nhưng thiết kế cho sàn nghìn seller lạ trong khi thực tế là 3 người quen; phần lớn §6 (form 7 bước) là sai artifact cho pilot. Chi tiết đầy đủ + bảng copy VI/EN + trạng thái màn hình: `round1/ui-ux-critic.md`.

**Luồng thật:** Cuong nhắn Zalo → seller bấm link trong in-app browser → **[vỡ tại login — B3]** → `/seller` → exit đúng = đăng xong sản phẩm đầu tiên và nhìn thấy nó.

| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| B1 | Blocker | Slice §21 kết thúc trước điểm đo | Product editor tối thiểu vào khối slice 1 (đã thắng D1) |
| B2 | Blocker | Form 7 bước, bank+CCCD là chỗ seller bỏ (bằng chứng: journey-screens O3 + CreateSocialEvent loại bank khỏi autosave) | Slice thu 4 trường: tên shop, người liên hệ, SĐT, kênh Zalo/gọi/email |
| B3 | Blocker | Login chỉ OAuth → in-app browser Zalo/FB không vào được | (b) trong PR1; (a) phone-OTP PR riêng trước pilot |
| B3b | Blocker-nếu-có-KYC | SW cache `CacheFirst` 30 ngày nuốt cả signed URL, sống qua sign-out | Không nhận giấy tờ → lỗ không mở. Nếu sau này làm: `NetworkOnly` cho `/object/sign/` + thêm vào `AUTH_SENSITIVE_CACHES` |
| B4 | Nên sửa | `AdminNews.tsx` không phải mẫu queue: không error state, toast-only, nút 36px, limit cứng, poll 15s | Checklist "đừng copy" trong round1 file; lỗi ≠ rỗng; nút quyết định 44px, xếp dọc ở 375px |

**Trạng thái màn hình / Copy VI-EN / A11y:** bảng đầy đủ trong `round1/ui-ux-critic.md` (badge states, error≠empty, sticky footer + BottomNav + keyboard, `--tl-*` token, axe đang tắt color-contrast → đo tay).

**Panel đa model:** Claude+GPT đồng thuận độc lập: cắt form 7 bước; slice phải tới publish; không xây discovery buyer khi 0 sản phẩm; `approved` không bắt buộc lý do (ngược plan §5 — chỉ `needs_changes`/`rejected` bắt buộc và hiển thị cho seller). Bất đồng nội bộ đã chốt: không invite-token (Phase 2), giữ transition server-authorized nhưng bỏ màn queue, B3 là Blocker.

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🔴 RED (slice) · 🔴 RED (toàn plan)
Classifier: RED (`supabase/migrations/`) · Auditor giữ RED kể cả không migration nếu thu PII (hành động một chiều). risk-tier chạy per-file: migration RED, app code GREEN.

Với **Option B′ đã cắt KYC/bank**, các P0 gốc còn/mất như sau (bảng đầy đủ: `round1/risk-auditor.md`):

| # | Mức | Cơ chế | Trạng thái với B′ |
|---|-----|--------|--------------------|
| P0-1 | P0 | Signed URL CCCD bị Smart CDN cache 1 năm (template `useOgImageUpload` `cacheControl:31536000`) | **CẮT** (không private bucket). Điều kiện merge nếu sau này làm KYC. |
| P0-2 | P0 | Bảng mới không bật RLS lọt CI (pgTAP chỉ nổ khi đã có policy) | **CÒN** — pgTAP mới liệt kê tên bảng tường minh (products không khớp `shop_%`), ép đỏ trước |
| P0-3 | P0 | Template bank duy nhất trong repo GRANT anon | **CẮT** (không bank) |
| P0-4 | P0 | GRANT-before-RLS | **CÒN** — GRANT block + test bằng anon/JWT thật |
| P0-5 | P0 | Nghĩa vụ DLCN kích hoạt từ upload đầu, không revert | **CẮT** (không CCCD/bank) |
| P0-6 | P0 | Migration không revert + ledger đang drift + 3 file untracked | **CÒN** — reverse-SQL trong PR body; commit untracked trước |
| R2-1 | P0 mới | Copy nhầm og-images cho bucket ảnh: mọi user đăng nhập ghi đè/xoá ảnh seller khác | Khuôn clubs-logos: folder-scope `auth.uid()`, path random, `upsert:false` |
| R2-2 | P1 | 2MB limit chặn ảnh chụp điện thoại → nhiễu đúng thước đo pilot | 8MB + canvas downscale; test iPhone thật (heic) |
| P1-4/5 | P1 | Blob-loss + `notification-send` skeleton 200 | RPC thay edge function; notify qua `send-push-notification` |

**Pre-mortem** (3 sự cố tương lai, `round1/pre-mortem.md`): (1) CCCD đọc được bằng anon key 22 ngày không ai biết — **không có cơ chế phát hiện** (B′ cắt); (2) pilot chết đói supply vì notification câm + draft nuốt dữ liệu → **kết luận sai "seller VN không chịu form"** — đắt hơn downtime; (3) function shop hỏng đầu độc fleet-heal → auth/OTP chết 5h + alert Telegram trống (`$MSG_An` bash bug). Vá rẻ nằm ngoài slice, đáng làm ngay: pgTAP cho `storage.objects` · `notification-send` trả 501 thay 200 · `if: always()` + `${MSG}` trong deploy-guard + `deno check` cho edge functions.

**SLO:** CLS đang cháy → Q3. SLO-1 không đo tầng edge (điểm mù ghi nhận, ngoài phạm vi slice).
**Perf:** +25-45 KB gz → còn ~20-40 KB headroom (Total đo thật 1904/1970). 0 dependency mới là điều kiện merge.
**SEO:** không route SSR mới, không bump `pr:v34`; thêm `Disallow: /seller/` vào **cả** `functions/robots.txt.ts` và `public/robots.txt`; verify `curl -sI -A "Googlebot" /seller` → 404/noindex.
**Rollback:** feature flag + forward fix; UI ~5-10'; không-revert-được = migration (reverse-SQL viết sẵn) — B′ không còn PII/object nào một chiều ngoài ảnh sản phẩm public.

**Phản biện GPT-5.6:** Xác minh giữ: Smart CDN (finding mạnh nhất vòng — chỉ tồn tại vì có 2 model), service_role vòng qua aal2, approve không nguyên tử + stale revision, CCCD mồ côi khi resubmit, file độc lên máy operator. Bác bỏ: "REJECT" không có trong từ vựng tier; số hiệu luật/nghị định mới **không kiểm chứng được → không đưa vào như dữ kiện** (Q4); auditor cũng tự khai phần lớn "đồng thuận" là do brief tự nạp, không phải hội tụ độc lập — đọc là một nguồn, không phải hai.

---

## 7. Tranh luận trong panel

> `debate-ledger.mjs` không tồn tại → cưỡng chế thủ công theo `docs/agent-round2-rules.md`, kết quả ghi `debate.json.ledger`. 4/4 CONCEDE đều kèm file:line tự kiểm chứng — hợp lệ. RED không bị concede.

| ID | Bất đồng | Kết quả vòng 2 |
|---|---|---|
| D1 | Product editor trong slice 1? | architect **CONCEDE** (useClubLogoUpload + plan L936 vs L991) · risk **CONCEDE** (clubs-logos precedent, map lại 6 P0: 0 P0 mới) · ui-ux HOLD → **editor VÀO slice**, tier vẫn RED |
| D2 | Chấp thuận điều khoản + pending_activation | Cả hai **REFINE** hội tụ: giữ làm publish-gate + hồ sơ pháp lý; UI 3 nhánh hành vi, không bộ 5 badge. Phát hiện mới: văn bản Quy chế **chưa tồn tại** → Q2 |
| D3 | `shop_members` ngay hay hoãn | ui-ux + risk **CONCEDE** (bằng chứng 20260730090000 vs 20260730100000: helper = đổi thân hàm, inline = migration RED thứ hai) · architect HOLD → **HOÃN**, kèm pgTAP guard cấm literal `owner_user_id` |

**Bất đồng bị giết (ảo — thiếu thông tin):** D1 (architect định giá products 9 nửa ngày vì gộp variant+catalogue; thực tế bản tối thiểu ~4 trên khuôn có sẵn), D3 (repo đã trả học phí đúng câu hỏi này ở đợt aal2 sweep).
**Bất đồng sống sót:** không — D1 kết thúc 2-CONCEDE-về-phía-HOLD, không phải deadlock.
**Nhượng bộ bị LOẠI:** không có.
**Ghi chú độc lập:** risk-auditor × pre-mortem trùng nhau nhiều (cùng Claude, cùng phe tìm-cái-hỏng) — không tính là xác nhận chéo. Xác nhận chéo thật: GPT-5.6 × Claude độc lập 2 lần (slice-phải-tới-publish; không-KYC-ở-pilot).

---

## 8. Kế hoạch verify

**Tự động:**
- [ ] `npx eslint <changed>` · `node scripts/check-theline.mjs <changed tsx>` · `npx tsc -b --noEmit`
- [ ] pgTAP mới: liệt kê tường minh `shops`/`products`/`product_media` — rowsecurity + ≥1 policy + **không policy nào chứa `owner_user_id`** + anon SELECT shop chưa active = 0 dòng — **chứng minh đỏ trước**
- [ ] `npm run test` (route-snapshot cập nhật) · `npm run build` + `check-bundle-size.mjs` < 1970
- [ ] Grep chặn: `cacheControl: "31536000"` trong code shop mới; `verify_jwt = true` trong diff config.toml (slice không thêm edge function — nếu diff config.toml khác rỗng là sai)
- [ ] `node scripts/agents/risk-tier.mjs --base origin/main --json` (KHÔNG `--files "a,b,c"`)
- [ ] Preview: `curl -sI -A "Googlebot" <preview>/seller` → noindex/404; robots 2 file có `/seller`
- [ ] Post-deploy: `/`, `/feed` 200 + smoke

**Cuong phải tự làm:**
- [ ] Ký Q1-Q4 (mục 0)
- [ ] Viết/duyệt "Quy chế người bán v1" (hoặc chấp nhận bỏ nút ở PR1)
- [ ] Test điện thoại thật: mở link `/seller` từ Zalo (thấy banner in-app browser), đăng 1 sản phẩm ảnh chụp camera 3-4MB
- [ ] Gọi 3 seller ngày T+3 sau khi gửi link — đây là gate thật của pilot, không phải dashboard

---

## 9. Sau khi ship

- SHA: · PR: · Ngày:
- Khác kế hoạch:
- Học được (→ append `.claude/memory/lessons-learned.md`):
