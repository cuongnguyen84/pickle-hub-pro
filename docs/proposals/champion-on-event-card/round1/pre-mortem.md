# Pre-mortem: `champion-on-event-card`

Ba sự cố dưới đây **đã xảy ra**. Feature lên prod ngày 2026-08-05, panel duyệt AMBER, CI xanh, soak 30 phút sạch. Ba tuần sau chúng ta ngồi viết lại chuyện gì đã xảy ra.

---

## Sự cố 1 — "Giải Chung Cư Vinhomes Q9 hiện hai nhà vô địch khác nhau trên hai màn hình, và đổi người mỗi lần F5"

**Xác suất:** cao · **Thời gian tới lúc phát hiện:** 19 ngày (và chỉ vì có người cãi nhau trên Zalo)

### Timeline

- **T+0 (05/08, 14:20):** Deploy. 86 quick table `completed`, phần lớn round robin. Card bắt đầu hiện dòng "Vô địch: …".
- **T+0 → T+11 ngày:** Không có gì. Cuong mở `/tournaments`, thấy tên người, đúng với vài giải anh nhớ. Đóng tab.
- **T+11 ngày:** BTC giải "Chung Cư Vinhomes Q9" (round robin 6 người, 1 bảng) sửa lại tỉ số 1 trận vòng bảng nhập nhầm 11-9 → 9-11. RPC `score_quick_table_match_atomic` chạy sạch, `success: true`.
- **T+11 ngày +2 phút:** Card trên `/tournaments` đổi tên vô địch từ **Hùng** sang **Tuấn**. Trang chi tiết `/tools/quick-tables/<share_id>` vẫn hiện **Hùng**. Không có lỗi nào, không có toast, không có gì đỏ.
- **T+11 → T+19 ngày:** Card thỉnh thoảng lật lại về Hùng khi có ai đó sửa bất kỳ trận nào khác trong cùng bảng. Không ai để ý — mỗi lần chỉ có 1-2 người mở đúng trang đó.
- **T+19 ngày (24/08, 21:40):** Tuấn chụp màn hình card khoe trong nhóm Zalo CLB. Hùng chụp màn hình trang chi tiết cãi lại. 40 tin nhắn. Một người tag Cuong.
- **T+19 ngày +3h:** Cuong reproduce được. Mất thêm 2 tiếng mới hiểu vì sao.

### Cơ chế

`src/hooks/useQuickTable.ts:285-288` — comparator xếp hạng round robin **chỉ có 2 khóa**:

```
if (b.matches_won !== a.matches_won) return b.matches_won - a.matches_won;
return b.point_diff - a.point_diff;
```

`point_diff` là cột `GENERATED ALWAYS AS (points_for - points_against) STORED` (`supabase/migrations/20251223034604_...sql:65`). Round robin 6 người, mỗi người 5 trận: **hòa cả `matches_won` lẫn `point_diff` là chuyện thường xuyên**, không phải edge case — 2 người cùng 3 thắng 2 thua, cùng +7.

Comparator này **không phải total order**. `Array.prototype.sort` trong ES2019+ là **stable** → khi hai khóa bằng nhau, thứ tự kết quả = **thứ tự mảng đầu vào**. Và đây là chỗ hai bề mặt tách nhau:

- **Trang chi tiết:** `src/hooks/useQuickTable.ts:255` fetch players với `.order('display_order')` → tie vỡ theo thứ tự BTC nhập tên. Ổn định vĩnh viễn.
- **Card danh sách:** feature mới phải lấy players cho 100 giải cùng lúc, nên copy pattern batch có sẵn ở `src/lib/registrationCounts.ts:20-31` — `.in("table_id", ids)` **không có `.order()`**. PostgREST không ORDER BY → Postgres trả theo **thứ tự vật lý trong heap**.

