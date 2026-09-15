# XL-101 — Kế hoạch đưa livescore ĐỒNG ĐỘI QUỐC GIA (national) lên homepage

Điều tra 03/09/2026 (job XL-103). Code World Cup nằm trên `origin/main`, KHÔNG có trong working tree
`feat/shop-production-phase-1` — làm trên branch `feat/wc-open-tie-ingest` (đã tạo sẵn từ main, 0 commit) bằng worktree riêng.

## Nguyên nhân national không hiện trên homepage (2 tầng)

1. **Dữ liệu:** bảng `wc_open_matches` TRỐNG. Worker `workers/wc-open-scraper/src/index.ts` (`runScrape`, ~dòng 186-211)
   mới chỉ upsert `wc_open_teams` từ trang delegations; phần ingest tie có comment hẹn "added once the source exposes
   tie results (Sep 3)" — nguồn ĐÃ có data từ 3/9 nhưng code chưa viết.
2. **UI:** `src/components/live/WorldCupLiveCard.tsx:109-120` (mount ở `src/pages/Index.tsx:526`) chỉ gọi
   `useWcProLive()` — không đọc `wc_open_matches`. Tab đội tuyển chỉ có ở `/live` (`WorldCupLiveBoard.tsx` →
   `WorldCupOpenPanel.tsx`, đang chế độ drawOnly vì matches rỗng).

## Nguồn data — ĐÃ VERIFY lấy được

- Chính trang `https://www.sporttora.com/pwc2026/delegations` (worker fetch sẵn mỗi phút) server-render toàn bộ tie
  trong chunk RSC flight `self.__next_f.push([1,"…"])` — decode bằng `decodeFlight()` sẵn có trong `src/lib/wc-open/parse.ts`.
  KHÔNG có JSON API riêng (header `RSC: 1` trả thiếu data).
- Row TIE (id không chứa `__sub-`): `{id, categoryId:"open_team_coed", groupId, roundName, entryA/entryB{teamName, delegationId, entryId}, scores[{game,scoreA,scoreB,discipline,label}], courtLabel, scheduledAt, status}` —
  ⚠️ `status` row tie KHÔNG đáng tin (vẫn "scheduled" khi đang đấu).
- Row SUB-MATCH (id `…__sub-MD` v.v.): `tieId`, `discipline`, `status` thật (`in_progress`/`completed`), `winnerId`,
  `liveScore.currentGame{scoreA,scoreB,servingTeam}`, lineup VĐV.
- 5 hạng mục đồng đội: `open_team_coed` (~800 row), `masters/seniors/juniors/kids_team_coed`.
- `delegationId` (vd `viet_nam`) khớp đúng slug trong `wc_open_teams` — FK không vướng.
- VN bảng A 3/9: Chile 08:00, Cayman Islands 10:00, Colombia 12:00 (Sân 1 · CC).

## Fix nhỏ nhất (3 bước)

1. `src/lib/wc-open/parse.ts`: thêm `parseWcOpenTies(html)` — tái dùng `decodeFlight` + `matchBalanced`;
   lọc `categoryId === "open_team_coed"` && `!id.includes("__sub-")`; map → row `wc_open_matches`
   (`match_id=id`, `group_letter=groupId`, `round=roundName`, `home/away_slug=entryA/B.delegationId`,
   `home/away_score` = số môn thắng đếm theo `winnerId` các sub row cùng `tieId`;
   `status`: có sub `in_progress` → `live`, đủ môn quyết định → `final`, còn lại `scheduled`).
2. `workers/wc-open-scraper/src/index.ts`: trong `runScrape` upsert ties vào `wc_open_matches`
   (diff-before-write như teams). 0 request mới. Deploy worker = vùng VÀNG (chờ Cuong duyệt trước khi `wrangler deploy`).
3. `src/components/live/WorldCupLiveCard.tsx`: gọi thêm `useWcOpenLive()`, chèn block "Đồng đội quốc gia"
   khi có tie live/final hôm nay, ưu tiên trận Việt Nam. Realtime đã bật sẵn trên `wc_open_matches`.

iOS (`apple/.../WorldCupLiveRepository.swift:260-276`) đã đọc `wc_open_matches` sẵn → tự hưởng lợi phần data.
Nhớ: workers có CI vitest + trần 50 subrequest/run; CẤM deploy worker từ nhánh cũ.
