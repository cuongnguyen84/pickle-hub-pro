# DS-03 — Intake (2026-07-18)

**Ý tưởng gốc:** DS-03 (roadmap Phase 2): chuẩn hoá 8 component — Button, IconButton, Input, Select, Card, Badge, Dialog, Sheet. Depends: DS-02 (done 2026-07-18, #401 — token parity web ↔ Swift + drift-guard test).

**Trả lời của Cuong:**

1. **Platform:** Web + native SwiftUI CÙNG ĐỢT (không nợ parity — tinh thần fix-both-web-and-native).
2. **Chiến lược web** (retrofit shadcn variant TL vs bộ TL component riêng): **để panel đề xuất**, Cuong quyết sau khi đọc proposal.
3. **Definition of done:** CẢ HAI — (a) 5–8 màn trên 2 north-star journey (BASE-04, docs/journey-screens.md) chỉ dùng component chuẩn, đo được bằng grep/test; (b) gate CI ratchet cho phần còn lại của app.

**Ràng buộc kế thừa từ hệ thống:**
- Token layer đã chốt: web `--tl-*` (src/styles/the-line.css) ↔ Swift `TLColor`/`TLRadius`, parity test `src/lib/__tests__/design-token-parity.test.ts` (DS-02).
- Rule DS-01: component chỉ tham chiếu semantic token — không raw hex, không Tailwind palette trên bề mặt Line-styled.
- TheLine conformance gate hiện có: `scripts/check-theline.mjs` (chạy trên changed files).
- A11Y-02 (touch target 44px) + DS-04 (Empty/Loading/Error/Offline states) + A11Y-04 (axe/keyboard tests) đều depends DS-03 — thiết kế DS-03 phải mở đường cho chúng.
