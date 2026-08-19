# Tổng kết — fix nút "Đưa lên trang shop" (publish logo/bìa shop)

**Trạng thái: ĐẠT sau 2/6 vòng. Chưa commit, chưa push, chưa PR.**
Worktree `.claude/worktrees/shop-publish-btn` · nhánh `fix/shop-publish-media-button` · base `origin/main` = `8f833e5a`.

## 1. Ý tưởng gốc → bản phân tích đã chốt

"Làm tiếp shop". Đọc `docs/proposals/shop-closed-pilot/PHASE-PROGRESS-2026-08-17.md`: Phase 0-2 xong trọn prod, P3a/P3b/P4 khoá chờ cổng PO, và **việc code duy nhất chặn Wave 1** là bug nút "Đưa lên trang shop" (logo/bìa) không chạy trên iOS Safari. Phạm vi chốt: tìm root cause thật → sửa tận gốc → để lại đường quan sát lỗi để lần sau không phải đoán.

## 2. Phản biện đã xử lý ra sao

- **critic-feasibility** phát hiện bằng chứng "anon probe → 403" trong hồ sơ cũ là **rỗng**: `index.ts:199` gộp `insufficient_privilege` / `42501 thiếu GRANT` / `PGRST202 schema cache` vào cùng một status. Đề xuất đường điều tra prod rẻ hơn local stack một bậc và **cắt** phương án `supabase db reset` (1-2 giờ, không tái hiện được schema cache/GRANT/bản deploy của prod).
- **critic-user** phát hiện luồng này **bất đối xứng**: publish ảnh sản phẩm do admin bấm sau khi duyệt, còn logo/bìa là publish **duy nhất seller tự bấm** — trong khi `verified_at` là xác minh **máy** và publish **đã tự chạy** sau upload. ⇒ nút chỉ là retry của một bước tự động, nhưng đặt tên như bước bắt buộc (3 tên cho 1 thứ trong 20 dòng). Kèm phát hiện: chọn ảnh mới **xoá logo công khai ngay lập tức**, publish hỏng ⇒ shop trắng trơn vô thời hạn.
- Cả hai **giết H1** (iOS JPEG mang APP1 bị `inspectJpeg` chặn) dựa trên câu trả lời của PO "ảnh sản phẩm publish được bằng nút" + hai nhánh dùng chung `copyRenditionToPublic`.
- **Coder lật lại bằng bytes production thật** — xem mục 4. Suy luận thua dữ liệu.

## 3. Thiết kế UI/UX

Giữ nút nhưng đổi nhãn thành **"Thử lại"** và đổi câu trạng thái sang nói **hậu quả** ("Trang shop hiện chưa có logo") thay vì quy trình nội bộ. Nút **không bao giờ bị ẩn** khi đang chạy (trước đó `isPending` render một nhánh loại trừ không có nút, không huỷ, không giới hạn thời gian) — thay bằng nút disabled + nhãn "Đang đưa lên trang shop…", và `timeout: 20_000` để không trạng thái nào treo quá 30s. Lỗi hiện **hai tầng**: câu tiếng Việt hành động được (5 nhóm) + dòng mờ `Mã lỗi: …` để seller chụp màn hình. Shop chưa `active` thì **không auto-publish** (trước đó bắn ngay → 403 → seller bấm mãi). Không component mới, không icon, không animation, 2 dòng CSS.

## 4. Root cause — chứng minh bằng bytes production

Rendition logo + bìa của shop PO là **JPEG do WebKit/ImageIO encode, mang APP1 (Exif 76 byte) + APP13 (Photoshop 3.0)**. `inspectJpeg` coi mọi APP1 là "chưa re-encode" → 422 `rendition_metadata_present` cho **cả hai** ảnh → `publishProfile` trả **502** → client ném lỗi thô.

```
/tmp/live-logo.bin  {isJpeg:true, verdict:{ok:false, reason:'metadata_present'}}  512x512
/tmp/live-cover.bin {isJpeg:true, verdict:{ok:false, reason:'metadata_present'}}  2048x1536
FFe0 "JFIF" · FFe1 "Exif\0\0MM…" · FFed "Photoshop 3.0\0 8BIM" · FFc0 · FFda
```

**Vì sao cả 2 critic tưởng H1 chết:** ảnh sản phẩm đang live trên prod là **WebP** ⇒ nhánh JPEG **chưa từng chạy thành công** qua edge function. Tiền đề sai nên kết luận sai.

**Bản sửa (ponytail, 1 chỗ, mọi caller):** `stripJpegMetadata()` trong `src/lib/shop/imagePipeline.ts`, chỉ áp cho nhánh fallback JPEG của `processImage`. Kiểm tra ở **server giữ nguyên độ chặt** (trust boundary). Sau bản sửa, chính 2 file production đó: `metadata_present` → `{ok:true}`, mất đúng 136 byte.

**Lỗ chưa giải thích được (đã ghi, không chặn ship):** cùng `processImage`, `cap` không quyết định MIME ⇒ vì sao product ra WebP mà profile ra JPEG **cùng từ một iPhone** thì không có đường code nào giải thích.

## 5. Kết quả code

**11 file thay đổi, 859+/45−** (chưa commit). Không migration, không edge function, không dependency, không file source mới.

| Vòng | Việc |
|---|---|
| 1 | root cause + `stripJpegMetadata` · `edgeErrorMessage` + 2 call site + UI 2 tầng + `reportCaughtError` · gate `shopState` · nhãn "Thử lại" · `timeout` · 2 dòng CSS |
| 2 | sửa lỗi chặn ship (`errors.ts` gác `status === 422` trong khi nhánh profile **luôn** trả 502 ⇒ lỗi ảnh thật hiện câu "lỗi hệ thống, thử lại sau vài phút" = hướng dẫn sai) · **nối dây thật**: admin kích hoạt shop → tự publish logo/bìa · 4 case test thay đường trình duyệt · 3 edge case `stripJpegMetadata` |

