# Rủi ro — cụm UX-06 + UX-07

Agent: `risk-auditor` · 2026-07-20 · vòng 1

## Verdict: 🔴 RED

Mở luồng khách cho `/tools/*` đổ tải đồng thời vào `register_team_for_doubles_elimination` — một RPC **check-then-insert không có lock nào** — và vào `quick_table_registrations` nơi guard chống trùng duy nhất là `UNIQUE(table_id, user_id)`; bỏ tài khoản đi là bỏ luôn cái guard đó, kết quả là giải kín chỗ vẫn nhận thêm đội và organizer phải tự tay loại người đã được báo "đăng ký thành công".

Classifier nói: **RED** (`supabase/migrations/*` + `supabase/functions/phone-otp-send/` + `apple/`). Em **giữ RED**, không nâng không hạ — nhưng lý do RED của em khác lý do của script: script chấm theo đường dẫn, còn RED thật nằm ở một **bug đang sống trên prod hôm nay** mà UX-07 sẽ khuếch đại.

> Gotcha đã biết (untracked file → RED giả): đã kiểm, không dính. Cả 3 rule RED đều bắn vào file/thư mục có thật và đã track. Lưu ý cách chạy: `--files` tách bằng **dấu cách**, không phải dấu phẩy — truyền chuỗi phẩy cho ra `fileCount: 1` và tier AMBER sai.

---

## Rủi ro cụ thể

| # | Mức | Cơ chế hỏng | Người dùng thấy gì | Giảm thiểu |
|---|-----|-------------|--------------------|------------|
| 1 | **Cao** | `supabase/migrations/20260529120000_doubles_elimination_open_registration.sql:113-118` — `SELECT count(*)` so với `_t.team_count`, rồi `INSERT` ở dòng 158. **Không advisory lock, không `FOR UPDATE`, không unique constraint sức chứa.** Định nghĩa 1 lần, không migration nào sửa lại. Đây đúng là race DB-01 đã reproduce cho social event, nhưng chưa từng vá cho nhánh giải | Giải cấu hình 8 đội có 9-10 đội. Bracket sinh sai hoặc không sinh được. Organizer phải loại một cặp đã nhận thông báo thành công | Vá bằng `pg_advisory_xact_lock(hashtext(...))` **trước** khi làm UX-07, đúng khuôn `20260717200000_db01c_member_capacity_lock.sql` |
| 2 | **Cao** | `src/hooks/useRegistration.ts:122-124` — đăng ký QuickTable là `.insert()` thẳng từ browser, **DB không có bất kỳ check sức chứa nào**. Guard duy nhất là `UNIQUE(table_id, user_id)` (`20251225041737...sql:33`). Luồng khách không có `user_id` → guard biến mất | Một người tự đăng ký vô hạn suất bằng số điện thoại khác nhau; danh sách organizer ngập rác | Không mở khách cho QuickTable cho tới khi có RPC ghi có lock + khoá trùng theo **phone** thay cho `user_id` |
| 3 | **Cao** | `supabase/functions/phone-otp-send/index.ts:161-185` — hàm **hard-scope vào `event_id`**, validate UUID rồi tra bảng `social_events`. Không nhận được giải | Người chơi nhập số, nhận `invalid_event_id`, không có OTP. Luồng khách chết hoàn toàn | Phải mở rộng thành `(target_type, target_id)`. **Nhưng**: đây là edge function RED đang phục vụ đăng ký social event thật — sửa sai là gãy SLO 3 cho cả luồng đang chạy |
| 4 | **Cao** | Soft-delete `deleted_at` mà giữ nguyên RLS `FOR SELECT USING (true)` (`20260107133349...sql:216-219`) → hàng đã xoá vẫn public đọc được. Có **~83 điểm đọc** 4 bảng này trong `src/` + `functions/` | Organizer bấm xoá, toast báo thành công, giải vẫn nằm trong tab Cộng đồng và vẫn mở bằng share link | Nếu làm: RPC restore riêng có kiểm quyền, **không** nhét tombstone vào policy public |
| 5 | **Cao** | `ON DELETE CASCADE` chỉ chạy khi DELETE thật. Đổi sang `UPDATE deleted_at` → matches/teams/registrations/referees **vẫn sống độc lập** | Đăng ký và trận của giải "đã xoá" vẫn hiện ở dashboard người chơi | Mọi truy vấn bảng con phải join điều kiện cha còn sống — không chỉ lọc 4 bảng cha |
| 6 | **Cao** | Migration thêm cột + backfill trên prod. Lớp lỗi lặp lại trong `.claude/memory/lessons-learned.md:8` — thiếu `GRANT` → `42501` cho client thật, trong khi test bằng SQL editor (superuser) thì xanh | Toàn bộ organizer mất chức năng xoá; test của Cuong vẫn "pass" | Bắt buộc khối GRANT + test bằng đúng role `anon`/`authenticated` |
| 7 | **TB** | Xoá giải đã thu tiền: repo **không có hàm refund nào** (`create-payment-order`/`mark-payment-claimed` không có đối ứng). Soft-delete không giải quyết — chỉ hoãn | Người đã chuyển khoản mất trang giải, không có hoàn tiền tự động | Chặn xoá khi còn đăng ký/thanh toán đã claim. Đây là **rủi ro uy tín**, không chỉ kỹ thuật |
| 8 | **TB** | Đăng ký chen vào cửa sổ đã-xoá: FK vẫn chấp nhận vì hàng cha còn tồn tại | Người chơi thấy "đăng ký thành công" cho giải đã biến mất | RPC đăng ký phải khoá + đọc cha, từ chối nếu `deleted_at IS NOT NULL` |
| 9 | **Thấp** | KV `pr:v30:` TTL **21600s = 6 giờ** cho `/tools/*` (`functions/_middleware.ts:181`) | Bot/link-preview còn thấy giải đã xoá tối đa 6 giờ | Chấp nhận được (xem mục SEO) hoặc gọi `?nocache=1` sau khi xoá |

