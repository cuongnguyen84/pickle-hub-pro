# ui-ux-critic — round 1 (nguyên văn, 2026-08-09)

> **Panel:** Claude (Opus 5) + GPT-5.6 (`gpt-5.6-sol`, 137s, 23.093 ký tự).
> Prompt và reply nguyên văn: `external/ui-ux-critic-gpt56-prompt.md` · `external/ui-ux-critic-gpt56-reply.md` (+ `.meta.json`).
> **Lưu ý quy trình:** `scripts/agents/ask-model.mjs` KHÔNG còn tồn tại trong repo (thư mục `scripts/agents/` chỉ còn `risk-tier.mjs`, `soak-watch.mjs`). Tôi gọi thẳng OpenAI API với cùng system prompt và cùng model, ghi meta.json theo đúng schema các proposal trước. Nếu `/idea` còn phụ thuộc script này ở chỗ khác thì nó đang gãy câm.

## Đánh giá tổng thể

Plan này viết rất chắc về *pháp lý, dữ liệu, RLS, state machine* — phần đó không cần tôi. Nhưng phần trải nghiệm thì nó thiết kế cho một sàn có hàng nghìn seller lạ cần sàng lọc, trong khi thực tế Cuong có 1-3 seller quen và thước đo là "seller chịu đăng bán". Kết quả: slice §21 bắt seller quen đi qua 7 bước KYC + ngân hàng để nhận về **một gian hàng rỗng không đăng được gì** — không có bề mặt nào trong slice này có thể làm kim đo pilot nhúc nhích. Ngoài ra có ba lỗ kỹ thuật-UX cụ thể mà plan không thấy: seller mở link Zalo/Messenger sẽ **không đăng nhập được**, ảnh CCCD sẽ **nằm lại 30 ngày trong Cache Storage**, và `/admin/news` — mẫu moderation gần nhất — **không có error state**, sao chép nguyên xi thì hàng đợi lỗi trông y hệt hàng đợi rỗng.

---

## Luồng người dùng thật (không phải luồng trong §6)

```
Cuong nhắn Zalo/Messenger cho chủ shop quen
  → chủ shop bấm link TRONG in-app browser của Zalo/FB
  → [ĐỔ VỠ] /login chỉ có Google OAuth / Apple OAuth / email+password
  → nếu qua được: /seller
  → thấy gì? (slice §21: một shop rỗng, 0 hành động)
  → thoát, quay lại Facebook page của chính họ để bán tiếp
```

So sánh với đường thoát của họ: đăng ảnh + số điện thoại lên group Facebook = 0 bước onboarding. Mọi thứ ta thêm vào phải trả giá bằng đường đó.

Điểm ra (exit) đúng phải là: **seller đăng xong sản phẩm đầu tiên và nhìn thấy nó**. Bất kỳ slice nào kết thúc trước điểm đó đều không đo được gì.

---

## Blockers

### B1 — Slice §21 kết thúc trước điểm đo pilot ⇒ ship xong vẫn không biết gì
**Cả hai độc lập đồng ý** (GPT reply dòng 92: *"If product creation is genuinely outside this slice, the success metric cannot yet be tested"*).

Plan §20 đặt exit của Phase 1 là "one approved seller can publish one real product", nhưng §21 (PR đầu) lại chốt "Do **not** include products". Cộng với intake mục 3 ("seller thật chịu đăng bán — số shop được duyệt + số sản phẩm thật được đăng"), ta được một PR đầu tiên đo được đúng một nửa của chỉ số, và là nửa vô nghĩa: `shops` row do chính Cuong tạo ra không chứng minh điều gì.

**Sửa:** đổi nội dung slice 1 thành:
1. `shops` + `shop_members` + audit (giữ nguyên, server-authorized theo §0).
2. Admin tạo shop trực tiếp cho user đã có tài khoản (form 4 trường + confirm hiển thị email/tên user khớp).
3. **Product editor tối thiểu** cho seller: tên, giá VND, 1–3 ảnh, tồn kho, mô tả ngắn, trạng thái `draft`/`published`. Không variant, không category attributes, không moderation queue sản phẩm.
4. Trang `/seller` liệt kê sản phẩm của shop mình. **Chưa có catalogue công khai** — buyer chưa thấy gì.

