# Intake — cụm UX-01..05 (organizer wizard)

> 2026-07-19. Trả lời của Cuong qua AskUserQuestion, nguyên văn ý.

**Ý tưởng gốc:** roadmap 8.5→9 Phase 3, cụm UX-01..05:
- UX-01 — organizer setup checklist/status model (4d)
- UX-02 — tournament/event templates for the five most common formats (5d)
- UX-03 — progressive disclosure of advanced settings (5d)
- UX-04 — draft autosave + visible last-saved state (4d)
- UX-05 — pre-publish validation with direct recovery actions (4d)

## Câu trả lời intake

1. **Phạm vi: CẢ 5 flow tạo giải** — không chỉ social event wizard (`/clb/:slug/social/moi`) mà cả QuickTable, TeamMatch, DoublesElimination, Flex Tournament. (Lưu ý orchestrator: rộng hơn phương án recommended; panel cần cân nhắc thứ tự triển khai trong phạm vi này.)
2. **Đau chính: bỏ dở giữa wizard** — organizer điền dở rồi thoát (mất dữ liệu vì chưa có autosave), hoặc kẹt ở bước payment config. **Metric thành công: tỉ lệ O2→O4 hoàn thành (funnel BASE-02) tăng.**
3. **Ràng buộc: web + native SwiftUI cùng đợt** (nguyên tắc fix-both-web-and-native). Không deadline cứng được nêu.

## Ngữ cảnh liên quan (orchestrator ghi, từ memory/roadmap)

- Roadmap ghi UX-01/07: "May start from analytics, support feedback, and the first 3–5 usability sessions; the full BASE-07 baseline is only required before UX-09 concludes effectiveness" — BASE-07 đang blocked (participants), nhưng không chặn start.
- Memory `referee-scoring-feature`: "Cuong plans to standardize create-tournament formats for better referee UX" — cùng hướng UX-02.
- DS-03/DS-04 đã ship: Button/states components là nền cho mọi UI mới của cụm này.
- Funnel BASE-02 đã emit `organizer_event_creation_started` / `details_completed` / `organizer_event_published` / `draft_saved` trên social wizard (xem `src/lib/journeys` + docs/north-star-journeys.md).
