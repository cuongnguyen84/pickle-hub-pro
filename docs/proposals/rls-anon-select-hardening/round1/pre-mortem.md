# pre-mortem — rls-anon-select-hardening (nguyên văn)

Đã đủ căn cứ. Ba postmortem dưới đây, mỗi cái một cơ chế khác nhau, mọi mắt xích trỏ file thật.

---

## Pre-mortem: rls-anon-select-hardening

Dữ kiện chung cho cả ba: migration REVOKE SELECT + GRANT cột an toàn được áp **thẳng vào prod DB qua Management API PAT** (standing authorization, `docs/proposals/.../00-intake.md:24`), có hiệu lực **tức thì**. Bản vá web đổi `select('*')` → `select(<cột hẹp>)` chỉ **live sau khi Cloudflare Pages build xong** (~3-5 phút). Hai đồng hồ này không khóa vào nhau. Đó là hạt giống của Sự cố 1. Fact kỹ thuật xuyên suốt: PostgREST `select('*')` expand ra mọi cột; Postgres kiểm quyền cột **trước** RLS; thiếu quyền một cột → cả câu query ném `42501 permission denied`, không phải trả về cột null. Và quyền cột áp cho cả **mệnh đề WHERE**, không riêng phần chiếu.

---

### Sự cố 1 — "Giữa trận, cả bảng đấu đội trắng xoá: 'Không tải được danh sách đội' suốt 4 phút cho mọi người"
**Xác suất:** cao · **Thời gian tới lúc phát hiện:** 1-3 phút (nhưng nhầm nguyên nhân)

**Timeline**
- T+0:00 — Áp migration qua Management API. Prod DB REVOKE SELECT ON `team_match_teams` FROM anon, authenticated ngay lập tức; GRANT lại các cột an toàn (thiếu `invite_code`/`captain_user_id`/`payment_status`).
- T+0:00 — Bản vá web (`useTeamMatchTeams.ts:62` đổi `select('*')` → hẹp) **vẫn đang build** trên Cloudflare. Mọi client đang mở dùng bundle CŨ với `select('*')`.
- T+0:05 — Người xem `/tools/team-match/:id` (route public mặc định, `App.tsx:546`) gọi `useTeamMatchTeams` → `select('*')` → `42501` → React Query `throw error` (`useTeamMatchTeams.ts:67`) → `teams` = undefined. `TeamMatchView.tsx:113` render `TeamList`/`StandingsTable`/`TeamMatchPaymentSection` với data rỗng → khu vực đội trắng.
- T+0:06 — Một giải team-match đang đá **live** (status `ongoing`). Đội trưởng bấm F5 để xem bảng xếp hạng vòng bảng → trắng. `useUserTeam` (`:602`) cũng `select('*')` → cũng ném → nút "Nộp lệ phí" biến mất.
- T+0:30 — BTC (Cuong hoặc organizer) mở đúng giải đó thấy trắng, tưởng site sập.
- T+3:30 — Cloudflare deploy xong, client refresh lấy bundle mới → tự khỏi. Cửa sổ đóng, không ai kịp hiểu.

**Cơ chế**
`useTeamMatchTeams.ts:62` (`select('*')`) → sau REVOKE, expand ra cột bị thu quyền → `42501` → `:67 throw` → `TeamMatchView.tsx:113 teams=undefined` → cả tab Teams/Standings/Payment render rỗng. Song song `useUserTeam.ts:602` và `TeamMatchPaymentSection.tsx:102-103` (đọc `payment_status` từ list — comment `:101` ghi thẳng "select '*' có payment_status") cùng chết.

**Vì sao mọi gate vẫn xanh**
Panel duyệt migration và diff web **cùng lúc** — hai cái nhất quán với nhau (web mới đọc cột hẹp, schema mới cho cột hẹp). CI chạy web-MỚI × schema-MỚI: xanh. Soak 30 phút chạy **sau** khi deploy đã settle: cũng là mới×mới, xanh. **Không một stage nào test tổ hợp web-CŨ × schema-MỚI** — mà đó chính là trạng thái tồn tại 3-5 phút giữa hai đồng hồ. Cửa sổ này không có ô nào để tick.

