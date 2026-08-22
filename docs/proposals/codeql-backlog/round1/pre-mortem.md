# Pre-mortem: codeql-backlog

> Ba postmortem của ba sự cố CHƯA xảy ra. Feature "sanitize error responses +
> dismiss 28 CodeQL alert, có đụng `_shared/` → redeploy ALL edge functions"
> coi như đã lên prod và đã hỏng. Nhiệm vụ: kể lại chuyện gì đã xảy ra, mỗi
> mắt xích trỏ tới file/dòng thật. Không phải checklist rủi ro — là chuỗi
> nhân quả.
>
> Dữ kiện nền đã kiểm tra trong repo:
> - `deploy-guard.yml:60-66` — bất kỳ diff dưới `supabase/functions/_shared/**`
>   → nhánh "redeploy ALL functions", loop `for fn in $FNS; do supabase
>   functions deploy "$fn"; done` (dòng 92-95) dưới `timeout-minutes: 15` (dòng 31).
> - `ls -d supabase/functions/*/ | grep -v _shared | wc -l` = **75 thư mục**
>   (CLAUDE.md ghi "50 active" — thực tế nhiều hơn).
> - `_shared/auth.ts:55-60` — helper `jsonResponse`, alert #17 sink ở dòng 56.
>   Import bởi user-facing: `dupr-link`, `phone-otp-send`, `create-payment-order`,
>   `match-invite-redeem`, `cancel-registration`, `match-create`,
>   `reactivate-registration`, `dupr-match-submit`, `request-recovery-link`...
> - Không workflow nào chạy `wrangler deploy` (grep `.github/workflows/` = rỗng).
>   Worker deploy tay từ trong từng thư mục (CLAUDE.md).
> - `errors-telegram-alert/index.ts:34-35,115-120` — alert CHỈ quét bảng
>   `client_errors` (lỗi JS trình duyệt báo về), ngưỡng spike ≥3 lần/10 phút.

---

## Sự cố 1 — "Deploy guard hết giờ giữa chừng: 40/75 edge function chạy bundle mới, 35 còn bundle cũ, không ai biết là 35 nào"

**Xác suất:** trung bình · **Thời gian tới lúc phát hiện:** ~15-20 phút (có Telegram, nhưng alert nói sai bản chất)