Bỏ hẳn `seller_applications`, `seller_application_documents`, admin application queue khỏi PR đầu. Diff nhỏ hơn plan §21 mà lại chạm được kim đo.

### B2 — Form 7 bước sai artifact; bank (bước 3) và CCCD (bước 4) là nơi seller quen sẽ bỏ
**Cả hai độc lập đồng ý** về việc cắt.

Hai dữ kiện trong chính repo này nói bước 3 sẽ hỏng:
- `docs/journey-screens.md` đã ghi drop-off có thật của wizard tạo sự kiện: *"O3 bank-config friction: payment fields are optional but read as required"*. Cùng tập người dùng, cùng loại trường, đã đo được rồi.
- `src/pages/CreateSocialEvent.tsx:151-160` cố tình **loại bộ ba bank khỏi autosave** (CodeQL `js/clear-text-storage-of-sensitive-data`). Seller điền bank ở bước 3, rớt mạng 4G, quay lại → hồ sơ khôi phục nhưng **bank trống, không một lời cảnh báo**. `useAutosaveDraft` không cứu được chỗ này.

Và bank sẽ **không được dùng đến trong nhiều tháng** — Phase 1-3 không có payout, Phase 4 mới chọn provider (§10). Thu dữ liệu ngân hàng để nằm im là chi phí niềm tin thuần túy.

**Sửa:** slice 1 thu đúng 4 thứ: Tên gian hàng (bắt buộc duy nhất), Người liên hệ (prefill từ profile), Số điện thoại liên hệ, Kênh liên hệ ưu tiên (radio: Zalo / Gọi điện / Email, Zalo mặc định). Địa chỉ lấy hàng, mã số thuế, giấy tờ, ngân hàng: **hoãn tới lúc bật COD/vận chuyển**. Đây cũng là kết luận của GPT (reply "Data to defer", dòng 94-108).

### B3 — Seller mở link Zalo/Messenger sẽ không đăng nhập được
**Của Claude.** GPT chạm nhẹ (dòng 15) rồi bỏ; nó không biết repo chỉ có OAuth.

`src/pages/Login.tsx:135` và `:172` — toàn bộ đăng nhập một chạm là `signInWithOAuth` Google/Apple. Google **chặn cứng** OAuth trong embedded WebView (`disallowed_useragent`, 403). Zalo và Messenger đều mở link trong in-app browser mặc định. Đường còn lại là email+password → seller rời app đi lấy email xác thực → mất context. Trớ trêu: `phone-otp-send`/`phone-otp-verify` đã chạy prod nhưng **chỉ gắn trong `RegistrationModal` của social event, không có trên `/login`**.

**Sửa (chọn một, a rẻ hơn dài hạn):**
- **(a)** Gắn phone-OTP vào `/login` — trả nợ cho cả sản phẩm, không riêng seller.
- **(b)** Tối thiểu: phát hiện in-app browser qua UA (`FBAN|FBAV|FB_IAB|Instagram|Zalo`), ẩn nút Google, banner "Mở bằng trình duyệt để đăng nhập" + nút Sao chép liên kết.

Không làm B3, Cuong sẽ đọc "seller không quan tâm" trong khi họ không vào được cửa.

### B3b — Ảnh CCCD sẽ nằm lại 30 ngày trong Cache Storage, sống qua cả sign-out
**Của Claude.** GPT không nêu (đặc thù repo).

`vite.config.ts:217-225`: regex `^https://ajvlcamxemgbxduhiqrl.supabase.co/storage/` + `CacheFirst` + `maxAgeSeconds: 30*24*60*60` khớp **mọi** đường `/storage/`, kể cả `/storage/v1/object/sign/<bucket>/…?token=…`. Và `src/lib/pwa/cache.ts:19` chỉ xoá `["supabase-rest"]` khi sign-out; `supabase-storage` không nằm trong danh sách. Cuong xem CCCD của seller → ảnh nằm trong Cache Storage máy Cuong 30 ngày, sống qua đăng xuất.

