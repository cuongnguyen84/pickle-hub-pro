# pre-mortem — referee-pin (vòng 1, nguyên văn)

Đã đọc intake, recon, lessons-learned, ops-runbook §5, và đào 4 bảng `*_referees` + RLS + engine live-state + migration lockdown. Ba postmortem dưới đây, mỗi cái một cơ chế khác nhau, mọi mắt xích trỏ file thật.

Một dữ kiện nền chốt trước, vì cả ba câu chuyện đứng trên nó: redemption PIN **không thể** là một client `.insert()` bình thường — policy `"Creator can add referees"` (`supabase/migrations/20251224070047_...:60-66`) chỉ cho `is_quick_table_creator()` INSERT vào bảng referee. Nên PIN-flow **buộc** phải là một RPC `SECURITY DEFINER` (hoặc edge function) tự nhập referee row. Cái RPC đó là trust boundary duy nhất của feature. Cả ba sự cố đều là chuyện cái RPC đó, hoặc cột PIN nó đọc, làm sai.

---

## Sự cố 1 — "Nhà vô địch giải Doubles Elim tối thứ 7 bị đổi thành người thua, 19 ngày sau khi giải kết thúc"
**Xác suất:** cao · **Thời gian tới lúc phát hiện:** ~3 tuần (tình cờ, không phải alert)

**Timeline**
- T+0 (thứ 7, 19:30): Giải Doubles Elimination thật ở sân Tân Bình. BTC bật PIN trong wizard, chiếu PIN `4827` lên máy chiếu để 3 trọng tài sân tự join thay vì phải đọc email cho BTC add tay.
- T+3h30 (23:00): Chung kết xong, `final_placement=1` được ghi cho đội vô địch (`src/lib/doublesElimResult.ts:46` suy ra winner). Giải "kết thúc" theo cảm nhận mọi người. Cuong đang ngủ.
- T+3h30: Redemption RPC đáng lẽ vô hiệu PIN vì "giải có nhà vô địch" — **nhưng không**. Xem cơ chế.
- T+19 ngày: Một người thua bán kết, đã chụp màn hình PIN `4827` tối đó, đăng nhập, nhập PIN, thành trọng tài trở lại. Sửa tỉ số trận chung kết → `final_placement` đảo. Bảng xếp hạng giải giờ ghi sai vô địch.
- T+19 ngày + vài giờ: Nếu `dupr-sync` chạy lại trên trận đã sửa, rating DUPR của 4 người trong trận chung kết bị đẩy sai.
- Phát hiện: đội vô địch thật lên xem lại giải để khoe, thấy tên mình biến mất. Nhắn Cuong.

**Cơ chế**
Predicate "PIN tự hết hạn khi giải kết thúc (có nhà vô địch)" (`00-intake.md:10`) chỉ có một cách cài đặt hợp lý trong RPC: `WHERE status <> 'completed'`. Cho Quick Table / Team Match thì `status` là enum có `'completed'` (`types.ts:8800,8810`). Nhưng:

`supabase/migrations/20260529120000_...:28` cho phép `doubles_elimination_tournaments.status = 'completed'` trong CHECK constraint — **nhưng không dòng code nào ghi giá trị đó.** `grep` toàn repo cho setter status→completed trên `doubles_elimination_tournaments` trả về **rỗng**. Flex cũng vậy (`useFlexTournament.ts` chỉ update `name`/`is_public`/settings, không đụng status). Chính app cũng biết điều này: `src/components/tools/MyRefereeTournaments.tsx:20-23` tách "đang diễn ra" vs "đã xong" bằng `status !== 'completed'` — với hai format này, **mọi giải vĩnh viễn nằm ở nhóm "đang diễn ra".**

Vậy predicate hết hạn `status = 'completed'` **không bao giờ đúng** cho Doubles Elim + Flex. PIN sống vĩnh viễn. Cộng thêm: RLS trên bảng match **không hề kiểm tra status** — referee có UPDATE bất kể giải đã xong hay chưa. Ba thứ vô hại: (a) expiry gắn vào `completed`, (b) hai format không ai ghi `completed`, (c) PIN bị chiếu công khai — gặp nhau.

**Vì sao mọi gate vẫn xanh**
Reviewer đọc RPC thấy `status <> 'completed'`, mở Quick Table kiểm chứng — nó flip completed, hết hạn đúng. Doubles Elim/Flex **cùng một tên cột `status`, cùng enum cho phép `'completed'`** — nhìn giống hệt, không ai nghĩ phải grep xem có *setter* không. Soak 30 phút tạo giải test rồi bỏ; nó **không bao giờ chơi tới lúc có nhà vô địch thật + final_placement** cho một Doubles Elim, nên trạng thái "giải xong mà PIN vẫn sống" không nằm trong quỹ đạo soak. CI test engine chấm điểm (`refereeScoring.test.ts`) chứ không test vòng đời cấp quyền (recon dòng 35-37 xác nhận: 0 test cho add/remove referee).

