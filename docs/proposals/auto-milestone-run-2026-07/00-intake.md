# Intake — auto-milestone-run-2026-07

Ngày: 2026-07-21. Nguồn ý tưởng (nguyên văn Cuong):

> Mốc tự động phiên sau: QA-04 từ #431 · OPS-04 Telegram · PERF-05 ~24/07 · funnel UX-07 ~02/08 · telemetry badge ~04/08 · .tl-btn HARD 01/08.

## Diễn giải

Đây là meta-task: đảm bảo 6 mốc roadmap đã chốt được **thực thi đúng hạn** trong các phiên autonomous tiếp theo, không rơi rớt khi context bị xoá giữa các phiên.

| # | Mốc | Hạn | Trạng thái quyết định |
|---|-----|-----|----------------------|
| 1 | **QA-04** — E2E 10 journeys, khởi đầu = ổn định spec flaky trên PR #431 draft (branch `chore/wire-e2e-auth-secrets`) | làm ngay | Secrets đã wired, node22 fix xong; mỗi CI run rớt nhóm spec khác nhau — ổn định chúng là điểm khởi đầu (handoff 2026-07-21c) |
| 2 | **OPS-04** — alert theo SLO | làm ngay | Cuong đã chốt **option A: mở rộng Telegram alert sẵn có** (`docs/roadmap-status-2026-07-21.md`, commit c25c4eb1) |
| 3 | **PERF-05** — so p75 VN trước/sau perf | ~24/07 | Cần RUM ~1 tuần post-deploy (#389 + PERF-04) |
| 4 | **.tl-btn ratchet HARD** — `scripts/check-theline.mjs` Rule 4 advisory → HARD | sau 01/08 | Đã cam kết trong DS-03 |
| 5 | **Funnel UX-07** — đọc funnel `organizer_tournament` 2 tuần data TRƯỚC khi làm template/disclosure 4 bracket flow | ~02/08 | Cổng evidence cam kết trong proposal ux-01-05 §4 inc.5, ràng buộc D1 |
| 6 | **Telemetry badge** — đọc `reg_count_badge_impression` → quyết giữ/bỏ QuickTable social-proof | ~04/08 | Nợ D3 từ #429 (handoff 2026-07-21b) |

## Trả lời intake (từ memory + docs, không hỏi lại Cuong)

- **Ai dùng?** Chính pipeline agent + Cuong. Không phải feature user-facing.
- **Đau ở đâu?** Mốc thời gian hiện chỉ sống trong memory files; phiên mới phải tự nhớ đọc. Đã có tiền lệ mốc bị trôi (soak #407/#409 không chạy vì session limit). Không có cơ chế nào "nổ" đúng ngày.
- **Thành công =** cả 6 mốc được thực thi đúng hạn ±1 ngày, có bằng chứng (PR/commit/report), không mốc nào bị quên.
- **Ràng buộc:** phiên autonomous chạy nền; STANDING instruction "chạy tiếp roadmap tự động, test tay gom manual-test-backlog"; mốc 3-6 là mốc TƯƠNG LAI (không làm sớm được — thiếu data hoặc chưa tới ngày cam kết).

Không gọi AskUserQuestion: mọi quyết định thiết kế của từng mốc đã được Cuong chốt ở các phiên trước (dẫn chứng cột 4). Câu hỏi mở duy nhất — *cơ chế nào* đảm bảo mốc nổ đúng hạn — chính là đối tượng phân tích của panel.
