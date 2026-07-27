# ui-ux-critic — champion-on-event-card

## Đánh giá tổng thể

Ý tưởng đúng: người đứng ở sân mở link Facebook vào một giải đã kết thúc chỉ muốn biết **ai vô địch**, và hiện tại app không trả lời câu đó ở bất kỳ đâu ngoài một tab bracket phải tự bấm vào. Nhưng bản mô tả scope đang chỉ sai file cho phần OG (`og-*` edge functions **không** phục vụ link người ta thật sự chia sẻ), và trên `.tl-bracket-row` 390px thì champion chỉ có chỗ nếu ta **bỏ bớt** thứ khác chứ không nhét thêm được. Có một defect prod đang sống ngay trên đường đi của feature này: giải `round_robin` đã `completed` mở ra một **tab trống**.

---

## Luồng người dùng

**Entry (thực tế, ~90%):** link Zalo/Facebook → deep-link thẳng `/tools/quick-tables/<share_id>`. Không qua `/tournaments`, không "khám phá IA".

**Task:** đọc tên người vô địch trong ≤ 3 giây, một tay, ngoài nắng.

**Hiện tại:**
- `QuickTableView.tsx:156-157` — mọi bảng `completed` bị ép `activeTab='playoff'`.
- Nếu là `large_playoff`: may mắn — `PlayoffBracket.tsx:115-168` render banner "Vô địch" ngay đầu tab. Journey này **đã xong**, chỉ chưa ai biết.
- Nếu là `round_robin` thuần (`hasPlayoff === false`): nút tab bị `disabled` (dòng 905), thân tab là `{hasPlayoff && ...}` (dòng 1380) → người dùng thấy **một panel rỗng**. Đây là kết cục mặc định của mọi link round-robin đã kết thúc được share.

**Exit:** không có. Card/trang chi tiết không dẫn đi đâu sau khi đọc kết quả.

**Kết luận luồng:** ưu tiên số 1 **không phải** card danh sách. Là trang chi tiết + share preview. Card danh sách là bề mặt ít traffic nhất trong ba bề mặt được yêu cầu.

---

## Vấn đề tìm thấy