**Ai báo, sau bao lâu**
Organizer nhắn Facebook/Zalo "web sập rồi à, đang đá dở" trong 1-3 phút. Đến lúc Cuong mở xem thì đã tự khỏi → xếp nhầm vào "deploy-race flake" (đúng loại đã bị nhầm nhiều lần, lessons-learned mục 2026-07-18/19). Cơ chế thật không được ghi nhận → **lặp lại y hệt ở migration REVOKE lần sau**.

**Vì sao khó sửa**
`git revert` bản vá web KHÔNG cứu được — vấn đề là schema đã đổi, không phải code. Muốn cứu phải GRANT lại cột trên prod (một migration ngược nữa), lại qua Management API, lại có độ trễ. Trong lúc đó giải live vẫn trắng.

**Dấu hiệu sớm lẽ ra phải có**
Không có monitoring nào bắt: lỗi nằm ở client (`throw` trong React Query), không phát ra edge-function log hay Supabase error rate mà ai đang nhìn. Lẽ ra một alert trên tỉ lệ `42501` từ PostgREST logs sẽ nổ ngay giây T+0:05 — nhưng không ai gắn.

---

### Sự cố 2 — "App iPhone không hiện đội nào nữa, và không bản update nào sửa được"
**Xác suất:** cao · **Thời gian tới lúc phát hiện:** 3-14 ngày (âm thầm)

**Timeline**
- T+0 — Migration áp prod. `payment_status` và `captain_user_id` bị REVOKE khỏi anon/authenticated.
- T+0 — App native `/apple` trên iPhone người dùng **không tự đổi query**. `TeamMatchRepository.swift:44` hardcode `.select("id, team_name, seed, group_id, status, payment_status, created_at")` — có `payment_status`, cột vừa bị thu quyền.
- T+0:01 — Mọi lần mở màn team-match trong app native → PostgREST trả `42501` → `try? await ... .execute().value` nuốt lỗi thành `nil` (`Repository.swift:44`, dùng `try?`) → danh sách đội **rỗng**, không error banner, chỉ là màn trống trơn.
- T+0:01 — `userTeam(tournamentID:)` (`Repository.swift:407`) lọc `.eq("captain_user_id", value: uid)` — WHERE trên cột bị thu quyền → `42501` → `nil` → đội trưởng trong app không thấy đội mình, mất luôn trạng thái lệ phí.
- T+3 ngày — Vài người dùng iPhone tưởng "app lỗi", gỡ cài lại — **vẫn thế**, vì binary mới nhất trên App Store cũng hardcode chuỗi cột cũ.

**Cơ chế**
`apple/.../TeamMatchRepository.swift:44` (`select(... payment_status ...)`) → `42501` → `try?` nuốt → `[]`. Và `:407` (`.eq("captain_user_id", ...)`) → WHERE cần SELECT-quyền trên `captain_user_id` → `42501` → `nil`. Không có đường web-deploy nào chạm tới binary đã cài trên máy người dùng.

**Vì sao mọi gate vẫn xanh**
Native **không nằm trong web CI**. `check-bundle-size`, `rls_auth_matrix.test.sql`, smoke Playwright — không cái nào import hay chạy code Swift. Panel /idea và intake nói "không phá native" như một mục tiêu, nhưng **không có một job nào kiểm chứng** mục tiêu đó. Soak 30 phút chạy trên web preview. Native trắng màn hoàn toàn nằm ngoài tầm nhìn của mọi cổng.

**Ai báo, sau bao lâu**
Rất chậm. Team-match trên native là tính năng ngách; có thể 3-14 ngày mới có người iPhone than "app không hiện đội". Vì `try?` nuốt lỗi thành màn rỗng chứ không crash, không có Sentry/log nào nổi. Niềm tin bị ăn mòn âm thầm: người dùng kết luận "app này hỏng" chứ không báo bug.