**Verdict vòng 2: ĐẠT 17/17 acceptance criteria, 0 sai thật.** prompt-engineer tự chạy lại 4 gate và tự dựng 4 phép thử bắt "nhận công gian": khôi phục `status === 422` → đúng 2 test đỏ; đổi gate nút sang state RAM → case "fresh page load" đỏ; gỡ `then` khỏi mock `shopFrom` → 4 test đỏ đúng 4 tên coder liệt kê. Red-proof là thật.

Gate: `lint` 0 error · `test` **2874 pass**/10 skip/0 fail · `build` ✓ · bundle **CODE 1574.2/1800 KB**, INITIAL 227.3/280.

Codex chấm CHƯA ĐẠT với 3 mục chặn ship; prompt-engineer **bác 2** bằng test chạy thật (double-click: React 18 flush discrete event đồng bộ nên 3 click cùng tick chỉ tạo 1 invoke; "test thứ tự xanh giả": có test kề bên đã phủ ca đó) và **hạ mục thứ 3** xuống backlog (race stale-closure `pendingMedia` có thật nhưng nút thử lại vẫn hiện ⇒ không kẹt, không mất dữ liệu).

## 6. Kết quả test thật

- **Vòng 1 — tester Chrome MCP: 0/8 pass, 8/8 BLOCKED** (không FAIL). Hai chặn ngoài code: không có session seller để vào `/seller/settings`; bộ tool của tester **không có tool chạy JavaScript** nên không ghi đè được `window.fetch` (`navigate javascript:` bị chặn, CDP không mở). Phát hiện phụ: worktree thiếu `.env` ⇒ app treo ở shell "Loading…" trên mọi route mà không log lỗi.
- **Vòng 2 — PO chốt kiểm chứng bằng test component thay browser.** Phủ trọn S3/S4/S5 + timeout + đường admin bằng vitest+jsdom chạy đúng component/hook production. **Không** phủ được: layout/tap target iPhone, hành vi thật của Safari WebKit khi encode JPEG, độ trễ mạng thật.

## 7. Việc Cuong phải tự làm

1. **Xoá auth user rác trên prod** (agent vòng 1 tạo khi điều tra, classifier chặn không xoá được):
   `delete from auth.users where id = '0bbe10dc-b091-41f5-a448-473e3c997d99';`
   Tiện thể: `select proname, pronargs, proacl::text from pg_proc where proname like 'shop_profile_media_publish%';`
2. **🔴 Dữ liệu tồn đọng — làm TRƯỚC Wave 1.** Bản sửa nằm ở **client lúc upload**, nên mọi rendition JPEG đã vào draft bucket **trước** bản này vẫn còn EXIF ⇒ bấm thử lại là fail **vĩnh viễn**. 3 câu SQL đếm/kiểm nằm ở `rounds/round2-verdict.md` §6(b). Cách rẻ nhất: bảo seller **chọn lại đúng tấm ảnh đó** và upload lại (Wave 0 chỉ 1 shop = 1 tin nhắn Zalo). Đừng "publish lại cho chắc" — byte không đổi thì kết quả không đổi.
3. **Nghiệm thu thật trên iPhone Safari sau khi lên production** (tiêu chí gốc số 8, chưa ai đo): `/seller/settings` → chọn ảnh mới từ thư viện iPhone → kỳ vọng publish tự chạy, không dòng đỏ → mở `/shop/store/<slug>` tab ẩn danh xem ảnh thật. Nếu lỗi thì **chụp cả dòng `Mã lỗi:`** — nó tự khai loại lỗi.
   **Và kiểm cả đường admin mới nối:** `/admin` → hồ sơ `pending_activation` đã có logo verified → "Kích hoạt shop" → ảnh phải tự lên. Ca hỏng nguy hiểm nhất ở đây **im lặng**: nếu admin không đọc được `shop_profile_media` thì không nút, không lỗi.
4. **KHÔNG cần deploy edge function** — xác nhận bằng lệnh: `git status --porcelain -- supabase/` rỗng, `git diff --stat -- supabase/` rỗng. Chỉ merge + để Cloudflare Pages deploy.
5. **Review diff trước khi merge** (`git diff` trong worktree) rồi tự quyết commit/push.

## 8. Backlog ghi lại

Race `pendingMedia` (đọc row tại thời điểm gọi thay vì boolean chụp lúc render) · `reportCaughtError` cho lỗi publish phía admin · dòng `Mã lỗi:` ở trang admin · siết 2 assertion "clears the line when it works" · defect "một plan shop-wide vs hai nút" (bìa hỏng làm nút logo báo lỗi) · confirm trước khi thay ảnh + copy nói rõ "trang shop mất logo ngay" · badge "đang/chưa hiển thị" · link "Xem trang shop của tôi" · comment sai trong `supabase/functions/**` ("a canvas-encoded JPEG carries no APP1") · Playwright spec cho shop (cần seller test user, role seller trong `tests/helpers/auth.ts`, `PLAYWRIGHT_BASE_URL` trỏ localhost — mặc định hiện **trỏ production**).

## 9. Audit trail

`docs/build-feature/shop-publish-media-button/` — `00-idea.md` · `01-task-analysis.md` · `02-po-answers.md` · `02-critic-feasibility.md` · `02-critic-user.md` · `02-final-analysis.md` · `03-ux-spec.md` · `rounds/round{1,2}-{prompt,coder-report,code-review,test-report,verdict}.md` · `rounds/round1-report.md` (bằng chứng byte thô).