**Sửa (bắt buộc TRƯỚC khi nhận file giấy tờ nào):** rule `NetworkOnly` cho `/storage/v1/object/sign/` đặt **trước** rule `CacheFirst`, thêm bucket KYC vào `AUTH_SENSITIVE_CACHES`. Hoặc — đúng với B2 — **không nhận giấy tờ trong pilot**, lỗ này không mở ra.

### B4 — `/admin/news` là dashboard, không phải queue; ba thứ trong đó sẽ hỏng ở màn quyết định
**Dữ kiện của Claude; GPT đồng tình + bổ sung một điểm ngược plan.**

| Không copy được từ `AdminNews.tsx` | Vì sao vỡ |
|---|---|
| Không có error state (`error` của `useQuery` không bao giờ được đọc — dòng 153-159, 461-469) | Query fail → render "Không có bài nào khớp bộ lọc" — lỗi mạng trông y hệt "hết việc" |
| Toast-only cho mọi `onSuccess` | Quyết định "Từ chối hồ sơ" biến mất sau 4 giây, không có bản ghi trên màn |
| `size="sm"` khắp nơi (36px, gồm icon-only dòng 413, 502) | Dưới 44px cho nút quyết định |
| `limit(50)`/`limit(20)` cứng, không phân trang | Queue >50 im lặng cụt |
| `refetchInterval: 15_000` vĩnh viễn (dòng 108, 124) | Poll vô nghĩa trên 4G |
| Badge in raw enum | Xem mục Copy |

Copy được: `AdminLayout` shell + `AdminMFAGate`, react-query + invalidate, `Card`/`Badge`/`Skeleton`, sonner làm xác nhận phụ, token The Line.

**GPT bổ sung, tôi đồng ý:** plan §5 bắt buộc lý do cho cả approve là sai — Cuong sẽ gõ "ok" và trường thành rác. Đúng: `needs_changes` + `rejected` bắt buộc lý do **hiển thị cho seller**; `approved` chỉ ghi chú nội bộ tuỳ chọn.

---

## Khuyến nghị mạnh

### KN1 — Vòng lặp "yêu cầu bổ sung" có cấu trúc theo từng mục, không phải một textarea
**Chủ yếu của GPT-5.6** (reply dòng 228-313). Áp dụng **khi mở self-serve cho seller lạ (Phase 2)**, không phải slice 1: dialog per-issue (field select + nội dung seller thấy + ghi chú nội bộ), checklist phía seller với "Sửa mục này" scroll+focus, admin thấy diff, sau 2 vòng gợi ý "nên gọi trực tiếp".

### KN2 — 12 trạng thái cho 3 seller là mô hình thừa
**Của Claude.** Slice 1 (theo B1) không có application → còn shop states. Pilot chỉ cần **`active` | `suspended`**. `pending_activation` vô nghĩa khi chính Cuong bấm nút tạo; `restricted`/`closed` chưa có cơ chế sinh ra. Định nghĩa enum đầy đủ trong DB nếu muốn, nhưng **UI slice 1 chỉ render 2 trạng thái**.

### KN3 — Discovery: đừng xây gì cho buyer ở pilot
**Cả hai độc lập đồng ý.** Thước đo là cung. Shop trên homepage/menu dẫn buyer vào sàn 0 sản phẩm — trả giá "làm dở dang" trên bề mặt traffic cao nhất, đổi lấy 0 tín hiệu cung. Tối thiểu đủ: (1) link trực tiếp Cuong gửi `/seller`; (2) mục `Quản lý gian hàng` trong dropdown tài khoản (`AppHeader.tsx:167-175` pattern `/creator`, `/admin`), chỉ hiện khi có shop; (3) bảng theo dõi phễu cung ở admin. Không đụng `BottomNav`, homepage, global search, blog buying-guide (đề nghị bỏ 2 cái sau khỏi Phase 1).

