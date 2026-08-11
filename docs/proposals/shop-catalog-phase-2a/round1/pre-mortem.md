# Pre-mortem — shop-catalog-phase-2a

> Nguyên văn output agent `pre-mortem`, 2026-08-11. Đọc worktree sạch @ `1fac6b4f`.

## Sự cố 1 — "Toàn bộ URL sản phẩm và cả 3 URL shop của pilot sai chính tả vĩnh viễn; Cuong phát hiện sau 5 tuần khi tình cờ mở sitemap"

**Xác suất:** RẤT CAO (bug đã tồn tại trong code đã commit — agent đã chạy và xác nhận)
**Thời gian tới lúc phát hiện:** 4–6 tuần, và chỉ vì tình cờ

### Timeline
- T+0: Phase 2a nối `products.slug` vào `shop_slug_from_name()` đúng như recon chỉ định ("Slug precedent"). Làm đúng lệnh "extend, don't reinvent" thì hỏng.
- T+0: 3 shop pilot tạo qua `shop_application_decide()` (`20260811090000...sql:596-605`). Slug sinh ngay lúc duyệt.
- T+2 ngày: "Đồ Pickleball Sài Gòn" → `/uo-pickleball-sai-gin`. "Thể thao Hùng Cường" → `the-thao-hong-cuong`. "Đại lý Pickleball Miền Tây" → `uai-lu-pickleball-mien-tay`.
- T+1 tuần: ~40 sản phẩm. "Vợt Đỉnh Cao 16mm" → `vot-uinh-cao-16mm`. Không ai để ý vì **một slug sai vẫn trông như một slug**.
- T+3 tuần: sitemap đẩy vào Google. Facebook group nhận link đã share.
- T+5 tuần: Cuong mở sitemap vì việc khác, đọc `uo-pickleball-sai-gin`, tưởng lỗi encode.

### Cơ chế
`20260811090000...sql:526-537` — `unaccent_immutable()` dùng `translate()` với hai chuỗi **lệch độ dài**: `from` 134 ký tự, `to` **140**. `translate()` ánh xạ **theo vị trí** → dư 1 ký tự `a` ở nhóm đầu làm toàn bộ phần sau trượt.

| ký tự | ra | đúng |
|---|---|---|
| `è` | `a` | e |
| `ì` | `e` | i |
| `ò` | `i` | o |
| `ù` | `o` | u |
| `ỳ` | `u` | y |
| `đ` | `y` | d |
| `Đ` | `U` | D |
| `À` | `y` | A |

Chuỗi hợp thành gồm **ba thứ vô hại riêng lẻ**: (1) bảng translate gõ tay, (2) chỉ thị "tái dùng precedent" hợp lý, (3) pilot toàn tên tiếng Việt có dấu — khác hẳn mọi fixture trong repo.

### Vì sao mọi gate vẫn xanh
- `shop_phase1_rls.test.sql:60` — fixture `'Shop Cua A'`, **ASCII không dấu**. Không assertion nào đọc `slug`; assertion duy nhất chạm slug là `:106` với chuỗi hardcode `'tu-tao'`. **Kể cả khi 24 pgTAP được chạy lần đầu, nó vẫn xanh.**
- `scripts/proto-shop-qa.mjs:310` — duyệt URL hardcode. Slug fixture do người viết tay, không do DB sinh. Gate này về bản chất không thể thấy bug DB.
- TypeScript/ESLint: bug nằm trong SQL.
- Panel review: ai cũng gật khi thấy "một bảng translate tiếng Việt". Không ai đếm 134 vs 140 bằng mắt.

### Ai báo
**Không ai.** Người bán không biết slug lẽ ra phải là gì. Người mua bấm link từ Facebook, link chạy. Google index bình thường (200, có nội dung). Không exception, không alert, không log.

### Vì sao khó sửa
1. Sửa hàm 1 dòng; sửa **dữ liệu** thì không — `shops.slug` bị trigger ghim (`:214` `NEW.slug := OLD.slug`). Người bán **không tự sửa URL shop của mình được**.
2. Slug đã công khai: đã index, đã share, đã ở sitemap. Đổi = 404 hàng loạt, trừ khi có bảng redirect 301 (ngoài phạm vi 2a).
3. Vòng chống trùng `:598-601` làm tệ hơn: bảng translate gộp nhiều chữ về cùng ký tự → xác suất đụng tăng → thêm hậu tố `-1`, `-2` vô nghĩa vĩnh viễn.

### Dấu hiệu sớm lẽ ra phải có
Một assertion pgTAP một dòng. Không tồn tại vì cả 24 assertion nhắm vào **quyền**, không nhắm vào **tính đúng của dữ liệu sinh ra**. Repo đã có `slugify()` đúng ở `src/lib/social/slug.ts:17-31` (dùng `normalize("NFD")`) — bản DB là cài đặt thứ hai, tự viết, không ai đối chiếu.