**Vì sao khó sửa**
`git revert` vô nghĩa với binary đã cài. Ngay cả khi ship app mới đổi chuỗi cột, **người dùng không bao giờ update** (fact trong đề bài, và app native = luồng riêng ít ai cập nhật). Cách duy nhất cứu người dùng cũ: **không được revoke `payment_status`/`captain_user_id`** — tức phải rollback thiết kế bảo mật. Đây là ràng buộc cứng: native hardcode cột → cột đó **không thể** revoke mà không bỏ rơi mọi binary đang chạy.

**Dấu hiệu sớm lẽ ra phải có**
`grep -rn "payment_status\|captain_user_id" apple/` trước khi soạn migration (recon đã liệt `Repository.swift:44` rồi — bằng chứng nằm sẵn trong `round1/idea-recon.md:16`). Không ai chạy grep đó đối chiếu với danh sách cột định revoke.

---

### Sự cố 3 — "BTC xoá nhầm giải đã có 6 đội nộp lệ phí vì hộp thoại báo '0 đội đã nộp'"
**Xác suất:** trung bình · **Thời gian tới lúc phát hiện:** vài giờ đến khi có người đòi tiền — không phục hồi được

**Timeline**
- T+0 — Migration revoke `payment_status` khỏi authenticated (để ẩn trạng thái lệ phí khỏi người ngoài). "Đường riêng organizer" được hình dung là một RPC SECURITY DEFINER — nhưng organizer thật đọc `payment_status` bằng query **thường**, scoped theo `tournament_id`, không qua RPC.
- T+0 — Organizer mở `/my-tournaments`, bấm xoá một giải team-match cũ. Hộp thoại "bạn sắp xoá gì" fetch impact: `MyTournaments.tsx:227-230` `select('payment_status').eq('tournament_id', target.id)`.
- T+0:01 — Query `42501` (thiếu quyền cột `payment_status`) → `:231 throw` → `retry:false` (`:223`) → `isError=true`.
- T+0:02 — Hộp thoại degrade: không hiện được số đội đã nộp (hoặc hiện `paidTeams: 0` nếu UI fallback về 0 khi lỗi). Organizer thấy "0 đội nộp lệ phí", yên tâm bấm Xác nhận xoá.
- T+0:03 — `deleteTournament` (RPC SECURITY DEFINER, bypass quyền cột) chạy ngon → giải + 6 đội đã `confirmed` bị xoá cascade.
- T+vài giờ — 6 đội trưởng đã chuyển khoản nhắn hỏi "giải biến mất, tiền lệ phí em sao?"

**Cơ chế**
`MyTournaments.tsx:229` (`select('payment_status')` scoped tournament) → `42501` → `:231 throw` → impact dialog mất khả năng đếm đội đã nộp → organizer xoá mù. Cùng lớp lỗi: `useUserMembership.ts:571` join `team_match_teams!inner(...)` — nếu revoke chạm cột dùng trong join sẽ kéo theo. Điểm mấu chốt: **quyền cột chặn cả read của chính organizer**, không chỉ người lạ, vì các read hợp lệ này đi qua PostgREST chứ không qua SECURITY DEFINER.

**Vì sao mọi gate vẫn xanh**
Không test nào của repo chạm luồng xoá-impact với schema mới (`rls_auth_matrix.test.sql` không nhắc `team_match_*` — recon `:36`). Panel đọc migration thấy "đã có RPC riêng cho organizer" và tin rằng mọi read organizer đi qua đó — **nhưng `MyTournaments.tsx:229` là một select thường mà không ai map vào danh sách "read cần chuyển sang SECURITY DEFINER"**. Đây đúng là bug hợp thành: "ẩn cột" + "một caller lẻ đọc cột đó bằng query thường, scoped hợp lệ" = read hợp lệ bị chặn, và hậu quả rơi vào một nút phá huỷ dữ liệu.

**Ai báo, sau bao lâu**
Đội trưởng đòi tiền — sau khi dữ liệu đã mất. Không ai thấy lúc T+0:02 vì "0 đội nộp" trông hợp lý, không phải màn đỏ.