**Thay vào đó**, "cửa thoát concierge" — GPT nêu, ý tốt nhất trong reply: *"Bạn đã có sản phẩm trên Shopee hoặc Facebook? Gửi liên kết, ThePickleHub nhập giúp bạn."* Seller VN đã có ảnh/mô tả/giá ở chỗ khác; bắt gõ lại là lý do #1 họ không đăng.

### KN4 — Địa chỉ: đừng nhân bản 3 ô free-text của `VenueSubmit`
**Cả hai đồng ý.** `src/pages/VenueSubmit.tsx:173-190` 3 Input text thuần sẽ sinh `HCM`/`TP.HCM`/`Sài Gòn` trong cùng cột — cột về sau vào tính phí ship. Khi cần (Phase 2): Select tỉnh + Select quận phụ thuộc, seed từ `CITY_DIRECTORY` (`src/lib/venues.ts:227+`). Slice 1: **không có trường địa chỉ nào cả.**

### KN5 — Định dạng số VND và ngày
**Của Claude.** Dùng `formatPriceVnd()` (`src/lib/social-events/format.ts:139`, `toLocaleString("vi-VN")` → `120.000₫`); đừng copy `toLocaleString("en-US")` từ pulse strip `Index.tsx`. Ngày admin: `14:32, 9/8/2026` (vi-VN).

### KN6 — Sidebar admin thứ 19 + mobile admin chỉ 4 tab
**Cả hai độc lập đồng ý.** `AdminLayout.tsx:48-67` đã 18 mục. Gộp một mục `Shop` → landing `/admin/shop` với thẻ con. Mobile admin vào qua sidebar, không nhét 4 tab.

---

## Trạng thái màn hình

(Copy VI là bản chính; bảng từ GPT reply dòng 559-601, giữ nguyên, chỗ sửa có đánh dấu.)

### `/seller` — thiết lập gian hàng

| Trạng thái | VI | EN | Hành động |
|---|---|---|---|
| Chưa có shop | `Bạn chưa có gian hàng nào.` | `You don't have a shop yet.` | (Claude: pilot không có nút tự tạo — hiện) `Liên hệ ThePickleHub để mở gian hàng` |
| Loading | `Đang tải thông tin gian hàng…` | `Loading your shop details…` | Skeleton, không spinner |
| Lỗi tải | `Không tải được thông tin gian hàng.` | `We couldn't load your shop details.` | `Thử lại` |
| Lỗi lưu | `Chưa lưu được thay đổi. Thông tin bạn nhập vẫn còn trên màn hình.` | `Your changes couldn't be saved. Your entries are still on this screen.` | `Lưu lại` |
| Offline | `Bạn đang ngoại tuyến. Hãy kết nối mạng trước khi gửi.` | `You're offline. Reconnect before submitting.` | `Thử lại` |
| Đã lưu nháp | `Đã lưu bản nháp lúc 14:32.` | `Draft saved at 2:32 PM.` | — |
| Đang gửi | `Đang gửi…` | `Submitting…` | Khoá nút, chống double-tap |
| Gửi thất bại | `Chưa gửi được. Vui lòng kiểm tra kết nối và thử lại.` | `Couldn't submit. Check your connection and try again.` | `Gửi lại` |

Nguyên tắc: không bao giờ hiển thị `Đã gửi` trước khi server xác nhận. Skeleton cho shop detail/product list (CLS ≤ 0.1, CLS prod đang poor 63,7%); spinner chỉ inline trong nút submit.

### `/admin/shop/...` — hàng đợi

| Trạng thái | VI | EN | Hành động |
|---|---|---|---|
| Loading | `Đang tải danh sách…` | `Loading…` | Skeleton |
| Rỗng | `Không có hồ sơ nào cần xem xét.` | `No applications to review.` | — |
| Rỗng do filter | `Không có hồ sơ phù hợp với bộ lọc này.` | `No applications match this filter.` | `Xóa bộ lọc` |
| **Lỗi query** | `Không tải được danh sách. Có thể do kết nối hoặc máy chủ.` | `Couldn't load the list.` | `Thử lại` |
| Offline | `Bạn đang ngoại tuyến. Danh sách có thể không phải mới nhất.` | `You're offline.` | `Thử kết nối lại` |
| Dữ liệu cũ | `Đang hiển thị dữ liệu lúc 14:32. Chưa cập nhật được.` | `Showing data from 2:32 PM.` | `Làm mới` |