Mắt xích cuối: `UPDATE public.quick_table_players SET matches_played = 0, ...` trong `supabase/migrations/20260722030000_atomic_bracket_score_correction.sql:191-196` — mỗi lần sửa tỉ số vòng bảng, RPC **reset và rebuild toàn bộ player trong group**. MVCC: mỗi UPDATE ghi tuple mới, tuple mới rơi xuống cuối heap. **Thứ tự vật lý của bảng players thay đổi sau mỗi lần sửa điểm.**

→ Sửa 1 tỉ số bất kỳ ⇒ heap order đổi ⇒ tie-break trên card đổi ⇒ nhà vô địch trên card đổi. Trang chi tiết không đổi. Cả hai đều "chạy đúng code".

Không exception, không 4xx/5xx, không log. `errorReporter` không có gì để bắt. SLO #4 ("scoring persists, zero lost-update") **xanh** — chẳng có update nào mất cả, dữ liệu hoàn toàn đúng, chỉ là hai cách đọc nó.

### Vì sao mọi gate vẫn xanh

1. **Unit test:** test duy nhất chạm tới vùng này là `src/lib/__tests__/quickTableResult.test.ts` — nó test `accumulateGroupStats` và `quickTableWinner` (hàm thuần, deterministic). Comparator xếp hạng **không nằm trong `quickTableResult.ts`**, nó nằm inline trong `useQuickTable.ts`. Nếu có test mới cho champion, nó cũng sẽ là test hàm thuần với mảng cứng → mảng cứng luôn có cùng thứ tự → tie-break luôn cho cùng đáp án → **xanh vĩnh viễn**. Test không thể thấy được điều nó không kiểm soát: thứ tự Postgres trả về.
2. **`src/hooks/__tests__/useFeaturedParentTournaments.test.ts`** mock `supabase` thành `{}` và chỉ test `toFeaturedParentTournament` — mapper thuần. Đây là tiền lệ: **mọi test hook trong repo này mock đứt tầng dữ liệu**, nên không có test nào từng quan sát thứ tự row thật.
3. **Visual regression:** `/tournaments` CÓ trong `tests/visual.spec.ts:40` và có baseline `tournaments-visual-linux.png`. Nhưng (a) `visual.yml` là `continue-on-error` — advisory, không chặn (`docs/ops-runbook.md` §7.2); (b) pixel-diff **chỉ nói "khác baseline"**, nó không biết Hùng hay Tuấn mới đúng; (c) baseline phải refresh ngay khi feature ship, và refresh xong thì tên sai được **đóng băng thành chuẩn**.
4. **Soak 30 phút:** trong 30 phút không có BTC nào sửa tỉ số. Trigger của bug là hành vi người dùng cách deploy 11 ngày.
5. **Panel duyệt:** đọc code, thấy comparator giống hệt code đang chạy trên trang chi tiết → "tái sử dụng logic có sẵn, tốt". Đúng — logic giống nhau, **đầu vào khác nhau** mới là bug, và đầu vào nằm ở file khác.

### Ai báo, sau bao lâu

Người dùng, 19 ngày, qua Zalo, dưới dạng cãi nhau chứ không phải bug report. Không có kênh nào khác có thể phát hiện: không alert, không log, không metric.

### Vì sao khó sửa

`git revert` gỡ được feature. **Không gỡ được screenshot.** 40 tin nhắn Zalo trong CLB đã tồn tại. Sự cố này không hỏng dữ liệu — nó hỏng thứ đắt hơn: sản phẩm vừa công khai trao cúp cho sai người, hai lần, cho hai người khác nhau. Fix code là 10 phút (thêm khóa thứ 3 vào comparator + `.order()` ở cả hai đường fetch). Fix niềm tin thì không có PR nào làm được.

Và có một câu hỏi không ai trả lời được: **trong 86 giải completed, bao nhiêu giải đang hiện sai?** Không có cách nào biết ngoài chạy tay từng cái.

### Dấu hiệu sớm lẽ ra phải có

Comment ở đầu `src/lib/quickTableResult.ts:11-13` đã ghi bằng chữ: *"Known platform divergence, pinned by tests on each side: on a tied score web records the match completed with a null winner; Swift refuses to save a tie at all."* — repo này **đã biết** rằng hòa là vùng nguy hiểm và hai nền tảng xử lý khác nhau, và đã dựng test hai phía cho nó. Không ai nối được từ "hòa 1 trận" sang "hòa cả bảng xếp hạng".