**Vì sao khó sửa**
Đây là loại tệ nhất: **mất dữ liệu, không revert được**. Giải + roster + lịch sử lệ phí đã cascade-delete. `git revert` không mọc lại row. Phải khôi phục từ PITR backup của Supabase (nếu có bật) — tốn giờ và rủi ro lệch state.

**Dấu hiệu sớm lẽ ra phải có**
`impactErrored` (`MyTournaments.tsx:219`) lẽ ra phải **chặn nút Xoá** khi không đọc được impact, thay vì để organizer xoá mù. Không có guard đó → lỗi đọc biến thành xoá nhầm.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|-------|----------|---------------|---------|
| 3 | Organizer xoá nhầm giải đã thu lệ phí | TB | Cao (trông như "0 đội") + **mất dữ liệu vĩnh viễn** | **1** |
| 2 | Native iPhone trắng màn, không update được | Cao | Cao (âm thầm 3-14 ngày, `try?` nuốt lỗi) | **2** |
| 1 | Cửa sổ deploy trắng bảng đấu live | Cao | Thấp (tự khỏi 3-5 phút, nhưng nhầm là flake) | **3** |

Sự cố 3 lên đầu vì nó phá niềm tin theo cách `git revert` không cứu được (đúng tiêu chí đề bài). Sự cố 2 xếp trên 1 vì âm thầm dài ngày và **không có đường sửa cho người dùng cũ**, trong khi 1 tuy tổng-thể-sập nhưng tự lành nhanh.

## Rẻ nhất để chặn từ bây giờ

1. **Chỉ revoke `invite_code`, để nguyên `payment_status` và `captain_user_id`.** `invite_code` là cột DUY NHẤT không có read-path hợp lệ nào ở client: `useTeamByInviteCode` (`useTeamMatchTeams.ts:615`) là dead code (recon `:42`), không caller. Còn `payment_status` bị đọc ở web list, native list, và MyTournaments; `captain_user_id` bị **lọc trong WHERE** ở `useUserTeam.ts:604`, `Repository.swift:407`. Revoke hai cột này = giết cả ba sự cố. Revoke mình `invite_code` = diệt đúng cái leak thật (join-đội-bằng-mã) với blast radius = 0. Một dòng REVOKE thay vì cả loop.
2. **Guard xoá mù:** ở `MyTournaments.tsx`, khi `impactErrored` thì disable nút Xác nhận xoá thay vì hiện `paidTeams: 0`. Một điều kiện.
3. **Nếu vẫn phải revoke `payment_status`:** deploy web (select hẹp) **trước**, chờ Cloudflare xanh, **rồi mới** áp migration — vì select hẹp tương thích ngược với schema cũ. Một dòng thứ tự trong runbook. Và không revoke được cột nào native đang hardcode cho tới khi có floor-version check.

## Khoảng hở của pipeline mà bài này lộ ra

- **Không stage nào test tổ hợp client-CŨ × schema-MỚI.** CI/panel/soak đều là mới×mới. Mọi migration REVOKE một quyền đang tồn tại đều tạo cửa sổ này (Sự cố 1). Đề xuất: `risk-tier.mjs` gắn nhãn `client-coupled` cho migration chứa `REVOKE`, và gate nó trên "bản client tương thích-ngược đã live" trước khi cho áp.
- **Native binary không phải input của bất kỳ cổng nào.** "Không phá native" là mục tiêu trong intake nhưng không có job kiểm chứng. Tối thiểu: một grep-gate đối chiếu cột định revoke với `grep -rn "<col>" apple/` (bằng chứng đã nằm sẵn ở recon `:16`, chỉ là không ai biến nó thành cổng).
- **Migration áp qua Management API bỏ qua toàn bộ gate deploy của web.** Prod DB đổi tức thì trong khi mọi cổng CI gắn với PR/Cloudflare. Không có bước nào ép migration REVOKE phải đi sau một deploy web đã xác nhận live — đây là feedback trực tiếp cho `/idea`: cổng phải coi "migration REVOKE" và "web deploy" là **một đơn vị nguyên tử có thứ tự**, không phải hai việc rời.
