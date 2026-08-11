# shop-catalog-phase-2a — production catalog cho Shop marketplace

**Ngày:** 2026-08-11 · **Base:** `433610ae` · **Nhánh:** `feat/shop-production-phase-2a`
**Panel:** idea-recon · solution-architect · ui-ux-critic (+GPT-5.6) · risk-auditor (+GPT-5.6) · pre-mortem

> **Đã reconcile theo D1–D4** (Product Owner ký 2026-08-11). Bản gốc của tài liệu
> này viết trên base `1fac6b4f` và mở 4 câu hỏi; cả 4 đã được trả lời. Nguồn sự
> thật về phạm vi là `docs/proposals/shop-marketplace/production-implementation-map.md`
> **§11**. Bản trước khi reconcile giữ ở nhánh `backup/shop-production-phase-2a-pre-d1-d4`
> (`3fbea8a5`). Audit trail thô (`round1/`, `external/`, `debate.json`, `00-intake.md`)
> giữ **nguyên văn** — đó là biên bản, không phải quyết định.

---

## 0. Bốn quyết định — ĐÃ CHỐT

| | Câu hỏi khi panel về | Quyết định của Product Owner |
|---|---|---|
| **D1** | Bucket ảnh public hay private? | **Hybrid.** Original / draft / pending / rejected = **private**. Chỉ sản phẩm đã duyệt + publishable mới có **approved rendition public**, phục vụ PDP/CDN qua đường dẫn riêng. Không signed URL cho ảnh đã publish (hỏng cache + SEO). Unpublish/reject/suspend phải làm rendition **hết truy cập được**. Người bán không thể tự publish bằng cách sửa path hay status. Giấy tờ người bán và file kiểm duyệt: **không bao giờ** public. |
| **D2** | PDP có đường liên hệ shop không? | **Có** — CTA "Liên hệ shop", nhưng chỉ hiện các kênh công khai do người bán **chủ động khai** và admin **duyệt**. Không lộ email/SĐT tài khoản. Kênh có trạng thái active/approved, admin vô hiệu hoá được. Link sanitize + báo rời ThePickleHub. **Không PII trong URL**. Không giả lập chat nội bộ. Phase 2 = discovery/lead-gen; giỏ + thanh toán vẫn Phase 3. |
| **D3** | UI kiểm duyệt trong 2a hay P2b? | **P2b.** Implementation map thắng brief. 2a **không** dựng Admin moderation UI, **không** dựng public discovery/PDP. 2a **vẫn phải** dựng moderation state machine, guarded transition primitives, RLS và pgTAP để P2b dùng lại. |
| **D4** | Ngân sách bundle? | Prototype **giữ** trong repo (source + test + chạy được) nhưng **ra khỏi production artifact** bằng build-time flag, loại ở compile time chứ không ẩn ở runtime. Backstop **giữ 1970 KB**, không nâng. |

**D1–D4 đã thi hành xong trước khi 2a viết dòng nào:**

| Việc | Commit | Kết quả đo thật |
|---|---|---|
| Ghi D1–D4 + gỡ mâu thuẫn P2a/P2b | `4d05aee6` | map §11 |
| Contrast token layer + gate tự động | `aed296ab` | 24 fail → **64/64 pass** |
| Tách prototype khỏi artifact | `8b329622` | 2055.5 → **1927.8 KB gz**, 457 → 404 chunk, `BUNDLE_STRICT=1` **exit 0** |
| `log_audit_event` ambiguous | `a4bcf26f` | luồng duyệt hết nổ 42725 |
| Slug tiếng Việt | `433610ae` | `Đồ Pickleball Sài Gòn` → `do-pickleball-sai-gon` |

**Headroom thật cho toàn bộ 2a: 42.2 KB gz** (không phải 21.7 — con số cũ đo trước
khi contrast fix và trước khi tách prototype). Vượt 1970 thì: bundle attribution →
soát eager import → lazy theo route → tái dùng primitive thay vì thêm dependency →
tìm chỗ tách/giảm → vẫn đỏ thì **dừng và báo delta chính xác**. Không tự sửa budget.