---

## SLO bị đe doạ

- **SLO 3 (Registration, 99%)** — nguy hiểm nhất. Sửa `phone-otp-send` để nhận giải đụng thẳng đường OTP của social event đang chạy. Một lỗi validate = mọi đăng ký khách hỏng, cả giải lẫn sự kiện.
- **SLO 4 (Scoring — "zero lost-update incidents")** — overbook doubles-elimination làm bracket sinh sai. Theo định nghĩa trong `docs/slo.md:16` một suất bracket hỏng là **incident**, không phải tỉ lệ. Rủi ro #1 vi phạm trực tiếp mục này.
- **SLO 1 (Availability)** — gián tiếp: migration backfill trên 4 bảng nóng.
- Không đe doạ SLO 2, 5, 6, 7.

---

## Ngân sách hiệu năng

- Trần: **1970 KB gz** (`scripts/check-bundle-size.mjs:38`), còn ~20 KB.
- Chưa có code nên **chưa có số thật** — em không bịa. Nhưng cảnh báo cụ thể: luồng khách cần Turnstile widget + form OTP trên `/tools/*`. Turnstile là script bên thứ ba (không tính vào bundle), còn `RegistrationModal` của social event thì tính. Nếu tái dùng nguyên khối modal đó cho 4 thể thức, **phải lazy-load theo route**, không import tĩnh — 20 KB không đủ cho một modal đăng ký đầy đủ.
- Vietnam p75: `/tools/<format>/<share_id>` là trang deep-link. Thêm Turnstile = một request bên thứ ba chặn trước khi người dùng bấm được nút đăng ký. Trên 3G/4G VN đây là chi phí thật cho LCP/INP (SLO 6). Bắt buộc chỉ nạp Turnstile **sau khi** người dùng mở form, không nạp lúc vào trang.

---

## SEO