**Bắt buộc:** lỗi không bao giờ render bằng copy trạng thái rỗng — chính là bug đang có trong `AdminNews.tsx`.

### Offline / PWA / Capacitor

`vite.config.ts:198` NetworkFirst 3s — seller 4G chập chờn có thể 3s trắng. `useAutosaveDraft` bật cho mọi trường trừ nhạy cảm; mất mạng lúc submit giữ nguyên form. Không port Shop sang native SwiftUI (ADR-001 không bắt buộc parity cho feature mới) — ghi rõ trong proposal để phiên sau không tự port.

---

## Copy đề xuất (VI / EN)

### Application states

| State | Badge | Câu giải thích |
|---|---|---|
| `draft` | `Bản nháp` | `Bạn chưa gửi hồ sơ này cho ThePickleHub.` |
| `submitted` | `Đã gửi` | `Hồ sơ đã gửi, đang chờ ThePickleHub tiếp nhận.` |
| `under_review` | `Đang xem xét` | `ThePickleHub đang kiểm tra thông tin trong hồ sơ của bạn.` (Claude sửa: GPT viết "Cuong đang kiểm tra" — đừng gắn tên người) |
| `needs_changes` | `Cần bổ sung` | `Bạn cần sửa hoặc bổ sung một số thông tin rồi gửi lại.` |
| `approved` | `Đã duyệt` | `Hồ sơ đã được duyệt. Bạn có thể mở gian hàng.` |
| `rejected` | `Từ chối` | `Hồ sơ chưa được chấp nhận. Xem lý do bên dưới.` |
| `withdrawn` | `Đã rút` | `Bạn đã rút hồ sơ. ThePickleHub sẽ không xem xét tiếp.` |

### Shop states

| State | Badge | Câu giải thích |
|---|---|---|
| `pending_activation` | `Chờ kích hoạt` | `Gian hàng đã duyệt, còn bước cần hoàn tất trước khi hoạt động.` |
| `active` | `Đang hoạt động` | `Gian hàng đang hoạt động trên ThePickleHub Shop.` |
| `restricted` | `Bị hạn chế` | `Một số chức năng bán hàng đang bị giới hạn.` |
| `suspended` | `Tạm ngưng` | `Gian hàng tạm ngưng, chưa thể bán hàng.` |
| `closed` | `Đã đóng` | `Gian hàng đã đóng và không còn hoạt động.` |

### Độ dài VI 375px
GPT đề xuất nhãn ngắn riêng cho filter tab (`Đang xem`, `Cần sửa`, `Chờ mở`, `Hoạt động`). Tôi đồng ý nhưng thêm ràng buộc: tránh hai bộ nhãn cho một trạng thái nếu được — scroll ngang tab bar chấp nhận được (`.tl-tabs` mẫu ở Tournaments — **grep class trước khi đặt tên**, bẫy đã dính). `Từ chối` chứ không `Bị từ chối` (GPT, đúng).

### "Xem N sản phẩm" — bẫy zero-state (của Claude, cho phiên sau)
Kết quả 0 → không hiện `Xem 0 sản phẩm`, đổi `Không có sản phẩm phù hợp` + disabled. Số qua `toLocaleString("vi-VN")`. Một CTA, một cụm từ.

---

## Accessibility (WCAG 2.1 AA)

**Cả hai đồng ý:**
- `size="sm"` (36px) cấm cho nút hành động form seller + quyết định admin — `size="default"` (44px) hoặc `size="icon"`. `AdminNews.tsx` vi phạm dòng 325, 335, 378, 386, 413, 502, 517 — đừng copy.
- Ba nút `Yêu cầu bổ sung`/`Duyệt hồ sơ`/`Từ chối` không xếp một hàng ở 375px — dọc full-width, destructive xuống cuối tách separator.
- Input ≥16px font (iOS Safari tự zoom).
- Lỗi validate dưới field + `aria-describedby`, không chỉ màu; submit focus field lỗi đầu + `aria-live="assertive"`.
- Kết quả quyết định là bản ghi trên trang `role="status"`, không chỉ toast.
- Icon-only cần `aria-label` tiếng Việt.