**Ai báo, sau bao lâu**
Không ai. Không exception, không alert — một PIN hợp lệ redeem thành công là "happy path". 19 ngày sau đội vô địch tự phát hiện bằng mắt. Đây là kiểu ăn mòn niềm tin: giải đã trao cúp rồi mà bảng lật ngược.

**Vì sao khó sửa**
`git revert` code không lấy lại được dữ liệu — `final_placement` và tỉ số đã bị ghi đè, không có bảng audit ("ai chấm" ở intake dòng 8 chỉ là kỳ vọng, chưa có bảng). Nếu DUPR đã re-sync thì rating sai đã ra khỏi hệ thống, phải nhờ DUPR rollback thủ công. Và bug gốc là **thiếu một khái niệm** (hai format không có trạng thái "kết thúc") — vá nhanh kiểu "hết hạn sau 24h" thì phá use-case giải chạy 2 ngày.

**Dấu hiệu sớm lẽ ra phải có**
Một redeem PIN xảy ra **sau** khi trận cuối đã có kết quả lẽ ra phải log WARNING ("PIN redeemed on tournament with a decided final"). Không có, vì redeem thành công không log gì.

---

## Sự cố 2 — "Toàn bộ PIN của mọi giải đang chạy ở VN bị cào bằng anon key trong một request"
**Xác suất:** trung bình-cao · **Thời gian tới lúc phát hiện:** vô hạn (không có cách phát hiện nội tại)

**Timeline**
- T+0: Feature ship. PIN lưu là một cột trên bảng giải — cách rẻ nhất và gần như chắc chắn sẽ chọn: `quick_tables.referee_pin`, `doubles_elimination_tournaments.referee_pin`, v.v. (bỏ một bảng riêng vì shape 1-1 với giải).
- T+bất kỳ: Ai đó — hoặc chỉ một người tò mò mở DevTools — gọi `supabase.from('quick_tables').select('id, share_id, referee_pin').eq('is_public', true)` bằng anon key lấy từ bundle. Trả về PIN của **mọi giải public**.
- Hệ quả: người đó thành trọng tài của bất kỳ giải nào đang chạy, bất kỳ lúc nào, không cần chụp màn hình gì.
- Phát hiện: không có. Cho tới khi có người khoe trên Facebook group hoặc phá một giải lớn.

**Cơ chế**
`quick_tables` có policy `"Public tables are viewable by anyone" FOR SELECT USING (is_public = true)` (`20251223034604_...:133-135`) — **row-level, trả về mọi cột.** Các format khác cũng có share-view public tương tự. Cột `referee_pin` mới thêm vào ngay lập tức đọc được.

Bài học đã có tên trong repo: `supabase/migrations/20260722000000_team_match_invite_code_lockdown.sql:11-16` — "RLS is ROW-level and cannot hide COLUMNS". `invite_code` bị rò đúng kiểu này, verified live trên prod 2026-07-21. PIN là **cùng loại secret** (join secret cấp quyền), nhưng nằm trên bảng **khác** (`quick_tables`, không phải `team_match_teams`), nên migration lockdown kia không chạm tới. Tệ hơn: DO-block của lockdown (`:51-67`) re-grant SELECT cho *mọi cột trừ invite_code* — nghĩa là khi migration đó replay trên schema mới, một cột `referee_pin` thêm sau sẽ được **tự động cấp SELECT lại** (chính cảnh báo `:46-50` nói điều này). Client cũng góp phần: `referee-helpers.ts:108-110`, `useDoublesElimination.ts:258-293`, `useFlexTournament.ts:135-241` đều `.select('*')` — cột PIN đi ké ra UI, lộ cả trong response network của người dùng thường.

**Vì sao mọi gate vẫn xanh**
Test RLS kiểm "row nào thấy được" — và row **đúng là** public theo thiết kế (cần cho share-view, badge đếm đăng ký). Không test nào bắt lỗi *cột*, vì RLS không phải công cụ cho cột. Panel review dồn vào **đường ghi** PIN (chỉ organizer set được — đúng) và vào RPC redemption (compare an toàn — đúng); không ai soi **đường đọc** cột lưu trữ. Bài học lockdown sống trong *comment của một file migration*, không phải một check tự động — không gì fail khi cột secret mới ra đời.

**Ai báo, sau bao lâu**
Không ai, trong thời gian không xác định. Cào PIN là một `SELECT` hợp lệ, giống hệt traffic bình thường. Chỉ lộ khi hậu quả (một giải bị phá) nổi lên — và lúc đó thủ phạm là "một trọng tài hợp lệ", không truy ngược được.