**Đáng lẽ đã tránh được nếu:** comparator xếp hạng bị bắt buộc là total order (thêm khóa cuối `id` hoặc `display_order`) — một dòng — và có 1 test khẳng định `rank(players) === rank(shuffle(players))`.

---

## Sự cố 2 — "/tournaments trên 4G Việt Nam mất 9 giây để hiện gì đó, và 30 giải cũ nhất mất luôn tên vô địch — không có deploy nào trong ngày hôm đó"

**Xác suất:** cao · **Thời gian tới lúc phát hiện:** 26 ngày (và phát hiện nhầm nguyên nhân trước)

### Timeline

- **T+0 (05/08):** Deploy. 86 quick table completed, ~14 doubles-elim, ~9 flex. Tổng row phải kéo về để suy champion: ~1,100 players + ~900 matches. LCP p75 Vietnam mobile: 2.1s → 2.9s. Vượt SLO #6 (≤2.5s).
- **T+0 → T+18 ngày:** Không ai đọc RUM. `docs/slo.md` §"Known gaps": *"No dashboard: numbers are pulled ad hoc from GA4 + SQL"*. Không có alert nào cho SLO #6.
- **T+18 ngày (23/08):** Mùa giải hè, thêm 22 quick table completed. Tổng players vượt **1000 rows**. PostgREST cắt im lặng ở `db-max-rows`.
- **T+18 ngày +0 phút:** 30 giải ở cuối danh sách (sắp theo `updated_at` desc → cũ nhất) mất tên vô địch. Card hiện `TBD` hoặc ẩn dòng, tùy nhánh fallback. **Không có deploy nào ngày 23/08.** Response HTTP 200, `error` = null.
- **T+24 ngày:** LCP p75 Vietnam = 4.4s. INP p75 = 380ms (SLO ≤200ms).
- **T+26 ngày (31/08):** Cuong tình cờ mở `/tournaments` trên iPhone bằng 4G ở quán cà phê. Trang trắng 6 giây rồi giật. Anh nghi service worker (đã từng, `#448`), mất 4 tiếng đi sai đường trước khi mở Network tab.

### Cơ chế

Bốn thứ vô hại gặp nhau:

**(1) Hook fetch vô điều kiện.** `src/pages/Tournaments.tsx:200-211` — cả 8 hook community (`useCompletedPublicQuickTables({limit:100})`, `useCompletedDoublesElimination({limit:100})`, `useCompletedFlexTournaments({limit:100})`, `useCompletedTeamMatchTournaments({limit:100})` …) được gọi ở top level, **không có `enabled`**. Tab mặc định là `featured` (`Tournaments.tsx`: `const tab: Tab = userTab ?? "featured"`). Nghĩa là: **mọi lượt vào `/tournaments` đều tải toàn bộ dữ liệu champion của 4 format × 100 giải, kể cả khi người dùng không bao giờ bấm sang tab Community.** Hôm nay điều này rẻ vì mỗi row chỉ ~200 byte metadata. Sau feature, mỗi giải kéo theo players + matches.

**(2) Pattern batch được copy từ chỗ nó an toàn sang chỗ nó không an toàn.** `src/lib/registrationCounts.ts:16-33` là helper duy nhất trong repo làm "một query gộp cho cả list", và comment ở dòng 12-14 tự hào ghi *"One batched count query per registration table, NOT a per-card fan-out"*. Nó **không có `.range()`**, không phân trang. Nó an toàn vì consumer duy nhất là `useOpenRegistrationTables({limit: 20})` — 20 giải × ~16 người = 320 row, dưới cap. Người implement champion đọc file này, thấy đúng pattern cần, copy nguyên xi — sang list **limit 100**. 5× row. Vượt cap ở đâu đó giữa 60 và 90 giải.

