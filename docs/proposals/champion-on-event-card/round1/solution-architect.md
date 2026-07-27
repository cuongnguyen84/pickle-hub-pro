## Tóm tắt kiến trúc

Điểm chốt của cả bài toán nằm ở `score_quick_table_match_atomic` (`supabase/migrations/20260722030000_atomic_bracket_score_correction.sql:236-255`): RPC này **đã** phát hiện đúng điều kiện "trận chung kết vừa xong" (vòng playoff cuối có đúng 1 trận, không có vòng kế tiếp) và tự set `quick_tables.status='completed'` — ngay tại đó biến `v_winner_id` đang nằm trong scope. Cả web lẫn native đều gọi chung RPC này (`src/hooks/useQuickTableMutations.ts:156`, `apple/ThePickleHub/Core/QuickTable/QuickTableRepository.swift:712`), nên denormalize champion vào 1 cột là thêm 1 mệnh đề `SET`, không phải viết logic mới. Đề xuất: ghi champion lúc kết thúc, cả 4 bề mặt đọc (card web, card multi-event, SSR bot, native) chỉ đọc 1 cột, 0 join, 0 query phụ.

**Nhưng trước đó, số liệu prod bắt buộc phải làm hẹp scope lại** — chi tiết ở mục "Điều em không chắc" và "Khuyến nghị".

### Số thật trên prod (query qua Management API, 2026-07-27)

| Format | Completed | Suy ra được champion |
|---|---|---|
| `quick_tables` round_robin | 84 (public) | **22** |
| `quick_tables` large_playoff | 4 | **0** (cả 4 bảng 0 trận — vỏ rỗng) |
| `doubles_elimination_tournaments` | **0** | **0** |
| `flex_tournaments` | 14 (5 public) | không định nghĩa được |

Ba điều này lật một phần scope đã chốt:

1. **`doubles_elimination_tournaments` chưa từng có row `completed`.** Status chỉ có `ongoing`(4) + `registration_open`(1); `doubles_elimination_matches` có **0** trận `round_type='final'` với `winner_id`. Card "completed doubles-elim" hôm nay là danh sách rỗng. Làm phần này = 0 giá trị hiển thị.
2. **`flex_matches` không có khái niệm chung kết** — không có `round_type`, không có `is_playoff`, chỉ có `group_id`/`display_order`/`counts_for_standings` (`types.ts:2165-2186`). Champion của flex chỉ có thể là top-1 standings của *một* group, mà completed flex trung bình 2 group (max 7), lại còn tách 3 tab singles/pairs/team (`src/lib/flexStats.ts` — `computePlayerStats`/`computePairStats`/`computeTeamStats`). Không có câu trả lời đúng để hiển thị.
3. **Round robin không tự có champion.** Cả 84 bảng round_robin completed đều `group_count > 1` — **0 bảng single-group**. `getGroupStandings` (`src/pages/QuickTableView.tsx:329-337`, sort `matches_won → point_diff → points_for`) chỉ xếp hạng *trong bảng*, không ra được nhà vô địch giải. Champion chỉ có khi giải có chạy playoff: 24/84 có playoff, 22 có final quyết định.

Chất lượng dữ liệu của 22 row đó cũng cần biết trước khi vẽ UI: `quick_table_players.name` là free-text tổ chức tự gõ — 12/22 trông như cặp đôi thật ("Đỗ Đăng Khương & Nguyễn Việt Hà", "Dư + Khoa", "Thu bé - Huyền Xinh", "Thế Cường, Thanh Huyền" — 4 kiểu dấu phân cách khác nhau), nhưng **5/22 là số trần ("5","6","7"), 1 là "test4"**. Và `player2_name` chỉ populated 3/22 — nghĩa là yêu cầu 'hiện tên cả 2 người "Cường & Nam"' **không thể build từ dữ liệu có cấu trúc**; thực tế chỉ có thể in `name` nguyên văn.

### Hai phát hiện làm rẻ đi đáng kể