| # | Mức độ | Vấn đề | Sửa thế nào |
|---|--------|--------|-------------|
| 1 | **Blocker** | `QuickTableView.tsx:156` ép `activeTab='playoff'` cho mọi `completed`, nhưng round_robin không có playoff → deep-link từ Facebook mở ra panel trống. Đây chính là chỗ champion phải nằm. | Đổi thành `setActiveTab(hasPlayoff ? 'playoff' : 'groups')`. Sửa trước, độc lập với feature. Một dòng. |
| 2 | **Blocker** | Scope ghi "OG image = `og-*` edge functions". Sai file. `functions/_middleware.ts:707` route bot của `/tools/quick-tables/:id` sang `renderQuickTable` (`functions/_lib/render/tournaments.ts:104`). Sửa `og-quick-table/index.ts` → **0 thay đổi** trên unfurl Facebook/Zalo thật. | Sửa `renderQuickTable` / `renderDoublesElim` / `renderFlex` trong `functions/_lib/render/tournaments.ts`. Bump cache key `pr:v32` → `pr:v33` (`_middleware.ts:462`). |
| 3 | **Blocker** | Không có OG image động cho 3 format này — cả 4 `og-*` đều trả `DEFAULT_OG_IMAGE` tĩnh. "Champion trên OG image" như đề bài = viết mới một Satori renderer (tham chiếu `og-image-match`, 330 dòng) cho mỗi format. | Vòng 1 chỉ đổi `og:description`. Ảnh động là vòng 2, và chỉ nếu đo được share CTR. Đồng thuận với GPT-5.6. |
| 4 | **Blocker** | Champion trên card danh sách **phải nằm trong cùng query hiện có**, không được là query thứ hai. `/tournaments` load tới 100 row/format; champion đến sau first paint sẽ đẩy row xuống → phá CLS ≤ 0.1 trên 4G. | Cột denormalized `champion_label text` ghi khi trận CK có kết quả. `useFeaturedParentTournaments.ts:59-65` đã nest `quick_tables(...)` → thêm 1 cột = 0 request thêm. Nếu không làm được cột này thì **cắt champion khỏi card danh sách**, chỉ ship detail + share. |
| 5 | **Blocker** | Không có luật xử lý **hòa**. Round robin 1 bảng xác định "nhất" bằng `matches_won` / `point_diff` — hai người bằng nhau hết chuỗi tiebreak là chuyện thường ở giải 8 người. Hiện chưa có quy tắc nào. | Rank-1 **duy nhất** sau toàn bộ chuỗi tiebreak đang dùng cho standings → hiện. Hòa → ẩn (cùng luật với "không suy ra được champion"). |
| 6 | **Blocker** | Nhãn màu vàng trên nền tint vàng — **light mode fail AA**. `--tl-gold` light `#8a6410` trên tint `rgba(138,100,16,0.12)` phủ `--tl-bg-elev` `#f5f3ee` = **4.16:1**. Đúng lớp lỗi đã ship ở #426 (3.7:1). | Nhãn dùng `var(--tl-fg-3)` (5.04:1 dark / 4.88:1 light — đã tính), tên dùng `var(--tl-fg)`. Đây đúng là cặp token banner champion hiện có đang dùng (`PlayoffBracket.tsx:146,160`). Không phát minh token mới. |
| 7 | **Blocker** | Tên đôi tiếng Việt: "Nguyễn Thị Thanh Hương & Trần Minh Quân" = 39 ký tự. Nếu clamp một dòng thì **người thứ hai biến mất hoàn toàn** — mất mặt người thắng, không phải lỗi thẩm mỹ. | Hai dòng, mỗi người một ngân sách chiều rộng riêng: dòng 1 `player1_name`, dòng 2 `& player2_name`, mỗi dòng `text-overflow: ellipsis` độc lập. Cột đã có sẵn (`quick_table_players.player1_name/player2_name`). Trang chi tiết: **không** truncate, cho wrap. |
| 8 | **Nên sửa** | Pill "ĐÃ KẾT THÚC" lặp lại 100 lần trong tab "Đã kết thúc" — 0 bit thông tin, đang chiếm đúng cột mà champion cần. | Ở `fmtStatus === 'ended'`, bỏ hẳn `.tl-br-status.completed`. Free win, không phụ thuộc feature. |
| 9 | **Nên sửa** | Sub-event row trong featured card: `padding: 6px 8px` + 1 dòng 13.5px ≈ **30px** touch target. Dưới 44px. | Thêm dòng champion tự nó đẩy lên ~48px cho row có champion; row không có champion vẫn 30px → set `minHeight: 44` trên button (`ParentTournamentCard.tsx:258-270`). Đồng thuận GPT-5.6. |
| 10 | **Nên sửa** | `renderQuickTable` đặt `robots: noindex, follow`. Toàn bộ phần meta **không có giá trị SEO nào**. Payoff duy nhất là unfurl mạng xã hội. | Không đổi hành vi — đổi kỳ vọng. Đừng bán feature này là SEO trong proposal, và đừng tốn công tối ưu độ dài title cho Google. |
| 11 | **Nên sửa** | `buildTitle` cắt ở **60 UTF-8 byte** (`functions/_lib/utils.ts:44-56`). Tiếng Việt 2-3 byte/ký tự → cả title chỉ ~20-28 ký tự, tên giải đã ăn hết. | Champion **không** vào `<title>`. Chỉ vào `description`, đặt **đầu chuỗi** để sống sót khi Zalo cắt ngắn. Đồng thuận GPT-5.6. |
| 12 | **Nên sửa** | Trùng icon: Trophy đang là icon *danh tính giải* ở title featured card (`ParentTournamentCard.tsx:161`) và ở hero `/tournaments`. Dùng lại cho *người thắng* là hai nghĩa một ký hiệu. | Trang chi tiết + featured card: lucide `Crown`, `aria-hidden="true"`. Không dùng emoji 🏆 (render lệch trên Android tầm trung + WebView Capacitor). **Card danh sách: không icon nào cả** — xem bất đồng #2. |
| 13 | **Nên sửa** | Meta line hiện phơi raw enum: `renderMeta` trả `t.format ?? "Round robin"` → người Việt đọc thấy `round_robin` (`Tournaments.tsx:106`). | Map: `round_robin` → `Vòng tròn` / `Round robin`; `large_playoff` → `Playoff`. |
| 14 | **Nit** | Hai chuỗi VI cho cùng khái niệm: `quickTable.playoff.champion` = "Nhà vô địch", `teamMatch.champion` = "Vô địch". | Một namespace `result.*` dùng chung. "Vô địch" (ngắn hơn, đúng giọng cộng đồng hơn) là chuỗi thắng. |
| 15 | **Nit** | Featured card status pill nói "Hoàn thành", card list nói "Đã kết thúc" — cùng trạng thái, hai chữ. | Thống nhất "Đã kết thúc". "Hoàn thành" nghe như xong một task chứ không phải xong một giải. Đồng thuận GPT-5.6. |