**(3) PostgREST cắt im lặng.** Vượt `db-max-rows` không phải lỗi. Không có `Content-Range` nào được kiểm tra ở client. `error` là null, `data` là mảng ngắn hơn. Repo **không có một chỗ nào** kiểm tra truncation — grep `.range(` trong `src/lib` và `src/hooks` ra 0 kết quả.

**(4) Fallback nuốt luôn triệu chứng.** Intake đã chốt: *"Không suy ra được champion → ẨN dòng vô địch, card giữ nguyên như hiện tại"*. Đây là quyết định **đúng về sản phẩm** và **thảm họa về vận hành**: nó biến "dữ liệu bị cắt" thành "giải này không có vô địch" — trạng thái hợp lệ, đã được thiết kế, không đáng báo động. Nếu implement bằng `formatPlayerName(undefined)` (`src/components/tournament/PlayoffBracket.tsx:52`) thì còn tệ hơn: hàm này trả `'TBD'` → card hiện **"Vô địch: TBD"** cho 30 giải đã kết thúc từ lâu.

### Vì sao mọi gate vẫn xanh

- **Bundle budget (`docs/ops-runbook.md` §7.1)** đo **JS gzip**: INITIAL ≤280KB, CODE ≤1800KB, CONTENT per-chunk. Feature này thêm ~2KB JS và **~600KB network payload**. Gate đo đúng thứ nó được thiết kế để đo, và thứ đó không liên quan. Đây là gap thật: repo có budget cho bytes-of-code, **không có budget nào cho bytes-of-data**.
- **CI/preview:** preview deploy trỏ về **cùng Supabase prod**, nên về lý thuyết có thể thấy. Nhưng CI chạy trên runner Linux ở datacenter — 1,100 row về trong 300ms. Vấn đề chỉ tồn tại trên 4G Việt Nam tới Supabase Tokyo.
- **Playwright smoke:** `waitUntil: "load"` + assert có element. 9 giây vẫn dưới timeout mặc định 30s. **Smoke không có ngân sách thời gian.**
- **Visual regression:** ảnh chụp `/tournaments` ở **tab featured** — tab mặc định. Tab Community (nơi champion hiện) không nằm trong 24 baseline nào. Và pixel-diff không thấy được payload.
- **SLO #6 tồn tại và bị vi phạm từ ngày đầu.** `docs/slo.md:15` ghi rõ LCP ≤2.5s p75 Vietnam mobile, đo bằng `web_vital` RUM. Dữ liệu **có trong DB**. Không ai query nó. `docs/slo.md` §Known gaps tự thú: *"No dashboard"*, *"OPS-04 wires Telegram alerts to budget burn"* — OPS-04 chưa xong. **SLO không có alert = SLO không tồn tại.**
- **Soak 30 phút:** chạy ngày 05/08 với 86 giải. Cap 1000 row bị vượt ngày 23/08. Soak không thể thấy tương lai.

### Ai báo, sau bao lâu

Không ai báo. Cuong tự vấp, 26 ngày, và mất 4 tiếng đầu đi sai hướng vì triệu chứng (trang trắng rồi giật) trùng với sự cố service-worker cũ đã có trong ký ức tổ chức (`#448`, memory `session-2026-07-22e`). **Bug cũ đã fix vẫn tiếp tục gây thiệt hại bằng cách hút nhầm sự chú ý.**

### Vì sao khó sửa

Revert dễ. Nhưng phần đắt nhất là **26 ngày không ai biết trang chậm**, và điều đó không phải lỗi của feature này — feature này chỉ là thứ đầu tiên đủ nặng để lộ ra rằng SLO #6 chưa bao giờ được canh. Sửa đúng nghĩa = làm OPS-04, không phải sửa query.

Điểm khó thứ hai: sau khi sửa cap, không có cách nào biết trong 26 ngày đó bao nhiêu người vào `/tournaments`, thấy trang chậm/thiếu dữ liệu, rồi bỏ đi. GA4 thì bot-polluted (CLAUDE.md), Ahrefs chỉ có từ 04/07. Thiệt hại không đo được.

