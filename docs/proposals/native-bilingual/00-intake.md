# Intake — native-bilingual

Ý tưởng: chuyển app native `/apple` (SwiftUI, VI-only) sang song ngữ VI+EN. O1 đã được Cuong quyết 28/07 trưa (xem memory `native-bilingual-migration`).

## Trả lời của Cuong (28/07)

1. **Cách đổi ngôn ngữ:** Theo iOS Settings — app theo ngôn ngữ hệ thống, iOS tự thêm mục chọn ngôn ngữ per-app trong Settings. Không cần toggle trong app.
2. **Phạm vi:** Toàn bộ ~200 file một mẻ (3–5 nửa ngày, 1–2 PR lớn). App chưa phân phối nên blast radius thấp.
3. **Deadline:** Không gấp. App Store submit vẫn RED-gated riêng, song ngữ không phải điều kiện chặn.

## Bối cảnh từ memory (main = 1808ff57)

- `/apple` VI-only toàn bộ: ~200 file Swift, chuỗi hardcode VI, 0 file localization.
- `project.yml`: `DEVELOPMENT_LANGUAGE: vi`, `SWIFT_EMIT_LOC_STRINGS: YES` đã bật, Swift 6, warnings-as-errors.
- Nguồn thuật ngữ chuẩn: web `src/i18n/{vi,en}.ts`; copy VI/EN từng màn có một phần trong `docs/proposals/web-native-parity-port/round1/ui-ux-critic.md`.
- Xưng hô chuẩn: "bạn" hoặc bỏ chủ ngữ (KHÔNG "Anh…").
- Baseline test: 154 tests / 31 suites xanh (28/07).
- Gotcha build: cài sim test tay phải build CÓ KÝ; `-derivedDataPath` cục bộ; test chạm UI cần `@MainActor`.
