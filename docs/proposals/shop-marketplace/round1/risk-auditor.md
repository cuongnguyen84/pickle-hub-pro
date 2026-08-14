# risk-auditor — round 1 (nguyên văn, 2026-08-09)

## Verdict: 🔴 RED (slice đầu) · 🔴 RED (toàn plan)

**Slice đầu:** một seller thật upload ảnh CCCD → repo lần đầu tạo private bucket, copy `src/hooks/useOgImageUpload.ts:40` (đang set `cacheControl: "31536000"`), signed URL 60 giây bị Supabase Smart CDN cache **một năm** và vẫn phục vụ sau khi token hết hạn — ảnh CCCD của seller trở thành URL bearer replay được, và không có `git revert` nào gỡ được vì (a) migration đã chạy, (b) object storage không nằm trong DB backup, (c) nghĩa vụ hồ sơ dữ liệu cá nhân đã kích hoạt từ lần upload đầu tiên.

**Classifier nói:** RED (`supabase/migrations/*`). Em **không hạ**, và ghi rõ: kể cả bỏ hết migration, slice này vẫn RED vì hành vi "thu thập CCCD + số tài khoản của người thật" là hành động một chiều — không có nút hoàn tác.

> **Lưu ý quy trình:** `scripts/agents/ask-model.mjs` **không tồn tại** trong repo — đúng lớp lỗi đã ghi ở lessons-learned 2026-08-04. Em **không** ứng biến im lặng: đã chạy phản biện qua `codex exec` (model `gpt-5.6-sol`, reasoning high, có web search). Panel **không** bị one-model-down.

---

## Rủi ro xếp hạng

### 🔴 P0 — chặn merge

| # | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu | Nguồn |
|---|---|---|---|---|
| **P0-1** | **Signed URL của CCCD sống lâu hơn token.** Supabase Smart CDN (verify curl 09/08, nguyên văn): *"Revoking or expiring a token does not purge its CDN cache entry..."* Template upload DUY NHẤT trong repo là `src/hooks/useOgImageUpload.ts:40` → `cacheControl: "31536000"`. Copy nó cho bucket KYC = TTL edge 1 năm. | Ai có URL mở lại được ảnh CCCD sau khi UI báo "link hết hạn". | Không copy `useOgImageUpload.ts`. `cacheControl` ≤ 60s, `expiresIn` ≤ 60s, object key random opaque. Cắt truy cập = `storage.remove()`. Test hậu-hết-hạn thật bằng curl. | **Em (repo) × GPT-5.6** |
| **P0-2** | **Bảng mới không bật RLS lọt CI.** `rls_auth_matrix.test.sql` assertion bao quát chỉ nổ **khi đã có policy**; bảng tạo với GRANT mà quên ENABLE RLS và chưa có policy → pass. 22 assertion còn lại là 9 bảng legacy hardcode. | Không ai thấy. curl PostgREST anon key trả về CCCD, bank, SĐT mọi applicant. | pgTAP: **mọi** bảng `shop_%`/`seller_%` phải `rowsecurity = true` **và** ≥1 policy. Ép ĐỎ trước rồi mới tin. | **Em (repo)** |
| **P0-3** | **Template bank-account duy nhất trong repo cấp quyền cho `anon`.** `20260512140000_event_payment_config.sql:121` `GRANT SELECT ... TO anon` + policy anon đọc `bank_account_number` (cố ý, cho QR). Là file người viết `shop_bank_accounts` sẽ mở ra copy. | Số tài khoản payout mọi seller đọc được bằng anon key. | **Không thu thập bank details trong slice đầu** (không payout/order/payment nào cần). Nếu vẫn làm: cấm GRANT anon + pgTAP negative test. | **Em (repo)** |
| **P0-4** | **GRANT-before-RLS** — lỗi lặp nhiều nhất repo (3 lần lessons-learned + sweep 2 vá 10 bảng; push_tokens hỏng câm 4 tháng). | Seller bấm Nộp → 42501. Admin mở queue → trắng. Sau khi migration đã áp prod. | GRANT block cuối MỌI migration (gồm `GRANT USAGE ON TYPE` cho enum). Integration test bằng anon key + JWT thật, không service_role. | **Em (repo) × GPT-5.6** |
| **P0-5** | **Nghĩa vụ dữ liệu cá nhân kích hoạt ở lần upload đầu, không revert được.** Plan §23 chỉ nhắc BCT, bỏ sót nhánh bảo vệ DLCN: hồ sơ đánh giá tác động + hồ sơ chuyển dữ liệu ra nước ngoài (Supabase host ngoài VN), nộp trong 60 ngày; consent riêng theo mục đích; quy trình xoá/rút consent; runbook thông báo vi phạm. Thông tin tài khoản của khách hàng TCTD là **dữ liệu cá nhân nhạy cảm**. | Checkbox "đồng ý điều khoản" không đủ; đòi xoá không có quy trình. | **Không thu CCCD/bank trong slice đầu.** Nếu bắt buộc: Phase 0 xong 2 hồ sơ + consent + retention **trước** dòng code đầu. | **Em (luật) × GPT-5.6** |
| **P0-6** | **Migration 5-7 bảng = RED.** Không có down-migration (ops-runbook §4.3). Ledger lệch >100 dòng; migration-drift đỏ kinh niên; **3 migration đang áp prod chưa vào git** (`20260801070000`, `20260801111500`, `20260805110000`). | Nếu hỏng: revert gỡ UI, 7 bảng chứa CCCD vẫn nằm prod. Restore DB không khôi phục object storage (§6). | Rollback thật = feature flag + forward fix. Reverse-migration SQL trong PR body TRƯỚC khi áp. Commit 3 migration untracked trước. | **Em (repo) × GPT-5.6** |