### Dấu hiệu sớm lẽ ra phải có

Có sẵn và bị bỏ qua: `src/lib/registrationCounts.ts` comment dòng 12-14 tự mô tả là "batched, NOT per-card fan-out" — nhưng **không ghi trần của nó**. Một dòng `// ponytail: an toàn tới ~1000 row; list >60 giải phải phân trang` trong file đó, viết từ hồi #429, đã chặn được sự cố này ở review.

**Đáng lẽ đã tránh được nếu:** hook champion trả `{ data, truncated: boolean }` bằng cách so `rows.length` với cap và log `console.warn` + `errorReporter` khi truncated — 3 dòng, và nó sẽ tự la lên vào đúng ngày 23/08.

---

## Sự cố 3 — "Link Zalo của giải Cúp Mùa Hè khoe sai nhà vô địch vĩnh viễn, và không có nút nào sửa được"

**Xác suất:** trung bình-cao · **Thời gian tới lúc phát hiện:** phát hiện sau 4 ngày, **không sửa được** sau đó

### Timeline

- **T+0 (05/08):** Deploy. `og-quick-table` giờ nhét tên vô địch vào `og:description`; `renderQuickTable` (`functions/_lib/render/tournaments.ts:104-112`) nhét vào `<title>` + description cho bot.
- **T+9 ngày, 22:10:** Chung kết giải "TPP Cúp Mùa Hè Rực Lửa 2026 – Bảng B" kết thúc. Trọng tài nhập tỉ số qua tablet: 11-8 cho đội **Minh & Phúc**.
- **T+9 ngày, 22:11:** BTC dán link `/tools/quick-tables/<share_id>` vào nhóm Zalo 180 người. Zalo bot fetch → `og-quick-table` → `og:description` = "✅ Đã kết thúc • Đôi • 24 VĐV • … • Vô địch: Minh & Phúc". **Zalo cache phía nó.**
- **T+9 ngày, 22:11:** Googlebot/Facebot cũng ghé. `functions/_middleware.ts:462` ghi `pr:v32:/tools/quick-tables/<share_id>` vào KV với TTL **21600s = 6 giờ** (`functions/_middleware.ts:191`).
- **T+9 ngày, 22:24:** Trọng tài phát hiện nhập ngược sân. Sửa lại: 8-11, **Hoàng & Nam** vô địch. RPC chấp nhận (trận chung kết không có downstream nên không bao giờ `DOWNSTREAM_LOCKED`). Web cập nhật tức thì.
- **T+9 ngày → T+9 ngày +6h:** Bot nào ghé trong 6 tiếng đó vẫn nhận HTML cache với tên sai.
- **T+13 ngày:** Một thành viên nhóm forward lại link cũ. Zalo **render lại từ cache của Zalo** — "Vô địch: Minh & Phúc". Hoàng nhắn Cuong.
- **T+13 ngày → mãi mãi:** Cuong không tìm được cách nào bắt Zalo re-scrape.

### Cơ chế

Ba tầng cache độc lập, **không tầng nào biết tầng nào tồn tại**, và không tầng nào có invalidation:

| Tầng | Ở đâu | TTL | Cách xoá |
|---|---|---|---|
| React Query | client | `staleTime: 30_000` (`src/App.tsx:211`) | tự hết hạn — **tầng duy nhất đúng** |
| KV prerender | Cloudflare | 6h (`functions/_middleware.ts:191`) | chỉ `?nocache=1`, **thủ công, từng URL một** |
| Zalo/Facebook scraper | bên thứ ba | **vô hạn** | FB có debugger; **Zalo không có gì** |

Grep `PRERENDER_CACHE.delete` trong toàn bộ `functions/`, `scripts/`, `.github/`: **0 kết quả.** Không tồn tại đường invalidation nào. Cơ chế duy nhất là `?nocache=1` — và `functions/_middleware.ts:463` so `=== "1"`, giá trị khác **im lặng trả bản cache** (CLAUDE.md đã cảnh báo chính xác điều này). Nghĩa là: người vận hành phải (a) biết URL nào cần refresh, (b) nhớ đúng cú pháp, (c) biết rằng cần refresh — cả ba đều đòi hỏi ai đó **biết là có sự cố**.