**Timeline**
- T+0: PR "CodeQL backlog" merge vào `main`. Diff có đụng `supabase/functions/_shared/auth.ts` (sửa alert #17). CI của PR (lint/test/CodeQL) đã xanh từ trước khi merge.
- T+0: `deploy-guard.yml` chạy trên push-to-main. `Detect changed edge functions` thấy path khớp `^supabase/functions/_shared/` → in "→ _shared changed: redeploying ALL functions", dựng danh sách 75 function.
- T+2..T+14: loop deploy tuần tự. Mỗi `supabase functions deploy` mất ~15-40s (bundle + upload + propagate). 75 × ~25s ≈ 31 phút > 15 phút.
- T+15: GitHub Actions giết job vì chạm `timeout-minutes: 15`. Loop dừng ở function thứ ~40 (theo thứ tự `sort` alphabet của `ls -d`). Function alphabet đầu (`add-registration-direct`, `auto-*`, `cancel-*`, `create-payment-order`...) đã redeploy; function alphabet cuối (`request-recovery-link`, `submit-match-score`, `send-*`...) CHƯA.
- T+15: step `Migration drift check (strict — SEC-06)` và mọi step sau **không bao giờ chạy** (job đã bị kill). `Notify Telegram on failure` chạy vì `if: failure()`.
- T+16: Cuong nhận Telegram: "🛡️ Deploy guard FAILED on main ... An edge function failed to deploy." — nhưng **không function nào "fail"**, job chỉ *hết giờ*, và tin nhắn không liệt kê function nào đã lên, function nào chưa.

**Cơ chế**
`deploy-guard.yml:60-66` (nhánh redeploy-ALL) → `deploy-guard.yml:92-95` (loop tuần tự) gặp `deploy-guard.yml:31` (`timeout-minutes: 15`) với **75 function** → job bị kill giữa loop → fleet chia đôi: nửa alphabet đầu có bundle mới, nửa sau giữ bundle cũ. Thứ tự deploy = thứ tự `sort` alphabet nên "nửa nào" là tất định nhưng không ai đọc log để biết.

**Vì sao mọi gate vẫn xanh**
Panel duyệt *code*, không duyệt *thời gian tường* của 75 lần deploy tuần tự. CI của PR test source trên runner — nó không gọi `supabase functions deploy` lần nào. `deploy-guard` chạy **sau merge, trên main**, không phải trên PR — nên PR xanh 100% mà vẫn dẫn tới sự cố này. Soak 30 phút (nếu có) chạy trên function nào? Nếu soak trúng nửa alphabet đầu thì sạch; nửa sau không ai soak.

**Ai báo, sau bao lâu**
Có Telegram từ chính `deploy-guard` sau ~15 phút — nên đây là sự cố *ồn ào nhất* trong ba cái. Nhưng nội dung sai ("failed to deploy" trong khi thực ra là timeout) khiến Cuong đi soi log function thay vì nghĩ tới timeout, và không có danh sách "đã lên / chưa lên" nên phải tự `supabase functions list` đối chiếu 75 version.

**Vì sao khó sửa**
Không có "revert" một phát. Chạy lại `deploy-guard` (workflow_dispatch) = timeout y hệt, không bao giờ hội tụ nếu không can thiệp tay. Phải deploy tay ~35 function còn lại. Nguy hơn: nếu bất kỳ function nào từng được **hotfix thẳng trên dashboard** mà repo chưa theo kịp (drift), lần redeploy-ALL này **âm thầm revert** hotfix đó về trạng thái repo — và nửa fleet chưa deploy thì chưa bị revert, nên trạng thái còn lệch nhau theo cả hướng này.

**Dấu hiệu sớm lẽ ra phải có**
`deploy-guard` lẽ ra log "Deploying 12/75: cancel-registration" để khi timeout còn biết dừng ở đâu; và alert lẽ ra phân biệt "timeout" với "deploy error". Cả hai đều không có.

---

## Sự cố 2 — "Người dùng Việt nhập sai DUPR ID lúc onboarding, bấm Liên kết, màn hình đứng im — không báo lỗi gì, không log gì, ba tuần không ai biết vì sao tỉ lệ link DUPR tụt"

**Xác suất:** cao · **Thời gian tới lúc phát hiện:** nhiều ngày → vài tuần (không có alert nào bắt được)

**Timeline**
- T+0: fix alert #17 (`js/stack-trace-exposure`) được đặt vào **helper dùng chung** `_shared/auth.ts` `jsonResponse` (dòng 55-60) thay vì vào 3 call site DUPR admin/test-fire. Lý do rất tự nhiên: recon ghi rõ "No shared safe-error helper exists" và sink nằm ngay trong `jsonResponse` — sửa một chỗ gọn hơn ba chỗ. Bản sửa: khi `status >= 400`, thay body bằng `{ error: "Internal server error" }` để không lộ `err.message`.
- T+0: `_shared/auth.ts` đổi → deploy-guard redeploy ALL → mọi function import `jsonResponse` (gồm `dupr-link`, `phone-otp-send`, `create-payment-order`, `match-invite-redeem`...) lên bundle mới.
- T+1..T+21: user Việt onboarding nhập DUPR ID/email không khớp. `dupr-link/index.ts:35-40` gọi `err("dupr_email_mismatch", 400, "email_mismatch", {errors:[...]})` → `jsonResponse({error, code, details}, 400)`. Bản sửa mới **thấy status 400 → xóa sạch body, trả `{error:"Internal server error"}`**, rụng mất `code` và `details.errors`.
- Client `useDuprLink.ts:54-70` cố đọc `body.code` + `body.details.errors` để hiện hướng dẫn cụ thể ("email không khớp với DUPR ID này"). Giờ `code`/`details` = undefined → `opts.onError({message:"...", code:undefined, details:undefined})` → UI onboarding chỉ hiện toast đỏ chung chung, hoặc (nếu UI chỉ render khi có `details`) **không hiện gì**.
- User nhập lại y hệt (không biết sai chỗ nào) → thất bại lần nữa → bỏ cuộc. Không exception JS nào bị ném.

**Cơ chế**
`_shared/auth.ts:56` (fix sanitize áp cho mọi `status>=400`) → `dupr-link/index.ts:35-40` `err()` trả validation 4xx *có chủ đích* kèm `code`/`details` → helper nuốt mất `code`/`details` → `useDuprLink.ts:60-66` mất dữ liệu để dẫn dắt → onboarding câm. Cùng đường này áp cho `phone-otp-send` (OTP sai/hết hạn), `create-payment-order`, `cancel-registration` — mọi 4xx "lỗi mong đợi" bị đồng hoá với "lỗi nội bộ".

**Vì sao mọi gate vẫn xanh**
CodeQL xanh — vì leak *đã được vá thật*, đó đúng là mục tiêu. Panel duyệt và gật: "sanitize error responses" chính là việc được giao (intake.md). Test hiện có trong `_shared/__tests__/` assert logic auth/payment, **không có test nào assert shape/nội dung body lỗi** (recon: "No test found asserting an edge function response... err.message"). Soak 30 phút chạy happy-path → không bao giờ chạm nhánh 4xx nên sạch. Không gate nào trong pipeline nhìn vào đường lỗi mong-đợi.

**Ai báo, sau bao lâu**
Không alert nào. `errors-telegram-alert` chỉ quét `client_errors` (lỗi JS trình duyệt) với spike ≥3/10 phút (`errors-telegram-alert/index.ts:34-35`). Một body 4xx bị rút gọn **không ném exception JS, không ghi dòng `client_errors` nào** → không spike → im hoàn toàn. Cuong biết khi có user than trên Facebook/Zalo "không link được DUPR", hoặc tự thấy tỉ lệ link tụt (mà không có dashboard cho số đó) — sau nhiều ngày tới vài tuần.

**Vì sao khó sửa**
`git revert` bản sửa thì dễ. Nhưng thiệt hại là các user onboarding đã bỏ cuộc trong 3 tuần — số đó không lấy lại được bằng revert. Niềm tin "app lởm, nhập DUPR không được" đã hình thành.

**Dấu hiệu sớm lẽ ra phải có**
Một test khẳng định "4xx từ `dupr-link` vẫn mang `code`" sẽ đỏ ngay trong CI. Hoặc: sanitize CHỈ áp cho 5xx (lỗi thật sự bất ngờ), chừa 4xx (lỗi validation do người dùng, vốn không chứa stack trace). Cả hai đều không có trong bản sửa gộp-vào-helper.

---

## Sự cố 3 — "CodeQL dashboard xanh 28→0, task tuyên bố xong ba tuần trước — nhưng secret-sync worker đang chạy trên prod vẫn rò stack trace y như cũ, vì không ai `wrangler deploy`"

**Xác suất:** cao (đây là kết cục MẶC ĐỊNH) · **Thời gian tới lúc phát hiện:** không bao giờ, cho tới khi có người vô tình chạm vào

**Timeline**
- T+0: PR sửa source 4 worker: `workers/social-poster/src/index.ts:730`, `workers/secret-sync/src/index.ts:254`, `workers/pro-tour-scraper/src/index.ts:643`, `workers/news-fetcher/src/index.ts:444-446` (alert #36/35/21/8/7/6/9/2). Merge `main`.
- T+0: CodeQL cron/PR quét lại `main`, thấy source đã sạch → **mark 8 alert worker resolved**. Cộng với các alert edge/frontend đã sửa → dashboard **28 → 0**. Success criterion của intake.md ("28 → 0") **được coi là thoả** → task tuyên bố hoàn tất.
- T+0: nhưng **không workflow nào chạy `wrangler deploy`** (grep `.github/workflows/` = rỗng), và `deploy-guard.yml:58` chỉ diff `supabase/functions/**` — `workers/**` ngoài phạm vi. Worker deploy tay từ trong từng thư mục (CLAUDE.md). Không ai chạy tay.
- T+1..T+21: `secret-sync` worker LIVE (endpoint `POST /heal`, giữ `SUPABASE_SERVICE_ROLE_KEY` + `SUPABASE_MANAGEMENT_PAT`) vẫn chạy **bundle cũ** → vẫn rò stack trace ở đường lỗi. Dashboard vẫn xanh, ai nhìn cũng tưởng đã vá.
- T+~21 (biến thể tệ hơn): Cuong sửa một thứ không liên quan trong `news-fetcher`, chạy `wrangler deploy` → **ship kèm cả diff CodeQL 3 tuần trước**, tách rời khỏi ngữ cảnh review của PR gốc. Nếu bản sửa regex `bad-tag-filter`/`double-escaping` ở `news-fetcher/src/index.ts:444-446` sai (over-strip), nội dung bài news bị cắt/hỏng âm thầm từ lúc đó.

**Cơ chế**
`intake.md:13` định nghĩa thành công = "alert 28 → 0" → đo trên **source repo** (nơi CodeQL quét) → dashboard xanh. Nhưng bề mặt thật (`workers/*` đã deploy) đổi qua đường **hoàn toàn khác** (`wrangler deploy` tay), không CI nào chạm (`.github/workflows/` không có `wrangler`; `deploy-guard.yml:58` loại trừ `workers/**`). Metric đo sai bề mặt → "xong" mà leak vẫn sống.

**Vì sao mọi gate vẫn xanh**
CodeQL xanh theo đúng nghĩa đen — nó quét source, source đã sạch. CI xanh. Panel duyệt và thấy alert về 0, đúng mục tiêu. Mọi gate đều đo đúng cái nó được thiết kế để đo — chỉ là không gate nào đo *cái đang chạy trên prod của worker*.

**Ai báo, sau bao lâu**
Không ai. Leak là lỗ hổng bảo mật *tiềm ẩn* sau một dashboard xanh — không monitor nào canh nội dung body-lỗi của worker; `edge-auth-parity` chỉ soi Supabase functions, không đụng `workers/*`. Với biến thể news-mangle: `news-check`/`news-ingest` vẫn "thành công" (SQL chạy xong, chỉ nội dung sai) nên cũng không alert. Cuong may ra thấy khi tự đọc `/news` vài tuần sau.

**Vì sao khó sửa**
"Fix" đã tuyên bố ship 3 tuần trước. Mở lại đòi hỏi trước hết phải *nhận ra dashboard đang nói dối*. Đây là loại ăn mòn niềm tin nặng nhất: `git revert` không giúp gì vì code repo vốn đã đúng — cái sai là niềm tin "alert = 0 nghĩa là prod đã an toàn".

**Dấu hiệu sớm lẽ ra phải có**
Một dòng trong checklist PR: "mỗi worker chạm phải `wrangler deploy` + curl probe đường lỗi xác nhận không còn stack". Hoặc `deploy-guard` mở rộng cảnh báo khi `workers/**` đổi mà không có bằng chứng deploy. Không có gì cả — `workers/*` là điểm mù có hệ thống của pipeline.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|-------|----------|---------------|---------|
| 3 | Worker deploy drift — dashboard xanh, prod vẫn rò (secret-sync) | Cao (mặc định) | Rất cao (dashboard chủ động nói dối, tiềm ẩn nhiều tuần) | **#1 — tệ nhất** |
| 2 | Client câm lỗi — onboarding DUPR / OTP / payment mất hướng dẫn 4xx | Cao | Cao (không alert, mất chuyển đổi âm thầm) | #2 |
| 1 | Deploy-guard timeout giữa 75 function — fleet chia đôi | Trung bình | Thấp-TB (CÓ Telegram, dù nội dung sai bản chất) | #3 |

**Tệ nhất = Sự cố 3.** Xác suất cao nhất vì nó là *kết cục mặc định* (không có gì tự deploy worker), phát hiện khó nhất (dashboard xanh khẳng định điều ngược lại), và nó **đánh bại chính success metric của task** trong khi để một worker giữ service-role key tiếp tục rò. Sự cố 1 tuy có thể nghe "thảm" hơn (nửa fleet lệch) nhưng nó *ồn* — có Telegram trong 15 phút; sự cố 3 im lặng và bào mòn niềm tin, thứ `git revert` không lấy lại.

## Rẻ nhất để chặn từ bây giờ

1. **Sanitize CHỈ áp cho 5xx.** Sửa alert #17 ở đường lỗi *bất ngờ* (5xx), chừa nguyên body 4xx (validation do người dùng — vốn không chứa stack trace). Chặn đứng Sự cố 2. Một điều kiện `status >= 500` trong bản vá.
2. **Một test body-shape.** `expect((await dupr-link 4xx).code).toBeDefined()` trong `_shared/__tests__/` — đỏ ngay nếu helper nuốt `code`/`details`. Đây là lỗ hổng test recon đã chỉ ra ("no test asserts response body shape").
3. **Không đụng `_shared/auth.ts` cho alert #17.** Sửa tại 3 call site DUPR admin/test-fire (`dupr-webhook-test-fire:135`, `dupr-partner-token:52`, `dupr-webhook-register:77`). Không diff `_shared/` → không kích redeploy-ALL → Sự cố 1 biến mất, Sự cố 2 mất luôn đường lây qua helper.
4. **Worker: `wrangler deploy` + curl probe** cho từng worker chạm, ghi vào mô tả PR. Không tự động hoá cũng được — chỉ cần một dòng probe đường lỗi để dashboard-xanh không thành lời nói dối. Chặn Sự cố 3.

## Khoảng hở của pipeline mà bài này lộ ra

- **`deploy-guard` không có khái niệm "một phần".** Loop tuần tự 75 function dưới cap 15 phút, không log tiến độ, và alert `if: failure()` không phân biệt timeout với deploy-error. Nhánh "redeploy ALL" (`deploy-guard.yml:60-66`) được viết như thể deploy luôn xong trong ngân sách — chưa ai đo 75 lần deploy thực mất bao lâu.
- **Không gate nào nhìn đường lỗi.** CodeQL đo có-leak-hay-không; test đo logic happy-path; soak chạy happy-path. Shape của response 4xx — thứ mọi client Việt đọc để hiển thị toast — không có một assertion nào. Đây là điểm mù chung của cả `/idea`, không riêng task này.
- **`workers/**` là bề mặt deploy mồ côi.** `deploy-guard` chỉ biết `supabase/functions/**`; `edge-auth-parity` chỉ biết edge functions; không CI nào chạy `wrangler`. Success metric "alert = 0" đo trên source, nhưng source-sạch ≠ prod-sạch cho worker. Bất kỳ task nào sửa `workers/*` mà tin vào CodeQL-xanh đều dính bẫy này — cần một dòng feedback vào chính `/idea`: **định nghĩa "done" cho worker phải gồm bằng chứng deploy, không chỉ alert count.**