- **Routes SSR bị ảnh hưởng: thực tế gần như không.** Em **bác** mức độ nghiêm trọng mà GPT-5.6 gán cho phần này. Kiểm chứng: `functions/_lib/render/tournaments.ts:112,124` phát `<meta name="robots" content="noindex, follow">` cho **mọi** trang `/tools/*`, và `functions/sitemap-tournaments.xml.ts:51` chỉ đọc bảng `tournaments` (giải pro/livestream), **không** đọc 4 bảng cộng đồng. Nên không có chuyện Google index nội dung đã xoá, cũng không có sitemap trỏ tới giải đã xoá.
- Còn lại chỉ là staleness link-preview tối đa 6h. Thấp.
- **Cần bump `pr:v30`?** Không — nếu chỉ đổi dữ liệu chứ không đổi hình dạng HTML SSR. Chỉ bump khi sửa `functions/_lib/render/tournaments.ts`.
- Verify: `curl -A "Googlebot" https://www.thepicklehub.net/tools/quick-tables/<share_id>` → kỳ vọng 200 + `noindex` vẫn còn nguyên.
- `/tournaments` (trang danh sách) nếu đụng thì **phải** verify riêng — trang này không noindex.

---

## Kế hoạch rollback

Tách theo phần, vì mức độ khác nhau rất xa:

| Phần | Cơ chế | Thời gian khôi phục |
|---|---|---|
| Sửa UI `/tournaments`, `MyTournaments.tsx` | `git revert` + redeploy | ~5 phút |
| Journey instrumentation (`src/lib/journeys.ts`) | `git revert` | ~5 phút |
| **Migration `deleted_at` + backfill** | **KHÔNG revert được bằng git.** Cần viết migration down riêng, và nếu đã có hàng bị soft-delete thì down-migration làm mất trạng thái đó | 30-60 phút, có mất mát |
| **`phone-otp-send`** | Redeploy bản cũ qua `supabase functions deploy` — nhưng OTP đã gửi thì không thu lại được, và người đang giữa luồng bị kẹt | ~10 phút + người dùng kẹt giữa chừng |
| **Native `/apple`** | **Không có nút revert.** Qua App Store review, mà submit đang RED-gated | Không xác định |

**Không revert được:** migration đã áp, OTP/SMS đã gửi (đã tốn tiền thật), bản native. Chính ba thứ này làm cụm này RED bất kể CI xanh.

---

## Phải verify trước khi merge

- [ ] `node scripts/agents/risk-tier.mjs --files "<file cách nhau bằng DẤU CÁCH>" --strict`
- [ ] Race harness cho `register_team_for_doubles_elimination` — 2 request song song vào suất cuối, kỳ vọng đúng 1 thành công (tái dùng harness của QA-03/DB-00)
- [ ] Test RLS bằng đúng role `anon` và `authenticated`, **không** dùng SQL editor superuser
- [ ] Migration có khối `GRANT` + `NOTIFY pgrst`
- [ ] `npm run auth:registry -- --strict` nếu đụng bất kỳ edge function nào
- [ ] Đăng ký social event bằng OTP vẫn chạy **sau** khi sửa `phone-otp-send` (test tay, đây là hồi quy nguy hiểm nhất)
- [ ] `npm run build` — số bundle thật so với 1970 KB
- [ ] `curl -A "Googlebot" .../tools/quick-tables/<id>` còn `noindex`

---

## Khuyến nghị thẳng

**UX-06 dạng "undo tổng quát": đừng làm.** Cuong tự nói chưa từng đau thật. Bỏ 4 ngày dựng soft-delete xuyên 4 bảng, ~83 điểm đọc, một migration không revert được — để phòng một sự cố chưa từng xảy ra — là đổi rủi ro chắc chắn lấy rủi ro giả định. Phiên bản lười mà đúng: **một RPC xoá có kiểm tra, từ chối xoá khi giải còn đăng ký / đã có người trả tiền / đã có trận đấu xong**, hard-delete chỉ với giải rỗng. Không cột `deleted_at`, không undo, không migration lớn. Chặn nhầm lẫn hiệu quả hơn hoàn tác nhầm lẫn, và diff nhỏ hơn một bậc.