Mắt xích thứ tư, tinh vi hơn: **`quick_tables.updated_at` không bao giờ được bump khi sửa tỉ số.** `score_quick_table_match_atomic` (`supabase/migrations/20260722030000_atomic_bracket_score_correction.sql`) chỉ `PERFORM 1 FROM public.quick_tables WHERE id = v_table_id FOR UPDATE` — **khoá, không update**. Không có trigger nào trên `quick_tables` cho `updated_at` (grep migrations: chỉ có `update_quick_table_teams_updated_at`). Hệ quả kép:

1. Không có tín hiệu nào ở tầng bảng cha để xây invalidation lên trên. Muốn biết "giải này vừa đổi champion" phải join xuống `quick_table_matches`.
2. `supabase/functions/auto-archive-tournaments/index.ts:22-26` archive theo `quick_tables.updated_at < now() - 14 ngày`. **Một giải phong trào đánh mỗi tối thứ Năm suốt 6 tuần sẽ bị auto-archive thành `completed` vào ngày thứ 14** — vì chấm điểm không chạm bảng cha. Trước feature này, hậu quả là card ghi nhầm "Đã kết thúc", ai cũng bỏ qua. Sau feature này, hậu quả là **hệ thống trao cúp cho người đang dẫn đầu ở tuần thứ 2 của giải 6 tuần**, rồi bake tên đó vào link Zalo.

### Vì sao mọi gate vẫn xanh

Câu trả lời nằm ngay trong file, và nó là bằng chứng không thể chối cãi:

`supabase/functions/og-quick-table/index.ts:76-82`

```ts
const statusMap: Record<string, string> = {
  setup: "🔧 Đang thiết lập",
  "group-stage": "⚡ Vòng bảng",   // ← DB lưu "group_stage", gạch dưới
  playoff: "🏆 Playoff",
  completed: "✅ Đã kết thúc",
};
const statusText = statusMap[table.status] || table.status;
```

Giá trị thật trong DB là `group_stage` (xem `src/pages/Tournaments.tsx:38` — `group_stage: { cls: "active", ... }`). Key ở đây là `group-stage`. **Mọi link preview của giải đang ở vòng bảng, suốt nhiều tháng, đã hiển thị chuỗi trần `group_stage` cho người dùng Zalo** — và không một gate, một test, một người review nào phát hiện.

Đó là chứng minh hình thức cho câu hỏi "vì sao gate xanh": **bề mặt OG chưa bao giờ được assert bởi bất cứ thứ gì.** Không unit test, không e2e, không visual. `tests/visual.spec.ts` chụp 12 route HTML nhưng không có route nào là output của edge function `og-*`. CLAUDE.md có §"Deployment Verification" dạy `curl -A "Googlebot"` — nhưng đó là **checklist tay cho blog post**, không phải gate, và không ai chạy nó cho `/tools/*` (những trang này `noindex`, nên tâm lý là "không quan trọng SEO" — đúng, nhưng chúng quan trọng vì **Zalo**, và không ai viết điều đó ra ở đâu cả).

Thêm: `functions/_middleware.ts:489` đặt `RENDER_BUDGET_MS = 8000`. Query champion thêm 2 round-trip Supabase Tokyo cho mỗi render. Khi vượt 8s, code rơi vào catch → trả SPA shell → **không cache, không lỗi, header `X-Prerender-Cache: MISS`**. Nghĩa là một phần bot thấy champion, một phần không, một cách ngẫu nhiên theo latency — và không có metric nào đếm số lần prerender timeout.

### Ai báo, sau bao lâu

Người bị mất cúp, 4 ngày, qua tin nhắn riêng. Không phải qua bug report — qua *"anh ơi sao link vẫn ghi đội kia vô địch"*.

### Vì sao khó sửa

