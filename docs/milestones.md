# Mốc hẹn ngày (dated milestones)

Nguồn sự thật cho mọi việc "đến ngày X mới làm". Mỗi phiên autonomous chạy
`node scripts/due-milestones.mjs` ở đầu phiên (CLAUDE.md §Critical Workflow Notes);
workflow `milestone-due.yml` ping Telegram mỗi ngày khi còn mốc due chưa tick.

**Luật (từ proposal auto-milestone-run-2026-07, pre-mortem):** mỗi mốc mang **cả
PREDICATE lẫn ngày**. Đến ngày mà predicate chưa thoả → KHÔNG hành động, ghi lý do
defer vào dòng mốc và giữ nguyên `[ ]`. Mốc chỉ nhớ ngày mà quên điều kiện sẽ kích
hoạt quyết định trên dữ liệu chưa tồn tại. Xong việc → tick `[x]` cùng commit với
bằng chứng (PR/report).

Format (script parse bằng regex, giữ đúng): `- [ ] YYYY-MM-DD ID — mô tả`

- [ ] 2026-07-24 PERF-05 — đọc p75 VN trước/sau perf (#389 + PERF-04). PREDICATE: ≥7 ngày RUM sau deploy #417 (29cbe75e, 2026-07-20 → sớm nhất 27/07 mới đủ 7 ngày data PERF-04; #389 đã đủ). Report bắt buộc kèm: n mẫu, cửa sổ before/after cân, filter VN+mobile, verdict ∈ {GIỮ, ROLLBACK, CHƯA ĐỦ MẪU}. Nguồn: GA4 web_vital (dimensions đã đăng ký 21/07) + Ahrefs VN.
- [ ] 2026-08-23 SEO-CLUSTER-READ — đọc lại GSC 2 query tiền: "pickleball bracket generator" và "pickleball round robin generator", breakdown theo TRANG. PREDICATE: ≥4 tuần sau deploy 2026-07-26 (#462/#466/#465 cụm + #467/#468 body/meta) — sớm hơn thì Google chưa tiêu hoá hết 301 + nội dung mới, KHÔNG kết luận. Baseline 26/07 (90 ngày): "bracket generator" chia cho 6 URL, /tools 20 click / 503 impression / pos 11.3; guide EN pos 51-60 với 0 impression informational. Verdict ∈ {THẮNG = số URL còn 1-2 VÀ /tools ≤ pos 5; CHƯA ĐỦ = hẹn đọc lại +4 tuần, không sửa gì; THUA = điều tra 301 chain / body EN có được index chưa (site:… + URL Inspection)}. Nguồn: GSC (Ahrefs MCP vô dụng, plan không đủ).
- [ ] 2026-08-01 THELINE-HARD — scripts/check-theline.mjs Rule 4 advisory→hard. PREDICATE: (1) dry-run HARD sạch trên changed-files của ≥5 PR merged gần nhất VÀ mọi PR đang mở; (2) đã sửa lỗi rename→before=0 (dùng git diff --find-renames lấy path cũ) TRƯỚC khi flip. Flip = PR 1 dòng riêng. Không thoả (1) → sửa false-positive trước, KHÔNG flip theo lịch.
- [ ] 2026-08-02 UX-07-FUNNEL — đọc funnel organizer_tournament 14 ngày → quyết guest-path vs close (D5 proposal ux-06-07). PREDICATE: GA4 custom dimensions đã đăng ký (✅ 21/07) + đủ n theo ngưỡng pre-commit: BUILD nếu ≥100 unique user gặp login wall/14 ngày VÀ ≥30% bỏ cuộc wall→login VÀ ước tính ≥10 registration thêm; CLOSE nếu đủ mẫu nhưng dưới ngưỡng; CHƯA ĐỦ MẪU → BLOCKED, hẹn đọc lại +14 ngày, KHÔNG giả vờ quyết.
- [ ] 2026-08-04 BADGE-TELEMETRY — đọc reg_count_badge_impression (D3 nợ #429). PREDICATE: impression-only CHỈ trả lời "badge có hiện không" (eligible/with_data/shown); KHÔNG kết luận keep/kill từ impression — verdict hợp lệ gồm CHƯA THỂ KẾT LUẬN. Muốn keep/kill thật: cần badge_click hoặc holdout (đề xuất riêng nếu đáng).