**UX-07 luồng khách: đừng làm ở vòng này.** Không phải vì ý tưởng sai — bất đối xứng giữa social event (cho khách) và giải (bắt tạo tài khoản) là giả thuyết tốt. Mà vì mở nó **trước khi** vá race #1 và #2 là chủ động bơm tải vào hai đường ghi không an toàn. Thứ tự đúng: (a) vá lock cho doubles-elimination, (b) quyết QuickTable là "đăng ký có sức chứa" hay "xin tham gia chờ duyệt" rồi enforce trong DB, (c) gắn journey `player_registration` cho nhánh giải để có baseline, (d) **rồi mới** bàn luồng khách.

Riêng (c) là việc GREEN/AMBER, làm được ngay, và đúng luật nhà "instrument trước khi tối ưu" (D1 của cụm UX-01..05). Nếu cụm này chỉ ship được một thứ, ship (c) và (a).

---

## Phản biện độc lập (GPT-5.6)

Đã chạy. Nguyên văn: `docs/proposals/ux-06-07-undo-discovery/external/risk-auditor-gpt.md`. Panel **không** thiếu model.

**Đã xác minh trong repo và giữ lại:**
- Race doubles-elimination (#1) — em đọc trọn hàm, xác nhận không có lock. GPT nói đúng và nói mạnh hơn em định nói.
- OTP hard-scope `social_events` (#3) — xác minh `index.html`... đúng hơn: `index.ts:161-185`. Đúng.
- Cascade không chạy khi UPDATE (#5) — đúng theo ngữ nghĩa Postgres.
- Bẫy `GRANT` thiếu → `42501` (#6) — trùng khớp `lessons-learned.md:8`, đã tái diễn 3+ lần. Đúng.
- Đăng ký chen vào cửa sổ đã xoá (#8) — đúng, FK không quan tâm `deleted_at`.
- "Đừng dựng soft-delete tổng quát, hãy chặn xoá khi còn state" — em đồng ý và lấy làm khuyến nghị chính.

**Bác bỏ / chỉnh lại:**
- **"SSR và search preview bị stale, bot thấy giải đã xoá" gán mức nghiêm trọng SEO — SAI.** Trang `/tools/*` đã `noindex, follow` (`functions/_lib/render/tournaments.ts:112,124`) và **không** nằm trong `sitemap-tournaments.xml.ts` (file này chỉ đọc bảng `tournaments`). Không có ô nhiễm chỉ mục. Hạ xuống Thấp.
- **"Adding an anon INSERT policy would bypass Turnstile" — mô tả như rủi ro hiện có là SAI.** Policy hiện tại là `WITH CHECK (user_id = auth.uid())` và **không có** GRANT nào cho `anon` trên `quick_table_registrations`. Hôm nay anon không ghi được. Đây là ràng buộc thiết kế cho tương lai, không phải lỗ hổng đang mở — giữ lại nhưng đổi nhãn.
- **"RLS `USING (deleted_at IS NULL)` làm restore bất khả thi" — đúng một nửa.** Postgres chỉ đòi quyền SELECT khi câu UPDATE tham chiếu giá trị cũ hoặc có `RETURNING`. `supabase-js` mặc định `.update().eq()` **không** kèm `.select()`, nên vẫn chạy. Nó chỉ gãy khi ai đó chain `.select()` — mà pattern trong repo này rất hay chain. Là cái bẫy thật, nhưng không phải chặn cứng như GPT mô tả.
- GPT bỏ sót thứ em cho là sắc nhất: **`UNIQUE(table_id, user_id)` là guard chống spam duy nhất của QuickTable, và nó khoá theo `user_id`.** Luồng khách xoá sổ chính xác cái guard đó. GPT nói QuickTable "không có enforcement", chưa đúng hẳn — có, nhưng đúng cái mà UX-07 sẽ phá.

**Chỗ em và GPT bất đồng rõ:** GPT xếp UX-07 nguy hiểm hơn UX-06. Em đồng ý về thứ hạng nhưng không đồng ý ngụ ý rằng UX-06 "làm cẩn thận thì được" — với "chưa từng đau thật", UX-06 nên bị cắt phạm vi vì **YAGNI**, không phải vì khó làm đúng.