**Đây là sự cố duy nhất trong ba cái mà `git revert` không giải quyết được gì.** Revert code → link Zalo vẫn giữ nguyên preview cũ, vì preview nằm trong cache của Zalo, không nằm ở ta. FB có Sharing Debugger để ép re-scrape; **Zalo không public công cụ nào**. Với 95% người dùng Việt Nam và Zalo là kênh chia sẻ chính, đây là bề mặt lớn nhất và là bề mặt duy nhất ta không kiểm soát.

Cách duy nhất: đổi URL (thêm query param) → nhưng link cũ đã nằm trong 180 tin nhắn. Hoặc chấp nhận.

Tầng KV thì sửa được — nhưng phải bump `pr:v32` → `pr:v33`, tức **xoá toàn bộ cache prerender của cả site**, và điều đó có nghĩa mọi bot ghé sau đó đều nhận cold render qua Supabase Tokyo, đúng lúc `RENDER_BUDGET_MS` đang căng. Fix một sự cố bằng cách kích hoạt điều kiện của một sự cố khác.

### Dấu hiệu sớm lẽ ra phải có

`group_stage` hiển thị trần trên preview Zalo suốt nhiều tháng **là dấu hiệu sớm**. Nó đã ở đó. Nó nói chính xác điều cần biết: *"nội dung OG không được kiểm chứng bởi bất cứ ai"*. Không ai đọc nó vì không ai từng nhìn vào output OG — mà lý do không ai nhìn chính là điều nó đang tố cáo. Vòng lặp khép kín.

**Đáng lẽ đã tránh được nếu:** một test 15 dòng gọi `og-quick-table` với share_id của 1 giải seed và assert `og:description` chứa đúng status + đúng tên vô địch. Nó sẽ đỏ ngay lần chạy đầu tiên — vì bug `group-stage` đã có sẵn ở đó chờ.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|---|---|---|---|
| **1** | Tie-break không total-order → hai bề mặt hai nhà vô địch, lật theo mỗi lần sửa điểm | **cao** | **rất cao** (19 ngày, chỉ lộ qua cãi nhau; không log/alert/exception nào có thể bắt) | **P0** |
| **3** | Cache 3 tầng lệch + Zalo giữ vĩnh viễn + auto-archive trao cúp giữa giải | trung bình-cao | cao (4 ngày phát hiện, **∞ để sửa**) | **P0** |
| **2** | Row-cap 1000 + fetch vô điều kiện → chậm + mất dữ liệu, không tương quan deploy nào | **cao** | cao (26 ngày, và đi sai hướng 4 tiếng) | **P1** |

**Lý do #1 đứng đầu chứ không phải #3:** #3 hỏng đau hơn và không sửa được, nhưng nó hỏng **một lần, ở một giải, có người báo trong 4 ngày**. #1 hỏng **âm thầm trên toàn bộ 86 giải cùng lúc**, không ai biết cái nào đúng cái nào sai, và sau khi fix vẫn không ai trả lời được "trong 3 tuần qua chúng ta đã trao nhầm cúp bao nhiêu lần". Một sự cố thảm khốc mà 10 giây là biết còn ít tệ hơn một sự cố nhẹ âm thầm sai dữ liệu suốt 3 tuần.

**#2 xuống P1** vì nó là sự cố duy nhất mà chỉ cần ai đó mở Network tab là thấy — nó ồn, chỉ là không ai ở trong phòng.

---

## Rẻ nhất để chặn từ bây giờ