- **`/tools/*` là `noindex`** (`functions/_lib/render/tournaments.ts:112,123,187,199` đều gắn `<meta name="robots" content="noindex, follow"/>`). Không sitemap, không hreflang, không route công khai mới → hard rule về SSR story được thỏa mặc định. Chỉ cần bump cache key `pr:v32` → `v33` (`functions/_middleware.ts:462`).
- **`og-quick-table` / `og-doubles-elimination` / `og-flex-tournament` là code chết.** Grep toàn repo: không file nào trỏ tới, ngoài `supabase/config.toml`, `auth-registry.json` và 1 test CORS. Nút share dựng URL `https://www.thepicklehub.net/tools/quick-tables/${shareId}` (`src/pages/QuickTableView.tsx:250`), mà `BOT_UA` (`functions/_lib/utils.ts:333`) đã bắt `facebookexternalhit|zalo|telegrambot` → bot social đi vào **Cloudflare middleware → `renderQuickTable`**, không bao giờ chạm edge function. Bề mặt "OG khi share" = `functions/_lib/render/tournaments.ts:104-113`, **không sửa 4 function `og-*`**. Cũng lưu ý: các render này không set `og:image` riêng, nên "OG image" thực chất là `og:description` — champion là 1 đoạn text, không phải vẽ ảnh.

---

## Option A — Denormalize `champion_name` + `champion_player_id` trên `quick_tables`

Effort: **4.5 nửa ngày** · Data: **có migration** (2 cột + patch RPC + backfill 22 row), không đụng RLS, không RPC mới

Files:
- `supabase/migrations/<ts>_quick_table_champion.sql` (mới)
- `supabase/tests/atomic_tournament_mutations.test.sql` (đã có 51 assertion cho RPC này — thêm case)
- `src/hooks/useTournamentData.ts:215,251` (thêm cột vào `.select()`)
- `src/pages/Tournaments.tsx:45-61` (`CommunityBracket`), `:100-108` (`renderMeta` quick-tables)
- `src/hooks/useFeaturedParentTournaments.ts:60-66`, `src/components/quicktable/ParentTournamentCard.tsx:287-300`
- `functions/_lib/render/tournaments.ts:104-113` + bump `pr:v32`→`v33` ở `functions/_middleware.ts:462` + ghi `docs/prerender-cache-log.md`
- `apple/ThePickleHub/Core/Tools/ToolsRepository.swift:215` (select) + card view
- `src/i18n/vi.ts` (interface + string), `src/i18n/en.ts`

**Cách chạy:** trong block `IF v_current_round_count = 1 AND NOT EXISTS(...)` đã có sẵn, đổi 1 câu UPDATE:

```sql
UPDATE public.quick_tables qt
SET status = 'completed',
    champion_player_id = v_winner_id,
    champion_name = (SELECT p.name FROM public.quick_table_players p WHERE p.id = v_winner_id)
WHERE qt.id = v_table_id;
```

`champion_name` = snapshot text để mọi bề mặt đọc 0 join; `champion_player_id` = khóa để rebuild lại snapshot nếu sai/đổi tên (không phải cột speculative — nó là đường sửa của cột denormalized). Backfill 22 row bằng đúng luật đó trong cùng migration. Không suy ra được → cả 2 cột NULL → card ẩn dòng, đúng như đã chốt.

Wins: một nguồn duy nhất; card list **0 query phụ** (hôm nay hook đã tốn 2 query rồi — list + `public_profiles`); SSR không thêm round-trip nào vào ngân sách 8s (`_middleware.ts` RENDER_BUDGET_MS); native chỉ thêm tên cột vào chuỗi select; luật champion sống ở 1 chỗ thay vì 4.
Loses: sửa hot path chấm điểm dùng chung web+native — regression ở đây làm hỏng scoring trực tiếp. Giảm thiểu: thay đổi nằm gọn trong `IF` đã chạy sẵn, và pgTAP `supabase/tests/atomic_tournament_mutations.test.sql` (51 assertion) là lưới an toàn. Snapshot không tự cập nhật khi organizer đổi tên VĐV sau khi giải xong.
Forecloses: chốt champion = "người thắng trận chung kết playoff". Nếu sau này muốn champion cho round-robin thuần không playoff (top bảng tổng), phải thêm luật thứ hai — cột vẫn dùng lại được, nhưng RPC phải phân nhánh.

## Option B — Suy diễn runtime, không migration (the cheap one)

Effort: **4.5 nửa ngày** · Data: **none**

Files: như trên trừ migration, cộng `src/lib/quickTableChampion.ts` (mới, luật dùng chung web) + bản sao luật trong `functions/_lib/render/tournaments.ts` + bản sao Swift trong `ToolsRepository.swift`.

**Cách chạy:** card list thêm 1 query batched theo đúng pattern đã có (`useTournamentData.ts:231-234` dùng `.in()`): lấy `quick_table_matches` where `table_id in (...)` and `is_playoff`, rồi client suy final = vòng lớn nhất có đúng 1 trận (đúng luật `PlayoffBracket.tsx:83-85`). SSR và native lặp lại y hệt.