**Của Claude:**
- Sticky footer + `BottomNav` 56/68/72px + safe-area: padding đáy = footer + BottomNav + safe area; BottomNav tự ẩn khi bàn phím mở (`useKeyboardHeight`, dòng 54-56) → tính cả hai trạng thái.
- `TheLineLayout` bắt buộc `title` — `scripts/check-theline.mjs` rule 1 HARD.
- Badge dùng `--tl-*` token, không hex/Tailwind palette (`AdminNews.tsx:298,300` đang `text-green-600` — đừng copy).
- Contrast: axe đang TẮT `color-contrast` — gate không bắt hộ, đo tay.

---

## Nits

1. Không lộ raw enum ở đâu. *(Cả hai)*
2. Admin dùng tiếng Việt nhất quán — `AdminNews.tsx` trộn `Publish`/`Tắt`/`Run now`. *(GPT, tôi đồng ý)*
3. Rút hồ sơ cần `useConfirm()` (đã có trong repo), không `window.confirm`. *(GPT + helper của Claude)*
4. Bỏ poll 15s — fetch on mount + refetch on focus + nút Làm mới. *(GPT)*
5. Ảnh sản phẩm `aspect-ratio` cố định — CLS prod poor 63,7%; contract test mẫu: LiveSection thumb. *(Claude)*
6. Route lazy + cập nhật `route-snapshot.json`. *(Claude, từ recon)*

---

## Panel đa model

**Đồng thuận Claude + GPT-5.6 (độc lập):** form 7 bước sai artifact; slice §21 kết thúc trước điểm đo; không xây discovery buyer khi 0 sản phẩm; `/admin/news` không phải mẫu queue; `approved` không bắt buộc lý do; địa chỉ free-text tạo rác; 3 nút quyết định không một hàng 375px.

**Bất đồng 1 — thay form bằng gì.** GPT: hệ thống invite token (bảng invite, route `/shop/seller/invite/:token`, hạn dùng, thu hồi). Tôi: không token — Cuong tìm user trong `/admin/users`, bấm "Tạo gian hàng" + confirm email/tên, gửi link `/seller` qua Zalo. **Chốt: theo tôi** — token flow là 1/20 lượng code cho bài toán "3 người có số điện thoại"; đúng ở Phase 2.

**Bất đồng 2 — có giữ admin review không.** GPT: *"Eliminate for invited sellers. Cuong has already screened them socially."* Tôi: giữ transition server-authorized (RPC SECURITY DEFINER + is_admin() + aal2 + audit, khuôn btc_manage_team), bỏ màn queue. **Chốt: giữ transition, bỏ queue.**

**Bất đồng 3 — mức độ in-app browser.** GPT xếp là dòng phụ; tôi xếp Blocker (B3). **Chốt: Blocker** — GPT không thấy `Login.tsx` nên không biết chỉ có OAuth. Nếu chỉ sửa một thứ trong toàn bộ review này, sửa cái này.

---

**Files:** `external/ui-ux-critic-gpt56-prompt.md` · `external/ui-ux-critic-gpt56-reply.md` · `.meta.json`

**Bằng chứng:** `src/pages/CreateSocialEvent.tsx:151-160` · `docs/journey-screens.md` (O3) · `src/components/ui/button.tsx:28-34` · `src/pages/admin/AdminNews.tsx:153-159,461-469,108,124` · `src/pages/Login.tsx:135,172` · `vite.config.ts:217-225` · `src/lib/pwa/cache.ts:19` · `src/lib/social-events/format.ts:139` · `src/pages/VenueSubmit.tsx:173-190` · `src/components/layout/BottomNav.tsx:54-56,66-92` · `src/components/admin/AdminLayout.tsx:48-75` · `scripts/check-theline.mjs` (rule 1 HARD)