---

## 1. Verdict

| | |
|---|---|
| **Rủi ro** | 🔴 **RED** (2a.1 migration · 2a.2 media) · 🟡 AMBER (2a.3) |
| **Khuyến nghị** | **Option B** — catalog trước, hàng đợi kiểm duyệt sau (D3 đã chốt đúng hướng này) |
| **Rủi ro lớn nhất** | Người bán đăng ảnh vi phạm, anh bấm "gỡ" — **ảnh vẫn sống**: admin không có policy xoá object của người khác, KV giữ bản 200 thêm 6h, PWA giữ ảnh 30 ngày, native giữ 1 năm. D1 biến cái này thành yêu cầu bắt buộc: thu hồi rendition phải làm ảnh **hết truy cập được**, và phải có test chứng minh. |
| **Auto-merge** | **Chặn** — RED |

---

## 2. Trạng thái Phase 1

Docker + Supabase CLI có sẵn nên pgTAP của Phase 1 chạy **lần đầu tiên** và lộ 2 bug
production (`a4bcf26f`, `433610ae` — bảng ở §0).

Từ 2026-08-11, bằng chứng "database sạch" **không** còn là `supabase start`. Quy trình
bắt buộc: `supabase db reset` → xác nhận toàn bộ migration đã áp → chạy toàn bộ pgTAP
→ ghi số assertion → báo cáo phải nói rõ database được dựng thế nào.

Đo trên **checkout sạch chỉ-tracked** (worktree `.claude/worktrees/shop-p2a`, không có
3 migration untracked của phiên khác):

- **334/334** migration tracked đã áp (ledger khớp số file)
- toàn suite pgTAP: **22 file, 500 assertion, PASS**
- Phase 1: **35/35 PASS**

Trạng thái Phase 1: **`security verified locally and reproducible from tracked checkout`**.

---

## 3. Thiết kế chốt (không đổi giữa các phương án)

**SKU:** `UNIQUE (shop_id, upper(btrim(sku))) WHERE sku IS NOT NULL AND sku <> '' AND status <> 'archived'`. Global thua nghiệp vụ (shop B không lưu được mã shop A đã dùng, và lỗi không giải thích được). Per-product cho phép một shop có 2 sản phẩm cùng mã — đúng tình huống quét mã lấy nhầm hàng.

**Slug sản phẩm phải unique TOÀN CỤC** (ngược với SKU) vì route là `/shop/product/:slug`, không có shop segment. Unique `(shop_id, slug)` → 2 shop cùng slug → `.single()` trả 406 `PGRST116`.

**Còn/hết hàng:** guarded UPDATE `WHERE id=? AND in_stock=_expected`, 0 dòng = có người đổi trước. Không phải read-client-write — điều kiện nằm trong `WHERE`. Không cần RPC. `in_stock` **không** bị guard trigger ghim: người bán tắt hàng 11h đêm không được rơi vào hàng chờ duyệt.

**Giá và tồn kho luôn ở variant.** Sản phẩm không tuỳ chọn vẫn sinh đúng 1 dòng variant → Phase 3 chỉ tham chiếu `variant_id`, không rẽ nhánh. `product_variants.id` phải là **UUID ổn định** để `orders` giữ được snapshot giá/tên lúc mua.

**FK phức hợp thay trigger:** `products UNIQUE (id, shop_id)` + `product_variants FOREIGN KEY (product_id, shop_id) REFERENCES products(id, shop_id)`. Postgres tự bảo đảm `shop_id` trung thực.

**Ảnh — mô hình D1.** Hai bề mặt, không phải một:

- `product-media-draft` **private**: mọi original + mọi ảnh của sản phẩm chưa duyệt. Người bán đọc/ghi trong folder scope `auth.uid()`; đường dẫn random; `upsert:false`.
- `product-media` **public**: chỉ approved rendition của sản phẩm đã duyệt + publishable. Ghi **chỉ** bằng server-side transition, không bao giờ bằng client.
- Ràng buộc kỹ thuật ui-ux-critic nêu và không agent nào khác thấy: `optimizeImageUrl` là transform CDN của Supabase và **chỉ chạy trên bucket public** — nên rendition đã duyệt phải public thì PDP mới có ảnh tối ưu (site đang có CLS p75 ~0.67). Hybrid của D1 giữ được cả hai: draft kín, ảnh đã duyệt vẫn qua CDN transform.
- Repo hiện có **0 `createSignedUrl`** → đọc ảnh draft trong trang người bán là net-new; đó là chi phí đã biết của D1, không phải phát sinh.
- Test bắt buộc: đoán path, truy cập chéo shop, ảnh chưa publish, và người bán tự ghi vào prefix public.

---

## 4. Phải sửa trước khi 2a viết dòng nào

| # | Việc | Bằng chứng | Trạng thái |
|---|---|---|---|
| 1 | **`is_shop_member()` mù vai trò** — `support`/`fulfillment` thoả `shops_update_owner`. Tái dùng cho `products` = nhân viên hỗ trợ đổi giá/gỡ ảnh qua PostgREST. Trái `plan:681` | `20260811090000...sql:191-195` | **CÒN MỞ** — sửa trong 2a.1 |
| 2 | **Contrast light mode FAIL** — stock-ok 1.99:1, used 1.99:1, danger 3.65, warn 4.14, verified 4.46, `--tl-fg-4` 3.96 | đo trên `the-line.css` + `shop.css` | ✅ **XONG** `aed296ab` — sửa ở tầng token, gate `src/styles/__tests__/contrast.test.ts` 64/64 |
| 3 | **Trigger guard âm thầm ghim thay vì RAISE** — nếu UI duyệt dùng `.update()` và phiên admin rớt aal1, admin bấm "Duyệt" nhận **HTTP 200 + 0 dòng đổi** kèm toast thành công | `:203-220`, `:346-366`; test dùng `lives_ok` ở `:69-72`, fixture hardcode aal2 ở `:177` | **CÒN MỞ** |
| 4 | **Không gate nào chạy trên đường bot Pages Functions.** `_middleware.ts:719-917` là bảng route thủ công; ship route public mà quên renderer = Googlebot nhận 404 trong khi SPA hoàn hảo | pre-mortem sự cố 2 | **CÒN MỞ** — chạm vào ở P2b (public discovery), không phải 2a |
| 5 | **EXIF GPS.** Upload raw `File` → toạ độ nhà riêng người bán lên internet vĩnh viễn (cache 1 năm + SW 30 ngày + `upsert:false`). ~5 dòng canvas re-encode chặn được, và giải quyết luôn HEIC + 8MB | `useClubLogoUpload.ts:60-66`, `vite.config.ts:218-222` | **ĐÃ ĐÓNG cho đường Shop** (bước 6) — canvas re-encode sang WebP, chứng minh trên byte thật trong QA. `useClubLogoUpload.ts` (đường CLB, ngoài Shop) **VẪN CÒN MỞ** |

---

## 5. Increments — theo thứ tự Product Owner chốt

1. **Catalog schema / state machine / RLS / pgTAP** — 4 bảng, 2 enum, seed danh mục, policy + GRANT block + guarded transition + RPC. ≥30 assertion, negative-first, đỏ-trước-xanh-sau.
2. **Private draft media + approved public rendition** (D1) — 2 bucket, policy, thu hồi rendition khi unpublish/reject/suspend, test 4 hướng tấn công ở §3.
3. **Seller shop profile**
4. **Seller product list / create / edit**
5. **Variants / SKU / inventory**
6. **Media upload** — canvas re-encode (EXIF + HEIC + 8MB) trước khi lên.
7. **Preview + submit-for-review** — preview phải dùng **đúng component PDP qua đúng phép chiếu công khai**.