**Vì sao khó sửa**
Sửa được nhanh về mặt cột (REVOKE + re-GRANT trừ `referee_pin`, theo đúng khuôn `20260722000000`), **nhưng** — theo đúng cảnh báo apply-order `:32-34` của chính migration đó — mọi bundle cũ đang `select('*')` trên bảng đó sẽ `42501` toàn bộ query một khi REVOKE cột. Nghĩa là phải deploy web narrow-select **trước**, chờ confirm live, rồi mới REVOKE. Trong khoảng đó PIN vẫn lộ. Và mọi PIN đã bị cào thì phải **xoay toàn bộ** (organizer đổi PIN từng giải) — không có nút "rotate all".

**Dấu hiệu sớm lẽ ra phải có**
Một grep CI đơn giản: "cột nào tên `*_pin`/`*secret*` trên bảng có policy SELECT public mà chưa có REVOKE cột-level" → fail build. Không có, nên cột secret mới lẳng lặng ra prod.

---

## Sự cố 3 — "Tỉ số trên máy chiếu nhảy loạn giữa trận chung kết, không ai chấm sai — có kẻ brute-force PIN từ trong khán đài"
**Xác suất:** trung bình · **Thời gian tới lúc phát hiện:** vài phút (rất ồn) — nhưng không chặn được tại chỗ

**Timeline**
- T+0 (thứ 7, 20:45): Giải Quick Table đang live, tỉ số hiện realtime lên máy chiếu và trên điện thoại khán giả.
- T+2 phút: Một khán giả (hoặc bot) biết `share_id` từ URL công khai, script gọi RPC redemption thử PIN `0000`→`9999`. PIN 4 chữ số, RPC **không rate-limit**.
- T+2 phút 40s: Trúng PIN. Thành trọng tài của **cả giải** — không phải một sân.
- T+3 phút: Kẻ đó mở màn chấm điểm, ghi đè `referee_live_state` của trận đang chiếu. Serve/điểm nhảy lung tung trên mọi màn hình. Trọng tài thật ở sân bối rối, tưởng app lỗi.
- T+10 phút: BTC gọi điện Cuong. Cuong đang ngủ. Không có nút "kick referee" khẩn cấp (chỉ creator remove được, mà creator = BTC đang cầm còi ngoài sân, không mở laptop).

**Cơ chế**
Hai điểm yếu độc lập gặp nhau:

1. **Brute-force khả thi.** Intake gọi nó là "PIN code hoặc mật khẩu" — mặc định UX sẽ là 4-6 chữ số. Repo **có sẵn** khuôn chống brute-force đúng bài: `supabase/functions/phone-otp-send/index.ts` (mã ngắn + TTL + rate-limit qua bảng `otp_codes`). Nhưng đó là trục SMS không-đăng-nhập; recon (dòng 25) ghi rõ nó "khác trục". Rủi ro là RPC redemption mới **không copy** rate-limit đó — `share_id` công khai + không giới hạn lần thử + không gian PIN nhỏ = dò được trong phút.

2. **Referee = quyền toàn giải, và live-state không có khóa ghi.** Quyền trọng tài (`can_edit_quick_table_scores`, `20251224070047_...`) cho UPDATE **mọi** match của giải, không gắn theo sân. Tỉ số cuối được bảo vệ bằng optimistic token `score_version` (`20260722030000_atomic_bracket_score_correction.sql`), nhưng `referee_live_state` thì **không**: `20260717150000_referee_live_state.sql:1-18` thêm nó dưới dạng jsonb thuần, "additive + nullable, no RLS change", **không có version, last-write-wins**, và spectator đọc realtime từ chính row đó. Nên kẻ phá không cần thắng cuộc đua ghi tỉ số cuối — chỉ cần spam `referee_live_state` là màn hình khán giả loạn ngay.

**Vì sao mọi gate vẫn xanh**
Soak/CI redeem PIN bằng đúng PIN test → luôn trúng phát đầu, **không bao giờ đo được đường sai/dò**. Không có test tải nào bắn 10k lần redeem. `refereeScoring.test.ts` test logic điểm với **một** người chấm — không mô phỏng hai referee (thật + troll) cùng ghi `referee_live_state`, nên hiện tượng clobber last-write-wins không lộ. Panel review bảo mật RPC ("compare có constant-time không") mà bỏ qua "gọi được bao nhiêu lần/giây", vì rate-limit là thuộc tính vận hành không phải một dòng code sai rõ ràng.

**Ai báo, sau bao lâu**
Rất nhanh (BTC thấy ngay) nhưng **không tự chặn được**: người duy nhất remove referee là creator, đang cầm còi. Thời gian phát hiện ngắn nhưng thời gian *khắc phục* dài vì thiếu đường kill khẩn.