---

## Sự cố 2 — "Catalog công khai vô hình với Googlebot suốt 3 tuần; mọi link sản phẩm dán lên Facebook đều hiện thẻ trống"

**Xác suất:** CAO · **Phát hiện sau:** 3 tuần, và bị quy sai nguyên nhân

### Timeline
- T+0: route `/shop/...` lên prod. Người thật mở: đẹp, đúng, đã qua Q01.
- T+0: `functions/_middleware.ts:524` phân luồng theo `BOT_UA`. Googlebot/facebookexternalhit/zalo/telegrambot đều khớp (`functions/_lib/utils.ts:336-337`).
- T+0: bot vào `routeAndRender()` (`:719`). Không nhánh nào khớp `/shop/*` → `:917` `render404()` → **HTTP 404 + noindex** cho mọi trang sản phẩm.
- T+2 ngày: người bán dán link vào group. Facebook crawl → 404 → thẻ trống. Người bán nghĩ "Facebook chặn link shop". **Không ai báo cho Cuong.**
- T+3 tuần: Cuong hỏi "sao chưa thấy sản phẩm trên Google", chạy `curl -A "Googlebot"`, thấy 404.

### Cơ chế
`_middleware.ts:719-917` — bảng route thủ công liệt kê từng họ URL. `/shop` không có mặt → catch-all `render404` ở `:917`.

Hai thứ làm nó **im lặng tuyệt đối**:
- `:622` — chỉ `status === 200` mới ghi KV. 404 không cache → không có artefact để soi.
- `:676-700` — telemetry chỉ bắn khi render **lỗi/timeout**. `render404` là đường **thành công**. Zero alert.

### Vì sao mọi gate vẫn xanh
Đau nhất: repo **có** test kiểm tra noindex, và nó chỉ kiểm tra **một chiều**.

`shop-production-isolation.test.ts:89-95` assert `/seller` **có** trong `NOINDEX_PATTERNS` và robots. **Không có assertion đối xứng** kiểm tra bề mặt công khai **được** index. `public/robots.txt:18-21` chặn `/seller`, `/shop/sell`, để `/shop` mở — robots hoàn toàn đúng, nên nhìn robots sẽ thấy "ổn rồi". Cái sai ở tầng khác, tầng không có test.

`proto-shop-qa.mjs` chạy `localhost:8080/proto/shop/*` bằng Chromium UA thật — **không bao giờ đi vào đường bot**, vì đường bot chỉ tồn tại ở Pages Functions, không tồn tại ở Vite dev. Gate này **về mặt kiến trúc không thể chạm** `_middleware.ts`.

Tái phát bài học đã có trong memory: *"gate chỉ đo nhánh Googlebot = mù nửa sản phẩm"* — lần này lật ngược.

### Vì sao khó sửa
Sửa code dễ. Nhưng 3 tuần Googlebot nhận 404 là **tín hiệu chủ động rằng URL không tồn tại**. Crawl budget cho path family mới bị 404 lặp thì thấp. Thẻ Facebook đã share nằm trong cache tới khi chạy Sharing Debugger từng URL.

### Dấu hiệu sớm lẽ ra phải có
`curl -A "Googlebot" $PREVIEW/shop/<slug>` phải trả 200 và grep thấy tên sản phẩm. Repo **đã biết cách** — CLAUDE.md mô tả đúng quy trình cho blog kèm bài học 2026-08-05 ("tag đẹp, bài rỗng"). Không ai áp nó cho bề mặt mới.

---

## Sự cố 3 — "Ảnh sản phẩm mang toạ độ GPS nhà riêng của 3 người bán, công khai suốt pilot; không ai phát hiện"

**Xác suất:** TRUNG BÌNH-CAO · **Phát hiện sau:** không giới hạn

### Timeline
- T+0: media upload copy hook có sẵn. Bucket `shop-media` theo khuôn `20260512160000_clubs_self_service.sql:100-110`: `public = true`.
- T+1 ngày: người bán `ca-nhan` chụp vợt bằng iPhone **tại nhà**, upload.
- T+1 ngày: file đẩy **nguyên xi** — `useClubLogoUpload.ts:60-66` gọi `.upload(path, file, { cacheControl: "31536000" })` với đúng `File` gốc. Không canvas, không re-encode. **EXIF nguyên vẹn, gồm `GPSLatitude`/`GPSLongitude`.**
- T+1 ngày: `getPublicUrl()` (`:71-73`) → URL vĩnh viễn, không hết hạn, không token.
- T+2 tuần: ~120 ảnh. Ba nhà riêng ở SG/HN/Cần Thơ nằm trên internet với toạ độ ~5m.
- T+?: **không ai phát hiện.**