---

## Layout cụ thể

### `.tl-bracket-row`, 390px (`the-line.css:3775`)

Grid hiện tại mobile: `auto 1fr auto`. Thêm một hàng thứ hai trong `.tl-br-body`, **không** thêm cột.

```
[▌] TPP - Đôi nữ 26/7
    VÔ ĐỊCH  Nguyễn Thị Thanh Hương
             & Trần Minh Quân
    Đôi · 12 VĐV · 3 ngày trước
```

- `.tl-br-result` chèn giữa `.tl-br-name` và `.tl-br-meta`.
- Nhãn: Geist Mono 10px, uppercase, `letter-spacing: .04em`, `var(--tl-fg-3)`.
- Tên: Geist 13.5px/500, `var(--tl-fg)` — **không** serif ở kích thước này (Instrument Serif italic 15px với dấu tiếng Việt ở 390px là mù chữ; serif để dành cho panel chi tiết 24px+).
- Row có champion thì bỏ pill `.completed` (dù sao ở tab "ended" cũng bỏ hết — #8).
- Row **không** có champion: giữ nguyên y hệt hôm nay. Không chừa chỗ trống.

### Featured multi-event card (`ParentTournamentCard.tsx:250-321`)

Champion **per sub-event**, không tổng hợp ở cấp card. Card cha là 4 nội dung thi đấu khác nhau; gộp lại thành "một nhà vô địch" là sai dữ liệu. Đồng thuận GPT-5.6.

```
◆  TPP - Đôi nữ 26/7                    [bỏ pill]
   VÔ ĐỊCH  Nguyễn Thị Thanh Hương
            & Trần Minh Quân
◆  TPP - Đôi nam 26/7                   [bỏ pill]
   VÔ ĐỊCH  Lê Hoàng Nam & Phạm Đức Anh
```

`previewSubEvents` đã cap 3 (`useFeaturedParentTournaments.ts:33`) → card cao thêm tối đa ~60px. Chấp nhận được.

### Trang chi tiết

Panel `event-result` dùng chung, đặt **ngay sau `<header className="tl-page-head">` và TRƯỚC `.tl-tabs`** (`QuickTableView.tsx`, giữa dòng 869 và 877). Full-width, padding 16px, **căn trái** (banner hiện tại căn giữa — căn giữa với tên đôi 2 dòng tiếng Việt tạo hình ziczac khó quét mắt), Crown 20px `var(--tl-fg-3)`, nhãn mono 10.5px `var(--tl-fg-3)`, tên Instrument Serif italic `clamp(24px, 7vw, 32px)` `var(--tl-fg)`, không truncate.

Banner cũ trong `PlayoffBracket.tsx:115-168`: **xoá**, đừng hiện hai lần trên cùng một màn.

---

## Trạng thái màn hình

- **Empty (completed, không suy ra được champion):** không render gì. Không `—`, không "Chưa xác định", không Crown rỗng, không chừa dòng trống. Row giữ pill "Đã kết thúc". Người dùng đọc đúng là "giải này đóng rồi, không ghi nhận kết quả" — trung thực hơn là bịa ra một trạng thái đang-chờ. Đồng thuận GPT-5.6.
- **Loading:** skeleton, không spinner — và chỉ khi champion đến **cùng** query card (xem Blocker #4). Nếu phải query riêng thì không có state loading nào cả, vì feature bị cắt khỏi card danh sách.
- **Error:** không có state riêng. Query champion fail → coi như không có champion → ẩn dòng. Không bao giờ hiện lỗi cho một dòng trang trí.
- **Offline (PWA + Capacitor):** `vite.config.ts` NetworkFirst 3s cho navigation, Supabase REST có runtime cache. Champion là dữ liệu **bất biến** sau khi giải kết thúc → cache dài hạn là đúng. Bản cache cũ hiện champion cũ là chấp nhận được; giải đã xong thì không đổi. Không cần banner "dữ liệu cũ".

---

## Accessibility (WCAG 2.1 AA)

- **Contrast — FAIL nếu dùng vàng.** `--tl-gold` light `#8a6410` trên tint vàng phủ `--tl-bg-elev` = **4.16:1** < 4.5. Với tint hardcode `rgba(233,182,73,0.12)` (giá trị dark, không đổi theo mode) = **4.56:1** — sát mép. Đừng đứng ở đó. Dùng `var(--tl-fg-3)`: **5.04:1** dark, **4.88:1** light. Pass cả hai.
- **Không dùng `--tl-fg-4`** cho chữ nhãn — `#7c7973` là 4.59:1 trên `--tl-bg` nhưng thấp hơn trên `--tl-bg-elev`. Chỉ để cho `◆` và `·`.
- **Không dùng `--tl-green`** cho tên. Light mode `#5e7d1f` ≈ 4.6:1, borderline — comment ngay trong `the-line.css:3805-3808` đã ghi rõ đây là blind spot đã ship một lần.
- **Semantic:** `.tl-bracket-row` là **một `<a>` duy nhất**, screen reader đọc thành một chuỗi phẳng. Nếu nhét champion vào `.tl-br-meta` (chuỗi `·`) sẽ ra "TPP Đôi nữ, Đôi, 12 người chơi, Nguyễn Thị Thanh Hương, 3 ngày trước" — vô nghĩa. Bắt buộc là element riêng, và **nhãn phải có dấu hai chấm trong DOM**: `<span class="tl-br-result-label">Vô địch:</span>`. Đồng thuận GPT-5.6.
- Giữ **tên đầy đủ trong DOM** kể cả khi đã ellipsis về mặt hình ảnh (CSS ellipsis không cắt DOM — đúng luôn, chỉ cần đừng cắt bằng JS `.slice()`).
- Không `aria-live`. Đây là nội dung tĩnh.
- Icon `aria-hidden="true"`. `·` và `◆` cũng vậy.
- **Focus ring:** sub-event button trong featured card dùng `focus-visible:ring-[var(--tl-green)]` (`ParentTournamentCard.tsx:257`) — ring lime trên card viền vàng. Đã sai từ trước, sửa luôn thành `var(--tl-gold)` cho khớp header button ở dòng 150.
- **Touch target:** sub-event button ~30px → `minHeight: 44`.
- Chuỗi nguồn viết **sentence-case**, uppercase bằng CSS. Đây là pattern repo đang dùng và nên giữ.

---

## Copy đề xuất (VI / EN)

```ts
// i18n — namespace mới dùng chung 3 format + native
result: {
  champion:      "Vô địch",              // Champion
  championLabel: "Vô địch:",             // Champion:      ← có dấu hai chấm, cho screen reader
  groupWinner:   "Nhất bảng {group}",    // Group {group} winner
  completed:     "Đã kết thúc",          // Completed      ← thay "Hoàn thành" ở ParentTournamentCard
}
```

**Format meta (thay raw enum):**

```ts
formatLabel: {
  round_robin:   "Vòng tròn",    // Round robin
  large_playoff: "Playoff",      // Playoff
}
```

**OG description — `functions/_lib/render/tournaments.ts:110`, champion đặt ĐẦU chuỗi:**

```
VI  Vô địch: {champion}. {name} – {n} VĐV, {formatVi}. Xem kết quả trên ThePickleHub.
EN  Champion: {champion}. {name} – {n} players, {formatEn}. View results on ThePickleHub.
```

Không champion → giữ nguyên chuỗi hiện tại. `<title>` **không đổi** (hết ngân sách byte).

**Độ dài — kiểm tra thực tế:** "VÔ ĐỊCH" 7 ký tự vs "CHAMPION" 8 → VI **ngắn hơn** EN ở đây, hiếm. Chỗ dài hơn là **tên**, không phải nhãn — và đó là lý do luật 2 dòng ở Blocker #7.

---

## Panel đa model

Second opinion: `gpt-5.6-sol` qua Codex CLI. Nguyên văn prompt + reply: `docs/proposals/champion-on-event-card/external/ui-ux-critic-gpt56.md`.

> Ghi chú quy trình: `scripts/agents/ask-model.mjs` **không tồn tại** trong repo (khớp memory `idea-pipeline-missing-scripts`). Đã thay bằng `codex exec`. `--model gpt-5.6` bị API từ chối với tài khoản ChatGPT; model chạy thật là `gpt-5.6-sol`.

**Đồng thuận Claude + GPT-5.6** (hai vendor độc lập, cùng kết luận — tin được):
1. Champion là **kết quả**, không phải metadata → element riêng, tuyệt đối không nhét vào chuỗi `·` của `.tl-br-meta`. Cả hai đưa ra cùng lý do a11y.
2. Champion **thay thế** pill "đã kết thúc", không cộng thêm.
3. Featured card: champion **per sub-event**, không tổng hợp cấp card cha.
4. Tên đôi: **hai dòng, mỗi người một ngân sách riêng**. Không viết tắt tên Việt.
5. Không champion → **không hiện gì**. Không placeholder.
6. Champion **không vào `<title>`**, vào đầu `description`.
7. OG image động là vòng 2, không phải ngày 1.
8. Trang chi tiết: panel kết quả phải **trên tabs**, xoá banner trong bracket tab.
9. Trophy đã có nghĩa "giải đấu" → dùng Crown cho "người thắng".
10. Sub-event button phải ≥ 44px.
11. "Hoàn thành" → "Đã kết thúc".

**Bất đồng:**

1. **Màu nhãn.** GPT-5.6 đề xuất `--tl-result-label: var(--tl-gold)` và khẳng định gold "≈10.2:1 trên nền tối, light đã verify 5.2:1". **Chọn: `var(--tl-fg-3)`.** Con số 10.13:1 của GPT đúng — nhưng đó là gold trên nền *trần*. Nhãn thật sẽ nằm trên **tint vàng**, và ở light mode composite chỉ còn **4.16:1 — fail AA**. GPT không có token light-mode để tính composite. Đây chính xác là lớp lỗi #426.
2. **Icon trong card danh sách.** GPT-5.6 muốn Crown 13px trong `.tl-bracket-row`. **Chọn: không icon ở list row.** Row 390px đã có thanh accent 8px + tên + meta; thêm icon 13px cạnh chữ mono 10px là nhiễu thị giác, và × 100 row là 100 SVG node cho một trang vốn load 100 record trên 4G. Chữ "VÔ ĐỊCH" tự mang nghĩa. Crown để dành cho panel chi tiết và featured card.
3. **Font tên trong list row.** GPT-5.6 đề xuất Instrument Serif italic 15px/18px. **Chọn: Geist 13.5px/500.** Serif italic có dấu tiếng Việt (ắ, ộ, ữ) ở 15px trên màn Android tầm trung mất nét dấu. Serif là ngôn ngữ display của TheLine — dùng ở panel 24px+, không dùng ở mật độ danh sách.
4. **"Nhất bảng".** GPT-5.6 muốn round robin dùng "Nhất bảng" thay "Vô địch". **Chọn: bỏ hẳn nhánh này.** `quick_tables.group_count === 1` → chỉ có một bảng, gọi "Nhất bảng" gây khó hiểu vì không có bảng nào khác để so; cộng đồng VN nói "vô địch" cho người thắng một giải round-robin đơn bảng. `group_count > 1` không có playoff → **không có nhà vô địch**, ẩn hoàn toàn (đúng luật intake). Kết quả: không cần chuỗi "Nhất bảng" ở card nào cả — bớt một nhánh i18n và một nhánh logic.
5. **Screen reader + uppercase.** GPT-5.6 nói CSS `text-transform: uppercase` khiến screen reader đọc từng chữ cái. Không đúng với NVDA/VoiceOver hiện đại — chúng đọc text trong DOM. **Kết luận thực hành thì giống nhau** (nguồn sentence-case, uppercase bằng CSS), chỉ khác lý do.

**GPT-5.6 không thấy được (repo-only, 4 mục):** defect tab trống của round_robin đã completed; `og-*` là file sai để sửa; `noindex` triệt tiêu mọi giá trị SEO; ràng buộc "champion phải trong cùng query, nếu không thì cắt". Bốn mục này đều xếp Blocker và **không** có trong output của GPT-5.6 — panel này chạy tốt vì hai bên nhìn hai thứ khác nhau, không phải vì đồng thuận.

**Điều nên ship trước nếu chỉ có một ngày:** panel `event-result` ngay dưới header trang chi tiết + fix `activeTab` cho round_robin. GPT-5.6 độc lập chọn đúng cùng thứ này (trừ phần fix tab nó không biết). Đó là bề mặt duy nhất mà người đến từ deep-link Facebook thật sự nhìn thấy.