**Vì sao khó sửa**
Ngay lúc đó gần như không sửa được nếu không có organizer mở dashboard. Sau sự cố, đổi PIN thì kẻ kia đã là referee row rồi — đổi PIN **không** thu hồi quyền đã cấp (redeem tạo row độc lập, không tham chiếu PIN nữa). Phải xoá row referee thủ công.

**Dấu hiệu sớm lẽ ra phải có**
> N lần redeem thất bại liên tiếp trên cùng `share_id` = alert. Không có, vì redeem thất bại không được đếm ở đâu.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|-------|----------|---------------|---------|
| 2 | PIN cào sạch qua `select('*')` / cột public | TB-cao | **Cực cao** (không có tín hiệu nội tại, im lặng vô hạn) | **1** |
| 1 | PIN không hết hạn (thiếu setter `completed` Doubles/Flex) → sửa kết quả sau nhiều tuần | Cao | Cao (~3 tuần, phát hiện tình cờ) | **2** |
| 3 | Brute-force + troll live-state giữa giải | TB | Thấp (ồn, phát hiện vài phút) | 3 |

Sự cố 2 xếp trên dù sự cố 3 "thảm" hơn về cảm giác: #3 nổ to nên được sửa ngay và niềm tin phục hồi được; #2 âm thầm rò secret nền tảng vô thời hạn — đúng loại "mất niềm tin thì `git revert` không lấy lại". #1 nằm giữa vì nó vừa im vừa **hỏng dữ liệu vĩnh viễn** (kết quả giải + DUPR).

---

## Rẻ nhất để chặn từ bây giờ

1. **Không lưu PIN thành cột trên bảng giải public.** Lưu ở bảng riêng `tournament_referee_pins` (hoặc chỉ lưu **hash** PIN) mà anon/authenticated **không có** SELECT — chỉ RPC `SECURITY DEFINER` đọc để so. Diệt Sự cố 2 tận gốc, không cần nhớ REVOKE cột về sau. Kèm CI grep: bảng có policy SELECT public + cột `*_pin|*secret*` chưa REVOKE cột-level = fail (chặn cả lần sau).
2. **Predicate hết hạn không được dựa vào `status = 'completed'`** cho Doubles Elim/Flex vì không ai ghi giá trị đó (`grep` setter = rỗng). Dùng tín hiệu có thật: `final_placement=1 đã tồn tại` (`doublesElimResult.ts:46`) hoặc thêm `expires_at` cứng do organizer đặt trong wizard. Kèm **một test**: tạo Doubles Elim, chơi tới champion, assert `redeem_referee_pin` trả `EXPIRED`.
3. **Rate-limit + đếm-fail trên RPC redemption**, tái dùng đúng khuôn `phone-otp-send`/`otp_codes` đã có sẵn (đừng viết mới). N-fail/`share_id`/phút → khoá + log. Diệt brute-force của #3. Và thêm version cho `referee_live_state` (hoặc dùng chung `score_version`) để chặn clobber.

## Khoảng hở của pipeline mà bài này lộ ra

- **Không có gate cột-level cho secret.** Bài học `invite_code` (`20260722000000`) sống trong comment migration, không thành check tự động — nên secret **thứ hai** (PIN) đi thẳng vào cùng cái bẫy, trên bảng khác. `/idea` cần một luật lint: "cột secret mới + policy SELECT public = block".
- **Soak/CI không bao giờ chạm trạng thái cuối vòng đời.** Cả #1 và #3 sống được vì soak tạo-rồi-bỏ giải, chưa từng chơi tới champion, chưa từng thử PIN sai. Gate "xanh" đo happy-path; các weak-point ở recon là **exit states** (giải kết thúc) và **abuse states** (dò sai) — không có gì trong pipeline lái tới đó.
- **Thiết kế "tự hết hạn khi có nhà vô địch" giả định một khái niệm không tồn tại đồng nhất qua 4 format** — Doubles Elim/Flex không có trạng thái "kết thúc" được ghi. Đây là câu hỏi cho Cuong ở recon dòng 46 mà nếu bỏ qua sẽ thành Sự cố 1. Panel dễ tick "logic hết hạn: có" mà không hỏi "predicate này *bao giờ* thành true trên format này?".

Files trọng yếu để đọc khi thiết kế: `supabase/migrations/20251224070047_...` (RLS referee, INSERT creator-only), `20260722000000_team_match_invite_code_lockdown.sql` (khuôn cột-level), `20260717150000_referee_live_state.sql` (jsonb không khóa ghi), `20260529120000_...:28` (enum cho phép `completed` nhưng không ai ghi), `src/lib/referee-helpers.ts:108-110`, `src/components/tools/MyRefereeTournaments.tsx:20-23`, `supabase/functions/phone-otp-send/index.ts` (khuôn rate-limit tái dùng).