### Cơ chế — bốn quyết định đúng riêng lẻ
1. `20260512160000...sql:113-117` — policy `FOR SELECT USING (bucket_id='clubs-logos')`, **không mệnh đề `TO`** → anon đọc. Đúng cho logo CLB.
2. `useClubLogoUpload.ts:54-66` — upload raw file. Đúng cho logo thiết kế trên máy tính (không EXIF GPS).
3. recon: **mọi bucket đều `public: true`, ZERO `createSignedUrl` toàn repo**. Không tiền lệ private để copy.
4. 2a là **lần đầu** ảnh cá nhân chụp bằng điện thoại tại chỗ ở trở thành nội dung công khai.

Không cái nào là bug. **Giao điểm của cả bốn** mới là sự cố.

### Vì sao mọi gate vẫn xanh
- `proto-shop-qa.mjs` đo tràn ngang/cuộn/44px/axe/chuỗi VI dài/trạng thái lỗi. Không có khái niệm "nội dung file upload".
- pgTAP đo policy trên `public.*`. `storage.objects` không nằm trong test; metadata bên trong file thì SQL không nhìn thấy.
- Panel đọc migration thấy `public: true` + policy SELECT mở → gật, vì catalog **phải** công khai. Câu hỏi đúng không phải "ảnh có nên công khai" (có) mà **"trong ảnh có gì ngoài ảnh"** — không ô nào trên checklist hỏi câu đó.

### Vì sao khó sửa
- `cacheControl: "31536000"` = 1 năm. Mỗi trình duyệt giữ bản gốc.
- `vite.config.ts:218-222` — SW cache `supabase-storage`, 200 entry, **30 ngày**. Xoá trên server không gỡ được bản trong máy người dùng.
- `upsert: false` (`:64`) → không ghi đè cùng URL được; phải upload path mới. **URL cũ vẫn sống.**
- Bucket public + không robots trên domain supabase.co → nếu đã bị crawl thì không thu hồi.
- Pilot đã hứa **không thu CCCD, không thu bank** như cam kết riêng tư. Công bố toạ độ nhà riêng phá đúng lời hứa đó, bằng đường vòng không ai nghĩ tới.

### Dấu hiệu sớm lẽ ra phải có
5 dòng trong hook: `createImageBitmap` → `canvas.toBlob` trước upload — cũng giải quyết luôn HEIC + kích thước. Và một assertion: upload JPEG fixture có EXIF GPS, đọc lại, assert không còn marker `0x8825`.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| 1 | Slug tiếng Việt sai vĩnh viễn | **Gần như chắc chắn** — đã verify | Tối đa: không alert, không lỗi | **P0** |
| 3 | EXIF GPS trong ảnh public | Trung bình-cao | Tối đa: **không triệu chứng nào** | **P0** |
| 2 | Bot nhận 404 toàn catalog | Cao | Cao, nhưng có triệu chứng bị quy sai địa chỉ | **P1** |

1 xếp trên 3 vì **không thể phục hồi** (URL đã công khai, người bán bị trigger chặn). 2 xếp cuối vì `git revert` + một nhánh route sửa được thật.

## Rẻ nhất để chặn từ bây giờ
1. **Một assertion pgTAP ba dòng** — `SELECT is(public.shop_slug_from_name('Đồ Pickleball Sài Gòn'), 'do-pickleball-sai-gon', ...)`. Đỏ ngay hôm nay. **Assertion trước, sửa sau** — cái đắt là biết mình sai.
2. **Một dòng curl trong CI** — đảo chiều assertion đã có: bề mặt công khai **phải** index được.
3. **Năm dòng trong hook upload** — canvas re-encode trước `.upload()`. Không thêm dependency.

## Khoảng hở pipeline bài này lộ ra
- **Không gate nào chạy trên đường bot của Pages Functions.** `_middleware.ts:719-917` là bảng route thủ công 200 dòng; không test nào assert "route family X có handler". Gate mù thứ ba cùng loại P9 và P12 §11.
- **Toàn bộ 24 assertion Phase 1 kiểm tra QUYỀN, không cái nào kiểm tra TÍNH ĐÚNG.** Fixture cố tình ASCII trong sản phẩm 95% người Việt. "Verified locally" là **cảm giác an toàn sai**.
- **Prototype gate đo một ứng dụng khác.** Không chạm DB, storage, middleware. Verdict cần ghi rõ: *proto-shop-qa xanh không nói gì về production.*
- **Bonus cùng họ:** cả hai trigger guard (`:203-220`, `:346-366`) **âm thầm ghim giá trị cũ thay vì RAISE** — test repo mô tả bằng `lives_ok(...)` ở `:69-72`. Nếu UI moderation 2a dùng `.update()` trực tiếp và phiên admin rớt xuống aal1, admin bấm "Duyệt" và nhận **HTTP 200 + 0 dòng đổi**, kèm toast thành công. Fixture hardcode `"aal":"aal2"` ở `:177` nên không test nào đi nhánh aal1. **Yêu cầu: mọi chuyển trạng thái sản phẩm đi qua RPC, hoặc UI phải assert giá trị trả về.**