Wins: không migration, không đụng RPC scoring, rollback = revert 1 PR.
Loses: **luật champion bị nhân thành 3 bản** (TS web / TS Cloudflare / Swift) — repo này đã trả giá cho mô hình đó và phải đẻ ra `src/lib/quickTableResult.ts` + `src/lib/flexStats.ts` để dập, kèm hẳn comment "Rule changes happen here and in the Swift twin, never in components". Đây là đi ngược hướng đã chọn. SSR tốn thêm 1 round-trip Supabase Tokyo trong ngân sách 8s. Card list tốn thêm 1 query kéo cả trăm dòng match chỉ để lấy 1 cái tên.
Forecloses: gần như không foreclose gì — nhưng mỗi bề mặt mới sau này lại phải cài lại luật lần thứ 4.

## Option C — 30%: chỉ migration + card list web, dừng lại nhìn

Effort: **2.5 nửa ngày** · Data: như A

Files: migration + `useTournamentData.ts` + `Tournaments.tsx` + i18n. **Chưa** đụng multi-event card, SSR, native.

Wins: rẻ nhất, đo được ngay có ai bấm vào card completed nhiều hơn không. Vì backfill đã chạy, dữ liệu sẵn sàng cho các bề mặt sau mà không phải migrate lần hai.
Loses: lệch parity native (vi phạm memory rule `fix-both-web-and-native` cho tới khi làm nốt); share link chưa có champion — mà share chính là lúc người ta khoe nhà vô địch, có thể đây mới là bề mặt giá trị nhất.
Forecloses: không foreclose gì — C là tập con đúng của A.

---

## Khuyến nghị

**Làm Option A, nhưng scope lại còn `quick_tables` có playoff — bỏ `doubles_elimination` và `flex_tournaments` khỏi v1.** Triển khai theo increment của C trước rồi mở rộng.

Vì sao các phương án kia thua:

- **B thua vì cái giá không nằm ở effort** — 4.5 nửa ngày ngang A — mà ở chỗ nó nhân luật champion thành 3 bản trên 3 ngôn ngữ. Repo đã có tiền lệ đau về đúng chuyện này (`quickTableResult.ts`, `flexStats.ts` sinh ra để gom luật về một mối, có Swift twin + mirror test). Với một người bảo trì, thêm 3 bản sao của một luật là nợ vĩnh viễn, còn A thì luật nằm đúng chỗ nó đã tồn tại.
- **C thua A chỉ về đích đến, không về đường đi** — nên em lấy C làm increment 1 của A, không làm nó thành lựa chọn riêng.
- **Bỏ doubles-elim/flex** vì `doubles_elimination_tournaments` chưa từng có row completed nào (0/5) và `flex_matches` không có cột nào biểu diễn chung kết. Viết code cho doubles-elim là viết cho danh sách rỗng; viết cho flex là bịa ra một định nghĩa champion mà schema không có. Khi nào doubles-elim có giải completed thật, luật của nó đã sẵn và sạch — `matches.find(m => m.round_type === 'final')?.winner_id` (`DoublesEliminationBracket.tsx:278-279`, `RoundType` chỉ có đúng một `'final'`, không có bracket reset) — thêm sau tốn ~1 nửa ngày.

Hai điều cần Cuong quyết trước khi code:

1. **~6/22 champion là rác** ("5", "6", "7", "test4", "VDV 3"). In "Vô địch: test4" lên card công khai là hạ chất lượng trang. Đề xuất rẻ: chỉ hiện khi `name` dài ≥ 2 ký tự và không phải toàn chữ số — bỏ qua ~5 row, không cần bảng moderation.
2. **Yêu cầu "Cường & Nam" không build được từ dữ liệu có cấu trúc** (`player2_name` chỉ có 3/22). Đề xuất: in `quick_table_players.name` nguyên văn — tổ chức vốn đã tự gõ dạng cặp. Không parse tách dấu `&`/`+`/`-`/`,`; parse free-text tiếng Việt để rồi ghép lại y như cũ là công vô ích.

Ngân sách bundle: **0 KB dependency mới**, thêm ~1-2 KB TS chưa gz vào chunk đã có. Không cần lazy-load, không đụng ngưỡng `docs/perf-budgets.md`.
Risk tier: **không RED** — không auth, không payment, không `supabase/config.toml`. Nhưng patch `score_quick_table_match_atomic` là hot path chấm điểm chung của cả 2 nền tảng; nên chạy pgTAP trước khi áp prod.