### 🟡 P1 — phải xử lý trước pilot thật

| # | Cơ chế hỏng | Giảm thiểu | Nguồn |
|---|---|---|---|
| **P1-1** | **`service_role` đi vòng qua aal2** — nếu review function chỉ `getUser()` rồi ghi bằng service-role client, guard aal2 trong `is_admin()` không bao giờ chạy → admin aal1 duyệt được + mở CCCD. | Bắt buộc `adminSessionAalOk()` → 403; test aal1 bị từ chối. | **GPT-5.6** |
| **P1-2** | **Approve không nguyên tử → 2 shop / 1 đơn**; retry, double-click, stale revision (admin duyệt bộ giấy tờ seller đã thay sau khi mở trang). | Một RPC SECURITY DEFINER duy nhất theo mẫu `btc_manage_team` (FOR UPDATE + permission + dispatch); UNIQUE(application_id); `WHERE status = expected`; reject stale revision. | **GPT-5.6** |
| **P1-3** | **Resubmit để lại CCCD mồ côi** trong bucket vô thời hạn, ngoài mọi retention. | Xoá object cũ cùng luồng resubmit + job đối soát orphan. | **GPT-5.6** |
| **P1-4** | **Blob-loss ăn cả 2 function mới** (NOT_FOUND_FUNCTION_BLOB đã đánh 73/75; self-heal từng chết vì quota). | Ưu tiên **RPC Postgres** cho state transition (RPC không bị blob-loss). Nếu edge function: thêm roster probe + UI nhận diện + runbook. | **Em (repo) × GPT-5.6** |
| **P1-5** | **`notification-send` là skeleton trả `{"status":"skeleton"}` HTTP 200** — cái tên "đúng" nhất mà người implement sẽ gọi. Admin Duyệt → thành công; seller không nhận gì. | Dùng `notifications` insert + invoke `send-push-notification` (mẫu `mark-payment-claimed/index.ts:131-139`). Không đụng `notification-send`. | **Em (recon) × GPT-5.6** |
| **P1-6** | **File độc upload lên máy operator duy nhất** (executable đổi tên / SVG có script; máy giữ PAT Supabase, token CF, keychain). | Bucket khai `allowed_mime_types` + `file_size_limit` (mẫu `20260415000001` og-images: 2MB, jpeg/png/webp, **không** svg). Magic-byte server-side. Random filename. Không render inline. | **GPT-5.6** (mẫu bucket của em) |
| **P1-7** | **Nợ vận hành vượt 1 người** — marketplace = hàng đợi có deadline (kiểm duyệt, takedown, trả hàng, khiếu nại, phản hồi cơ quan quản lý) chồng lên livestream + tournament + news. | Trước khi mở products: kênh tiếp nhận, deadline, quyền đình chỉ, giới hạn ngoài giờ, **người thứ hai**. GPT chỉnh đúng: nặng cho toàn plan, quá nặng cho slice 1-3 seller — em nhận. | **Em × GPT-5.6** |
| **P1-8** | **VietQR hiển thị ≠ tiền về** — tranh chấp "tôi chuyển rồi" (screenshot giả được) vs "chưa nhận", platform không giữ tiền, không đòn bẩy. | Đơn giữ trạng thái chưa thanh toán trừ khi **seller** xác nhận. Công bố: platform không xác minh chuyển khoản trực tiếp. COD + 1-seller-per-order giữ nguyên. | **Em × GPT-5.6** |

### ⚪ P2 — theo dõi

