# Vòng 5 — Code review (Bước A)

Diff review: `b0234b11..058fbe4e` (12 file, +933/−88). Review độc lập bằng Codex CLI trên toàn bộ diff + AC; tôi xác minh lại từng claim bằng đọc code trực tiếp.

## Verdict Bước A: **ĐẠT** (chờ kết quả tester ở Bước B mới chốt vòng)

## Đối chiếu từng trọng tâm

### 1. Migration `20260817090000` — ĐẠT
- `shop_public_shop`: body copy verbatim từ `20260813120000`, đúng "chỉ thêm 3 key" (`logo_path`, `cover_path`, `cover_focal_y`). Nhánh anti-enumeration (suspended trả lời y hệt không-tồn-tại) byte-identical — Codex xác nhận, tôi đối chiếu tay. 3 subselect đều lọc `public_path IS NOT NULL` — đúng security boundary vì SECURITY DEFINER bỏ RLS. Media suspended không lộ qua RPC: `shop_profile_media_revoke` (trigger khi shop rời `active`) đã `SET public_path = NULL` cùng transaction, và bản thân RPC chỉ trả `shop` khi `state = 'active'` — hai tầng.
- Commit equality-check: đúng biểu thức deterministic của prepare, đóng stale-race (v1 trễ bị từ chối sau khi seller lên v2). Không từ chối oan case chính đáng: retry cùng plan hiện tại recompute ra cùng key → idempotent (Codex xác nhận). Signature `(UUID, TEXT)` giữ nguyên — không dính bẫy overload 42725.
- DELETE cleanup jobs: đúng `(public_bucket, _public_path, state <> 'done')`, cùng transaction với flip pointer — mirror product.
- Guard `shops.state = 'active'` ở CẢ prepare lẫn commit (đóng cửa sổ prepare-rồi-suspend).

### 2. Edge fn viết lại full file — ĐẠT
- Contract action `publish` cũ KHÔNG đổi: đối chiếu từng nhánh — status 401/403/409/422/502, body `{error, media_id}`, error string, success `{ok, product_id, renditions}` khớp nguyên văn. Refactor `copyRenditionToPublic` không drift hành vi (Codex xác nhận độc lập).
- `publish_profile`: per-item copy→commit, path chỉ từ plan DB, content-type theo bytes sniff.
- **Quyết định 502 vs 200 partial: GIỮ 502.** Lý do: `supabase.functions.invoke` coi non-2xx là error → client hiện retry; retry idempotent (prepare trả lại toàn bộ row verified, item đã publish ghi đè cùng key vô hại). Đổi sang 200-partial thì client phải tự parse `failed[]` — thêm code, không thêm giá trị ở quy mô 2 item/shop. Codex đồng thuận "reasonable".

### 3. Client — ĐẠT
- Auto-publish KHÔNG bắn lặp: `onSettled` của upload target chỉ được gọi sau finalize thành công (đọc `useMediaUpload.ts` dòng ~215-223 — nhánh catch không gọi), là async callback chứ không phải effect → StrictMode không nhân đôi. Upload fail → không bắn publish.
- Retry idempotent thật (như trên). Publish fail không hiện như upload fail — copy phân biệt rõ: "Ảnh đã tải và xác minh xong — chỉ bước đưa lên trang shop bị lỗi."
- Copy trung thực: gỡ cả 2 chỗ "trang shop công khai chưa mở" (section hint + per-slot), thay bằng mô tả đúng trạng thái.
- ShopStore: banner chỉ render khi `cover_path` (không DOM khi null — layout R3 nguyên vẹn), 120px/160px, `object-fit: cover`, focal_y clamp 0-1; logo 72px thay monogram, fallback monogram giữ; dùng `publicMediaUrl` sẵn có.

### 4. 2 test cũ bị sửa — CÓ CHỦ ĐÍCH, đúng thiết kế
- `shop_phase2a_media_ordering.test.sql`: case cũ commit bằng khoá tuỳ ý nay ĐÚNG RA phải bị từ chối (AC11) — sửa thành refusal case + happy path recompute khoá deterministic. Plan 73→74 (thêm assert, không bớt).
- `scripts/shop-p2b-media-lifecycle.test.mjs`: đổi khoá tự chế sang khoá deterministic — bắt buộc vì commit giờ từ chối khoá khác. Cả hai là SIẾT contract, không phải nới.
- `shop_media_reconcile.test.sql` 17→19: thêm guard identical-expression cho arm profile (fixture 9c mid-publish không bị sweep).

### 5. Đối chiếu báo cáo coder với diff — khớp, không xanh giả
Mọi mục trong báo cáo đều có mặt trong diff. Gates tự khai (pgTAP 1457 PASS, vitest 83.28%, bundle headroom 9.1KB) nhất quán với quy mô diff; tester sẽ là bằng chứng UI thật.

