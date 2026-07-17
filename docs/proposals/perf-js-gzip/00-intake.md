# Intake — perf-js-gzip

Ý tưởng: **tối ưu ngay JS gzip. Điều tra nguyên nhân, đưa ra báo cáo cải tiến** (2026-07-17)

## Trả lời của Cuong

1. **Mục tiêu:** CẢ HAI — (a) tải trang đầu nhanh hơn (entry + `/`, `/vi`), (b) tổng JS gzip aggregate về dưới advisory budget 1.800 KB (hiện 1.929,7 KB / gate 1.970 KB).
2. **Đánh đổi UX:** chấp nhận lazy sâu hơn nếu loading thoáng qua **<500ms**, có skeleton.
3. **Phạm vi:** điều tra + báo cáo trước, xếp hạng việc theo KB/effort. Cuong duyệt rồi mới /ship từng việc.

## Baseline đã biết (handoff 2026-07-17, roadmap-8.5-9.md)

- Tổng: **1.929,7 KB gz** (`ANALYZE=1 npm run build` + `scripts/check-bundle-size.mjs`)
- Top contributors: vendor-video 304,3 · vendor-charts 110,5 · entry 104,7 · vendor-ui 83,5 · vendor-supabase 55,2 · QuickTableView 38,2 · locale-vi 34,5 · locale-en 32,2 · TeamMatchView 30,6 · SocialEventDetail 24,3
- PERF-02 lưu ý: vendor-video/charts ĐÃ lazy — đo lại trước khi tốn công; target thật là TeamMatchView + entry
- Bundle guard 1.970 KB sau 2 lần bump stopgap; ratchet rule ở docs/perf-budgets.md — không bump nữa nếu không có plan giảm đo được
