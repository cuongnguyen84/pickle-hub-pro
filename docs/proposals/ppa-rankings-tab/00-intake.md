# Intake — ppa-rankings-tab

**Ý tưởng gốc (Cuong, 2026-08-06):** Xem trang https://www.thepicklehub.net/vi/rankings — lấy thêm dữ liệu từ https://www.ppatour.com/rankings/ — tạo thêm 1 tab, tab đó sẽ luôn active.

## Trả lời làm rõ (AskUserQuestion)

1. **"Tab luôn active" = PPA là tab mặc định.** Mở `/rankings` và `/vi/rankings` là thấy PPA Tour rankings trước tiên — thay vị trí mặc định của tab Việt Nam hiện tại.
2. **Nguồn data: job scrape mới, tự động định kỳ.** Nguyên văn: "pro-tour-scraper là lấy kết quả, không dùng được cho job này. Phải tạo job mới scrape tự động định kì."
3. **Phạm vi: lấy hết tất cả** các format rankings trên ppatour.com (Men's/Women's × Singles/Doubles/Mixed), càng sâu càng tốt — **phục vụ cả SEO landing**.

## Bối cảnh trang hiện tại (đọc nhanh)

- `src/pages/Rankings.tsx` (~505 dòng): scope tabs = vietnam (mặc định, live từ RPC `dupr_leaderboard_vietnam`) + Open/Junior/5 châu lục (snapshot tĩnh DUPR trong `src/content/dupr-rankings.ts`, chụp 2026-05-02). Scope/format URL-backed (`?scope=`/`?format=`, UX-08).
- SSR bot path: `renderRankings` trong `functions/_lib/render/`.