Mỗi mục một commit riêng hoặc một vertical slice nhỏ.

> **Trạng thái 11/08/2026 — cả 7 bước đã xong.**
> `P2a implementation complete, verified locally, pending Product Owner
> acceptance and deployment approval.` Chi tiết, bằng chứng test, phạm vi hoãn
> sang P2b và điều kiện trước khi deploy: [completion.md](./completion.md).
> **Chưa deploy, chưa merge, chưa áp migration lên remote.**

**Không làm trong 2a:** Admin moderation UI · public discovery/PDP · P2b · giỏ · checkout · thanh toán · Phase 3.

**Điểm dừng-và-nhìn sau bước 6:** pilot nhập bao nhiêu sản phẩm sau 14 ngày; bao nhiêu bị "yêu cầu sửa" (nếu 0 thì UI duyệt ở P2b đang gác một hàng đợi rỗng); người bán có nhập nổi biến thể trên điện thoại không.

---

## 6. Chỗ hai model độc lập đồng ý (tín hiệu thật)

Claude và GPT-5.6 tự đi tới cùng kết luận, không mồi nhau:

- Không giữ `stock = null` làm trạng thái thứ ba — `in_stock BOOLEAN NOT NULL DEFAULT true`
- Thay cảm giác khan hiếm bằng **`availability_updated_at`**, nói rõ *shop* cập nhật chứ không phải nền tảng xác minh — **cả hai tự nghĩ ra cùng giải pháp**
- Trạng thái upload per-file; file thành công không bao giờ mất vì file khác lỗi; lỗi quá dung lượng **không có** nút "Thử lại"
- Sản phẩm đang bán **không được biến mất** khi người bán sửa
- Preview phải dùng **đúng component PDP qua đúng phép chiếu công khai**
- **Không** bật lại `ChatFAB` trên `/shop`
- MIME/size limit đặt ở **bucket** thì Storage REST không bypass được (GPT sửa một over-claim của risk-auditor)

> Lưu ý về CTA: GPT-5.6 phản đối đường liên hệ ở 2a vì "mọi nhãn liên hệ đều hứa việc
> 2a không làm được". D2 giữ CTA nhưng cắt đúng chỗ GPT lo: chỉ kênh người bán tự khai
> và admin duyệt, nói rõ người dùng rời ThePickleHub, không giả lập chat nội bộ. CTA
> thuộc **P2b** (cùng PDP), không phải 2a.

---

## 7. Tranh luận

Xem `debate.json`. **Vòng 2 KHÔNG chạy** — cả 4 bất đồng là quyết định sản phẩm/ngân sách
thuộc về Product Owner, không phải tranh chấp dữ kiện mà đối chất giữa agent giải quyết
được. Đây là **sai lệch có chủ ý** so với Bước 5 của skill, và Product Owner đã xác nhận
chấp nhận lý do, tự ký D1–D4 thay vì yêu cầu chạy lại.

Lưu ý về trọng lượng: `risk-auditor` và `pre-mortem` đồng ý nhau nhiều, nhưng **hai Claude
cùng nhiệm vụ "đi tìm cái hỏng" đồng ý nhau chỉ chứng minh chúng cùng là Claude**. Sự đồng
thuận có nghĩa duy nhất là ở mục 6.

**Lỗ hổng tooling (ghi backlog, KHÔNG tự dựng framework trong Phase 2):**
`scripts/agents/ask-model.mjs` và `scripts/agents/debate-ledger.mjs` **không tồn tại**
trong repo — agent phải tự chế đường gọi GPT-5.6, và ledger không cưỡng chế được. Ghi
nhận lần thứ hai (lần đầu ở `/idea` shop-marketplace 09/08).