| # | Nội dung | Nguồn |
|---|---|---|
| **P2-1** | **Bundle backstop gần cạn:** đo thật `check-bundle-size.mjs` = **1904.0/1970 KB, còn 66.0 KB**. Slice 1 ~25-45 KB gz khả thi; thêm PDF viewer/cropper/form lib mới là vỡ. Lazy route vẫn tính vào Total. | Em (đo) |
| **P2-2** | SEO slice 1 an toàn (`render404()` cho path lạ) nhưng `functions/robots.txt.ts` chưa có `/seller` → thêm Disallow vào **cả 2 file** robots. | Em × GPT-5.6 |
| **P2-3** | Bẫy SEO thật ở Phase 1 đầy đủ: route public mới thiếu SSR handler = Googlebot 404 câm (lỗi số 1 của repo, 5 lần với blog). Gate: handler + bump pr:v34→v35 + curl Googlebot assert word count. | Em (repo) × GPT-5.6 |
| **P2-4** | Không va chạm tên bảng — đã đối chiếu types.ts: shops/products/orders/… đều trống; chỉ `notifications` tồn tại (cần tái dùng). | Em (repo) |
| **P2-5** | `admin_mfa` = SPOF luồng duyệt (1 admin duy nhất). Đường gỡ trong CLAUDE.md. | Em (repo) |

---

## SLO bị đe doạ

- **SLO 6 (CLS ≤ 0.1): ĐANG CHÁY SẴN** — CLS p75 ≈ 0.67, 63.7% poor (`docs/proposals/cls-attribution/00-intake.md`). `docs/slo.md`: *"Blowing an SLO ... pauses feature work in that domain until the burn is diagnosed."* **Nhưng em nhận chỉnh của GPT-5.6:** slice đầu (2 form + 1 admin queue, lazy) **không** làm CLS tệ thêm — điều đúng phải nói là chính sách error-budget đã viết thì phải áp: hoặc Cuong tuyên bố `/seller/*` là domain tách biệt, hoặc slice chờ CLS xong. Quyết định của Cuong.
- SLO 1 (Availability): không bị đe doạ — INITIAL 225.3/280 KB.
- SLO 5 (Cron): slice này 0 cron. Phase 2 order-expire phải thêm `ops_cron_monitors` cùng PR.
- SLO 7 (Push): điểm mù — gọi nhầm `notification-send` thì không có lần gửi nào nên metric không bắt được.

## Ngân sách hiệu năng

Bundle: +25-45 KB gz → 1929-1949/1970. Không vỡ nếu không thêm dependency. Dùng `<input type="file">` + `<img>` native. Vietnam p75: trung tính (surface cho 1-3 seller đã đăng nhập).

## SEO

Routes SSR ảnh hưởng: none. Không bump pr:v34. Việc ngay: `Disallow: /seller/` + `/vi/seller/` vào cả `functions/robots.txt.ts` và `public/robots.txt`. Verify: `curl -sI -A "Googlebot" .../seller/application` → 404.

## Kế hoạch rollback

Cơ chế thật: **feature flag tắt + forward fix**, không phải git revert. UI khôi phục ~5-10 phút. KHÔNG revert được: (1) migration đã chạy, không down-migration, ledger lệch >100 + 3 file untracked; (2) object storage ngoài DB backup (restore drill 22/07 xác nhận); (3) CCCD/bank đã thu = xoá là mất, giữ là nghĩa vụ; (4) nghĩa vụ hồ sơ DLCN kích hoạt từ upload đầu.

## Phải verify trước khi merge

- [ ] `node scripts/agents/risk-tier.mjs --base origin/main --json` (KHÔNG `--files "a,b,c"` — gộp comma thành 1 path, tier sai, lessons-learned 27/07)
- [ ] pgTAP: mọi bảng `shop_%`/`seller_%` rowsecurity=true + ≥1 policy — chứng minh biết ĐỎ trước
- [ ] pgTAP negative: anon SELECT bank/documents → 0 dòng hoặc 42501
- [ ] `SELECT public FROM storage.buckets WHERE id='<kyc>'` → false (assert từ DB)
- [ ] Storage policy: admin bypass là OUTER OR, không phải AND-cuối (lessons-learned "Storage RLS", mẫu thumbnails `20251222132621`)
- [ ] Grep KHÔNG copy `cacheControl: "31536000"` vào KYC
- [ ] Test post-expiry: signed URL 60s, đợi 90s, curl lại → 400/403, không phải 200 từ cache
- [ ] Integration test: anon + JWT user + admin aal1 + admin aal2 (không service_role)
- [ ] `npm run auth:registry -- --strict` → 0 error; grep chặn `verify_jwt = true` trong diff config.toml
- [ ] `node scripts/check-bundle-size.mjs` → Total < 1970
- [ ] Reverse-migration SQL trong PR body trước khi áp
- [ ] Commit 3 migration untracked trước

