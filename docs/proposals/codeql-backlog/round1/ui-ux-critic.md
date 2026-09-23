# UI/UX critique — CodeQL backlog (sanitize edge-function error responses)

> Panel: Claude (Opus 4.8) + GPT-5.6. Full strength (OPENAI_API_KEY set).
> Brief sent: `../external/ux-brief-sent.md` · Reply: `../external/ux-openai-reply.md`

## Đánh giá tổng thể

Đây là task an ninh, không phải feature — nhưng nó **chạm vào hợp đồng lỗi (error
contract)** giữa edge function và client, và đó là nơi trải nghiệm người dùng Việt sống
hoặc chết. Với đúng 7 alert trong scope (backend HMAC, 3 Worker cron, blog-blast admin,
news-translate cron, 3 endpoint DUPR admin/test-fire) thì **rủi ro UX gần như bằng 0**:
không cái nào nằm trên luồng người dùng ẩn danh lưu lượng cao, và các luồng đó không đổi
body. Rủi ro thật sự chỉ xuất hiện nếu Cuong làm đúng điều recon gợi ý ("chưa có shared
helper → làm một cái") rồi **áp helper đó rộng ra các function có body mang `code`** (đăng
ký giải, phone-OTP). Nếu helper đó nuốt luôn field `code`, toàn bộ error UX tiếng Việt sập
về "Lỗi mạng". Đó là Blocker duy nhất, và nó là Blocker *có điều kiện* — điều kiện dễ vô
tình chạm phải.

## Luồng người dùng

Không có màn hình mới. Cần soi là **luồng lỗi** của các flow user-facing hiện có, tất cả
đều bắt đầu từ deep-link Facebook vào một trang đơn:

- **Đăng ký giải (phone-OTP)** — luồng lưu lượng cao nhất. `RegistrationModal.tsx` đã đọc
  field `code` từ `error.context` body và map sang copy VI (`event_full` → "Giải đã đủ
  người", `slot_required` → "Vui lòng chọn hạng mục"...). Đây là **chuẩn vàng đã tồn tại**
  trong repo — bất kỳ shared helper nào cũng phải bảo tồn pattern này, không được phát minh
  lại. Function `phone-otp-*` **không** nằm trong 7 alert → contract không đổi trong PR này.
- **Mời đội vào giải** — `InviteTeamDialog.tsx:116-126` tự string-parse body
  (`response.error.message.split(', ')`) để lấy `errorData.error` rồi toast thẳng ra user.
  Fragile, nhưng function `invite-team-to-tournament` cũng **không** trong scope → không vỡ
  bây giờ.
- **Đặt lịch livestream** (creator), **xoá tài khoản**, **DUPR link/submit** — dùng pattern
  `error.message || "fallback VI"`. Qua `functions.invoke`, non-2xx bị bọc thành
  `FunctionsHttpError` với `.message` = "Edge Function returned a non-2xx status code" (chuỗi
  tiếng Anh, kỹ thuật) — nên các site này **hiện đã** hiện chuỗi Anh đó hoặc fallback VI của
  chúng, chứ hiếm khi lộ `err.message` server. Sanitize server-side gần như vô hình với nhóm
  này.

**Kết luận luồng:** 83 site client hiện `toast(error.message || "...")` phần lớn đã *không*
nhận được body hữu ích — supabase-js đã giấu nó sau `error.context`. Nên việc generic-hoá
body server không phải là mất mát UX mới; nó là cơ hội để *sửa* một UX vốn đã kém (rò tiếng
Anh kỹ thuật cho 95% người Việt).

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | **Blocker (có điều kiện)** | Nếu shared safe-error helper trả `{ error: "Internal server error" }` và **bỏ field `code`**, rồi được áp cho các function mang code (đăng ký giải, phone-OTP), thì switch VI trong `RegistrationModal` rơi hết vào `default → reg.networkError`. "Giải đã đủ người" / "Chọn hạng mục" biến thành "Lỗi mạng" → user bấm lại giải đã đầy, hoặc không biết phải chọn slot, hoặc tưởng lỗi 4G của mình. | Helper **luôn** giữ một machine `code` an toàn trong body, kể cả lỗi bất ngờ: `{ "code": "unexpected_error", "requestId": "..." }`. Không bao giờ dùng chuỗi hiển thị tiếng Anh làm field API. Chỉ strip `err.message`/stack, không strip `code`. |
| 2 | Nên sửa | Một helper duy nhất với cờ kiểu `safeErrorResponse(err, {exposeMessage:true})` → đường rò chỉ cách một property, dễ bật nhầm lúc 2am. | Tách **hai** hàm đặt tên rõ: `respondWithPublicError(code, ctx)` (chỉ nhận code trong allowlist, tự suy ra HTTP status, **không** nhận `Error`) và `respondWithUnexpectedError(err, ctx)` (nhận exception chỉ để log server-side + `requestId`, luôn trả `unexpected_error`). Không có tham số nào có thể đẩy message exception ra response. |
| 3 | Nên sửa | Gom hết lỗi về HTTP 500 làm mất ngữ nghĩa status (client `useDuprEntitlements` đọc `context.status`). | Giữ lớp status: 400 input, 401 hết phiên, 403 cấm, 409 conflict (`event_full`), 429 rate-limit, 500 chỉ cho lỗi bất ngờ. Suy status từ code trong `respondWithPublicError`. |
| 4 | Nên sửa | Registration `default → networkError` ("Lỗi mạng") dán nhãn *sai* cho lỗi 500 server. Court-side 4G: user cần biết kiểm tra mạng có ích không. | Phân biệt: `network_error` chỉ khi **không có** HTTP response; `unexpected_error` khi server có trả lời nhưng lỗi. Hai copy VI khác nhau (xem dưới). |
| 5 | Nit | Fallback tiếng Anh kỹ thuật ("Edge Function returned a non-2xx status code") đang rò cho 95% user Việt ở ~83 site. | Thêm 1 parser client tập trung (`normalizeFunctionError` → `AppErrorCode`) + map code→copy VI **trong PR an ninh này** (vì contract đang đổi). **Không** migrate cả 83 site trong PR này — làm follow-up theo thứ tự: livestream → mời đội → xoá account → DUPR → phần còn lại. |
| 6 | Nit | `InviteTeamDialog.tsx:120` tự parse `error.message.split(', ')` — mong manh, vỡ nếu shape body đổi. | Chuyển sang đọc `code` từ `error.context` như `RegistrationModal` — **nhưng chỉ khi** function `invite-team-to-tournament` được đụng tới. Không thuộc 7 alert → xếp follow-up, đừng nống scope. |

## Trạng thái màn hình

Không có màn hình mới; đây là trạng thái **Error** của các toast/dialog hiện có.

- **Error (lỗi server bất ngờ, có HTTP response):**
  - VI: `Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút.`
  - EN: `Something went wrong on our side. Please try again in a few minutes.`
  - Tránh "Edge Function", "non-2xx", "internal server error", raw `err.message`.
- **Offline / mất kết nối thật (không có HTTP response):**
  - VI: `Kết nối không ổn định. Vui lòng kiểm tra mạng và thử lại.`
  - EN: `Your connection appears unstable. Check your network and try again.`
  - PWA/Capacitor: đây là case thật ở sân — navigation NetworkFirst timeout 3s. Phân biệt
    rõ với lỗi server để user không sửa nhầm phía mình.
- **Loading / Empty:** không đổi bởi task này.

## Accessibility (WCAG 2.1 AA)

Chủ yếu clean cho phạm vi task (không thêm UI). Điều đã kiểm:
- Toast `variant: destructive` đã có sẵn ở các site — không tạo control mới, không đổi
  focus path. Đảm bảo copy mới không phá touch-target/contrast của toast hiện tại.
- **Một lưu ý:** copy lỗi **chỉ hiện một ngôn ngữ** theo locale đang active (mặc định VI).
  KHÔNG in cả VI/EN trong cùng một toast trên mobile — tăng chiều cao, chậm quét mắt, và
  với screen reader là đọc đôi. Bảng VI/EN dưới đây là để Cuong paste vào i18n, không phải
  để hiện đồng thời.

## Copy đề xuất (VI / EN)

Map `code` → copy (paste vào i18n; hiện theo locale active):

| code | VI | EN |
|---|---|---|
| `event_full` | Giải đã đủ người. | This event is full. |
| `slot_required` | Vui lòng chọn hạng mục thi đấu. | Please select a competition category. |
| `team_already_invited` | Đội này đã được mời trước đó. | This team has already been invited. |
| `auth_required` | Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại. | Your session has expired. Please sign in again. |
| `forbidden` | Bạn không có quyền thực hiện thao tác này. | You don't have permission to do this. |
| `rate_limited` | Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút. | Too many attempts. Please try again in a few minutes. |
| `unexpected_error` | Hệ thống đang gặp sự cố. Vui lòng thử lại sau ít phút. | Something went wrong on our side. Please try again in a few minutes. |
| `network_error` | Kết nối không ổn định. Vui lòng kiểm tra mạng và thử lại. | Your connection appears unstable. Check your network and try again. |

Title toast (nếu dùng): VI `Chưa thể hoàn tất` / EN `Couldn't complete the request`.

## Panel đa model

- **Đồng thuận Claude + GPT-5.6:**
  1. Bỏ field `code` = regression UX nặng; helper **phải** giữ machine code kể cả lỗi bất
     ngờ (`unexpected_error` + `requestId`), không dùng chuỗi Anh làm field API.
  2. Tách **hai** helper (public error allowlist vs unexpected) thay vì một helper có cờ
     boolean — để đường rò không nằm cách một property.
  3. Giữ lớp HTTP status (400/401/403/409/429/500), không gom hết về 500.
  4. Phân biệt `network_error` vs `unexpected_error` — quan trọng cho user 4G ở sân.
  5. Thêm parser client tập trung **trong** PR an ninh, nhưng **không** migrate 83 site
     trong cùng PR — reuse pattern `RegistrationModal` đã có, đừng redesign.
  6. Copy VI: tránh mọi thuật ngữ kỹ thuật/Anh ngữ; mặc định VI, mỗi toast một ngôn ngữ.

- **Bất đồng:**
  - *Migrate `InviteTeamDialog` ngay trong PR này?* GPT-5.6 liệt kê nó vào scope PR an ninh.
    **Ý tôi (chọn):** để follow-up. Lý do cụ thể: `invite-team-to-tournament` **không** nằm
    trong 7 alert (xác nhận ở recon), nên body của nó không đổi trong PR này → parse mong
    manh vẫn chạy. Kéo nó vào = nống scope một task an ninh, ngược nguyên tắc "product chạy
    trơn là ưu tiên #1, đừng đụng cái không cần". Ghi nợ, sửa khi thật sự chạm function đó.
  - Ngoài điểm đó, không có bất đồng thực chất — hai model hội tụ mạnh, đây là tín hiệu thật.

---
**Tổng kết cho orchestrator: 1 Blocker (có điều kiện), 3 Nên sửa, 2 Nit.**