1. **Thêm khóa thứ ba vào comparator + `.order()` ở mọi đường fetch players/matches.** Một dòng ở `src/hooks/useQuickTable.ts:287` (`return b.point_diff - a.point_diff || a.id.localeCompare(b.id)`) + `.order("display_order")` trên query batch mới. Kèm **1 test**: `expect(rank(players)).toEqual(rank([...players].reverse()))`. Chặn trọn sự cố 1.
2. **Guard truncation trong helper batch.** Trong hàm fetch champion: `if (rows.length >= 1000) { console.warn(...); reportError("champion_fetch_truncated", { count: rows.length }); }`. Ba dòng. Nó tự la lên vào đúng ngày dữ liệu vượt ngưỡng, chứ không đợi 26 ngày. Chặn nửa sự cố 2.
3. **Một test `curl` cho OG.** Vitest gọi `og-quick-table?id=<seed_share_id>` với UA `facebookexternalhit`, assert `og:description` khớp regex có tên vô địch + status đúng. Nó **đỏ ngay lần đầu** (bắt luôn bug `group-stage` đang sống). Chặn nửa sự cố 3 — nửa còn lại (Zalo cache vĩnh viễn) **không chặn được bằng code**, chỉ chặn được bằng quyết định sản phẩm: *đừng nhét champion vào OG description cho tới khi có invalidation*, hoặc chấp nhận rằng OG là bản chụp tại thời điểm share và ghi điều đó vào ADR.

Ngoài ra, một dòng không thuộc feature này nhưng feature này biến nó thành nguy hiểm: **`auto-archive-tournaments` phải loại trừ các giải có match được chấm trong 14 ngày qua** (`.lt("updated_at", ...)` trên bảng cha là sai khóa) — nếu không, mọi giải phong trào dài hơn 2 tuần sẽ được hệ thống tự trao cúp giữa chừng.

---

## Khoảng hở của pipeline mà bài này lộ ra

1. **Không có gate nào cho payload mạng.** `docs/ops-runbook.md` §7.1 có ba budget rất tốt cho JS gzip. Không có budget nào cho số byte một trang kéo về từ Supabase. Mọi feature "thêm dữ liệu vào card list" sẽ đi lọt. Đây là gap có tên và sửa được: thêm một assert vào Playwright smoke đo tổng `response.body().length` cho `/tournaments`.

2. **Không có gate nào cho bề mặt OG / prerender content.** Bằng chứng cứng: bug `"group-stage"` vs `group_stage` (`supabase/functions/og-quick-table/index.ts:78`) đã ship và sống nhiều tháng. Với 95% người dùng dùng Zalo, đây là bề mặt marketing chính của sản phẩm và nó **hoàn toàn không được kiểm chứng**. Repo có checklist tay cho blog post nhưng không có gì cho `/tools/*`.

3. **Test hook trong repo này mock đứt tầng dữ liệu.** `src/hooks/__tests__/useFeaturedParentTournaments.test.ts` mock `supabase: {}` và test mapper thuần. Đó là quy ước hợp lý — nhưng hệ quả là **không một test nào trong repo từng quan sát thứ tự row Postgres trả về**, và cả sự cố 1 lẫn sự cố 2 sống chính xác trong cái mù đó. `/idea` nên coi "logic phụ thuộc thứ tự row" là một risk class riêng có tên, vì checklist hiện tại không có ô nào tick nó.

4. **SLO tồn tại nhưng không có alert = SLO không tồn tại.** `docs/slo.md:15` đặt LCP p75 Vietnam ≤2.5s và `web_vital` RUM đã thu thập dữ liệu. `docs/slo.md` §Known gaps thừa nhận không có dashboard, OPS-04 chưa xong. Trong sự cố 2, SLO bị vi phạm **từ ngày deploy** và không ai biết trong 26 ngày. Panel `/idea` sẽ tiếp tục duyệt AMBER cho mọi feature với lý do "có SLO canh" — điều đó **không đúng sự thật** cho tới khi OPS-04 xong, và panel nên bị buộc phải biết điều đó.

5. **Soak 30 phút không đo được gì có ý nghĩa cho feature dạng này.** Cả ba sự cố có trigger cách deploy 9-18 ngày: một lần sửa tỉ số, một ngưỡng row, một lần share link. Soak 30 phút cho feature hiển-thị-dữ-liệu-lịch-sử là **nghi lễ, không phải kiểm chứng** — và nó tạo cảm giác an toàn sai. Với loại feature này, thứ thay thế đúng không phải soak lâu hơn, mà là **một guard tự la lên trong runtime** (điểm 2 ở mục trên).