---

## Phản biện độc lập (GPT-5.6)

**Về tính độc lập:** brief self-contained nên em đã *nạp cho* GPT phần lớn dữ kiện repo — phần lớn "đồng thuận" **không phải hội tụ độc lập**, ghi rõ để không ai đọc thành hai nguồn xác nhận nhau. Giá trị thật của GPT: 4 cơ chế nó thêm mà em không có.

**Đã xác minh — GIỮ:** P0-1 (Smart CDN, em curl doc Supabase xác nhận nguyên văn + tìm ra `cacheControl: 31536000`; finding mạnh nhất của cả vòng, chỉ tồn tại vì có 2 model); P1-1 (khớp comment `_shared/admin-aal.ts`); P1-2 (stale-revision là điểm em không có); P1-3 (mới, đúng, rẻ); P1-6; chỉnh P1-7 (em nhận); chỉnh CLS (em nhận — "slice này làm CLS tệ hơn" là bịa).

**Bác bỏ / hạ cấp:**
- "REJECT" làm verdict — không nằm trong từ vựng tier repo (RED/AMBER/GREEN). Dịch sang RED. RED = "cần Cuong duyệt tường minh", không phải "cấm".
- **Luật TMĐT 122/2025/QH15 + NĐ 248/2026 hiệu lực 01/07/2026; định danh điện tử người bán từ 01/01/2027** — GPT dẫn link chinhphu.vn (HTTP 200 chỉ chứng minh trang tồn tại). **Ngoài tầm kiểm chứng → KHÔNG đưa vào proposal như dữ kiện.** Ghi: *"claim của GPT-5.6, phải để luật sư VN xác nhận."* Kết luận thực hành không đổi: đăng ký sàn là cổng bắt buộc trước khi cho bên thứ ba bán; "closed pilot 3 seller" không phải miễn trừ. §23 cần luật sư rà lại căn cứ.
- "NĐ 356/2025" — không xác nhận được, bỏ số hiệu, để luật sư điền. Luật 91/2025/QH15 hiệu lực 01/01/2026 — khớp, giữ.
- "CCCD number = basic, image = sensitive" — đúng hướng, không chốt được ranh giới. Chắc chắn hơn: **thông tin tài khoản khách hàng TCTD là dữ liệu nhạy cảm** → P0-3 là điểm tuân thủ rõ nhất, và dễ bỏ nhất vì slice đầu không cần bank.
- GPT bỏ sót: 3 migration untracked; `risk-tier.mjs --files` gộp comma; điểm mù SLO 7.

---

## Kết luận

| Phạm vi | Tier | Lý do một dòng |
|---|---|---|
| **Slice đầu** (seller application + admin review, không payment) | 🔴 **RED** | Migration không revert được + object storage ngoài backup + thu CCCD/bank là hành động một chiều |
| **Toàn plan 5 phase** | 🔴 **RED** | Thêm: cổng đăng ký sàn TMĐT chưa xác nhận, nợ vận hành vượt một người, ~30 bảng không down-migration |

### Đường mở RED xuống mức chấp nhận được (kiến nghị, quyền quyết định thuộc Cuong)

> **Slice 0′:** 2 bảng — `shops` + `shop_members`. Admin tạo shop tay cho 1-3 seller đã biết. Giấy tờ nhận qua Zalo, lưu ngoài platform. Không bucket KYC, không bank table, không upload, không form seller, không edge function mới.

Cắt được: P0-1, P0-3, P0-5, P1-3, P1-6 (5/6 P0 và 2 P1). Vẫn RED (có migration) nhưng RED **nhỏ**: reverse = 2 câu DROP TABLE, 0 PII nhạy cảm, 0 nghĩa vụ hồ sơ, ~0 KB bundle. Đo được đúng thứ Cuong muốn — seller có chịu đăng bán không — mà không đặt nền KYC cho 4 phase sau trước khi Phase 0 đóng.

Nếu Cuong vẫn muốn nguyên slice §21: P0-1 → P0-6 là điều kiện merge, không phải khuyến nghị.

---

**File liên quan:** `external/risk-auditor-gpt56-prompt.md` · `external/risk-auditor-gpt56-reply.md` · `src/hooks/useOgImageUpload.ts:40` · `supabase/migrations/20260512140000_event_payment_config.sql:121` · `supabase/tests/rls_auth_matrix.test.sql` · `supabase/functions/_shared/admin-aal.ts`