## Bất đồng với Codex — 1 điểm, tôi BÁC mức nghiêm trọng

Codex verdict "Fail" vì: arm allowlist mới trong `shop_media_referenced_objects` giữ pending target của MỌI row verified bất kể shop state → kịch bản prepare → copy → shop bị suspend → commit từ chối → object nằm lại public bucket vô hạn (sweep không bao giờ xoá vì vẫn được reference).

Hiện tượng ĐÚNG, nhưng tôi hạ xuống known-limitation P3, không chặn vòng, vì:
1. **Pre-existing y hệt ở product media**: arm pending của product (migration `20260814110000`) cũng `WHERE verified_at IS NOT NULL` không xét shop state — cùng cửa sổ suspend-giữa-chừng. Code mới chỉ mirror convention đã ship; sửa riêng arm profile là lệch convention, sửa cả hai là vượt scope lệnh PO vòng này.
2. **Không phải lỗ anti-enumeration**: key chứa 2 UUID (shop_id + media_id) không đoán được từ ngoài, và chưa từng được serve ở đâu (commit đã từ chối → RPC không bao giờ trả path đó). Nội dung là ảnh chính seller đó upload.
3. **Tự lành ở 2 đường**: shop reactivate + republish → key thành live hợp lệ; seller re-upload (version bump) → key cũ rời allowlist → sweep dọn trong vài giờ.

**Đề xuất follow-up (chờ PO, migration riêng sau vòng này):** gate cả HAI arm pending (product + profile) bằng `JOIN shops s ON s.state = 'active'` — một mệnh đề, sửa đúng chỗ chung.

## Test case cho `tester` (local, coder đã seed + reseed fixture)

Lưu ý môi trường: nếu edge fn trả 400 unknown-action ở publish → edge runtime đang mount worktree cũ, phải `supabase stop && supabase start` TỪ worktree hiện tại (gotcha coder đã ghi, docker restart không đủ).

**TC1 — Seller upload logo + cover thật, tự publish.**
Route `/seller/settings` (đăng nhập seller của shop pilot). Bước: (1) mục "Logo & ảnh bìa" → slot Logo → Chọn ảnh → chọn một ẢNH THẬT (photo JPG/PNG vài trăm KB, KHÔNG dùng fixture bytes); (2) chờ upload chạy hết; (3) lặp lại cho slot Ảnh bìa với một ảnh ngang. Kỳ vọng: preview hiện trong slot; trạng thái "Đang đưa ảnh lên trang shop công khai…" xuất hiện rồi BIẾN MẤT; KHÔNG còn dòng "Đã xác minh nhưng chưa lên trang shop công khai" và không có alert lỗi; hint đầu mục là copy mới ("…hiện trên trang shop công khai sau khi được xác minh và đưa lên xong"), KHÔNG còn chữ "trang shop công khai chưa mở".

**TC2 — Trang shop công khai hiện banner + logo (logged-out).**
Route `/shop/store/<slug shop ở TC1>`, cửa sổ ẩn danh/đăng xuất. Kỳ vọng: banner ảnh bìa full-width trên đầu card header (~120px mobile / 160px ≥768px, bo góc, ảnh phủ kín không méo); logo 72px bo góc đứng chỗ monogram cạnh tên shop (KHÔNG còn monogram chữ); phần còn lại của header (h1, pill "Đã xác minh", số sản phẩm) nguyên như trước; ảnh load thật (không icon vỡ — check request ảnh 200).

**TC3 — Shop không có logo/cover → fallback nguyên trạng.**
Route `/shop/store/<slug shop khác chưa upload>` (logged-out). Kỳ vọng: monogram chữ 72px như cũ, KHÔNG có phần tử banner nào trong DOM (không khối rỗng/placeholder phía trên header), layout y hệt trước vòng 5.

**TC4 — Retry khi publish fail (SKIP nếu không tái lập được).**
Cách tái lập gợi ý: tắt edge runtime (`supabase functions serve` dừng / chặn network tới `/functions/v1/shop-media-lifecycle`) NGAY SAU khi upload xong bước finalize, hoặc upload khi edge runtime chưa chạy. Kỳ vọng khi fail: alert "Ảnh đã tải và xác minh xong — chỉ bước đưa lên trang shop bị lỗi. Bấm thử lại." + nút "Đưa lên trang shop"; khôi phục edge runtime → bấm nút → trạng thái pending rồi hết, ảnh lên `/shop/store/<slug>` như TC2. Không tái lập được thì SKIP và ghi rõ.

## Delta yêu cầu coder vòng này: KHÔNG có (không chờ sửa gì trước khi test).