## Increments

1. **Migration + backfill** — `<ts>_quick_table_champion.sql`: 2 cột, patch RPC, backfill. Verify: query prod trả đúng **22** row có `champion_name`, và 0 row `completed` nào bị set sai; `supabase/tests/atomic_tournament_mutations.test.sql` xanh với case mới "chấm xong chung kết → champion_name được ghi".
2. **Card list web + i18n** — `useTournamentData.ts` select thêm cột, `CommunityBracket` thêm field, `renderMeta` của `quick-tables` thêm dòng. Verify: `/tournaments?tab=community&fmt=quick-tables` lọc completed, đếm số card có dòng vô địch = 22 trừ số bị lọc rác; card không suy ra được vẫn nguyên như cũ. **← điểm dừng-và-nhìn tự nhiên.**
3. **Multi-event card** — `useFeaturedParentTournaments.ts` + `ParentTournamentCard.tsx`. Chỉ **4/22** champion nằm trong parent tournament, nên đây là increment giá trị thấp nhất; hoãn được nếu tuần đó bận.
4. **SSR share preview** — `renderQuickTable` thêm champion vào description, bump `pr:v32`→`v33`, ghi `docs/prerender-cache-log.md`. Verify: `curl -A "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" "https://www.thepicklehub.net/tools/quick-tables/<shareId>?nocache=1"` thấy tên nhà vô địch trong `og:description`. Lưu ý TTL 6h (`_middleware.ts:497-512`) → link share lúc giải đang chạy có thể giữ mô tả cũ tới 6 tiếng.
5. **Native parity** — `ToolsRepository.swift:215` thêm cột + card view. Verify: build sim iPhone 17 Pro, mở tab completed, đối chiếu đúng 1 giải với web.

Không tạo route công khai mới, không thêm sitemap entry, không đổi hreflang. Text mới có VI + EN ngay từ increment 2 (`src/i18n/vi.ts` phải sửa cả interface lẫn string; key `champion` đã có ở `en.ts:971,1522` và `vi.ts:3956,4507` nhưng thuộc namespace `quickTable.playoff`/`teamMatch` — card cần key riêng, đừng tái dùng nhầm).

## Điều em không chắc

- **Không đo được ai đang xem card completed.** Toàn bộ lập luận giá trị dựa trên "22 giải có champion", chứ không dựa trên traffic thật vào tab Community + filter completed. Nếu tab đó gần như không ai mở, câu trả lời đúng có thể là chỉ làm increment 4 (share preview) và bỏ hẳn card list. Em chưa tra GA4/Ahrefs cho `/tournaments`.
- **Chưa xác minh 22 giải đó có phải giải "thật" không.** Em lọc được rác theo tên đội vô địch, nhưng không kiểm tra giải nào là bảng nháp của chính Cuong. Con số hiển thị thực tế có thể thấp hơn 22 đáng kể.
- **`doubles_elimination_teams.final_placement` là cột chết** — có trong schema từ `20260122020801`, được đọc đúng 1 chỗ (`20260722110000_referee_pins.sql:108`, guard `final_placement = 1`), nhưng **không có chỗ nào ghi** trong `src/`, `apple/`, hay migration nào. Nghĩa là nhánh guard đó của `referee_pin_parent_completed` luôn false. Đây là defect riêng, nhỏ, không chặn đề xuất này — nhưng nếu sau này làm champion cho doubles-elim thì nên dùng lại cột đó thay vì thêm cột mới.
- **Chưa xác minh 4 function `og-*` có bị gọi từ ngoài repo không.** Em chỉ chứng minh được không file nào trong repo trỏ tới, và nút share dựng URL trang thường. Nếu Cuong từng dán thẳng URL edge function vào đâu đó (cấu hình Zalo OA chẳng hạn) thì kết luận "code chết" sai. Rẻ nhất để chắc: xem log invocation của `og-quick-table` 7 ngày qua trước khi dựa vào kết luận này.
- **Không rõ vì sao 4 giải `large_playoff` completed lại có 0 trận.** Có thể là vỏ tạo hụt, có thể là bug tạo bracket. Không ảnh hưởng đề xuất (chúng vốn không hiện champion), nhưng đáng ngó nếu Cuong nghĩ format đó đang được dùng.
