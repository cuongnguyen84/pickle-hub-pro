# Vòng 2 — Code review (Bước A, prompt-engineer)

## 1. Verdict code review: **ĐẠT** (Codex PASS + tôi xác minh, 0 finding)

**Codex CLI** (gpt-5.6-sol, session `01a00936-97e8-7e13-b1e3-a74c7ae0a059`, review diff `/tmp/r2-delta.diff`): **PASS, không finding** — wording khớp chính xác acceptance criteria; không còn claim đã-xem-giấy-tờ dựa trên boolean `verified`; `cancelText: "Huỷ"` đúng chỗ; không đổi logic/contract ngoài phạm vi; sr-text sửa đúng.

**Tôi xác minh độc lập trên diff thật:**

- 6 chỗ copy sửa đúng nguyên văn wording trong prompt (đối chiếu từng dòng diff của `ShopStore.tsx`, `ProductCard.tsx`, `ProductDetail.tsx`, `ProductPreview.tsx`).
- `grep -rn "giấy tờ" src/pages/shop src/components/shop` → 5 dòng còn lại đều hợp lệ, khớp báo cáo coder: `SellerApplication.tsx:364,429` + `SellLanding.tsx:91` (seller-side, nói về NỘP — giữ nguyên theo prompt), `ShopStore.tsx:106` + `ProductPreview.tsx:236` (wording mới "đối chiếu giấy tờ **hoặc** gặp trực tiếp", không claim đã xem).
- `cancelText` là option hợp lệ: `src/hooks/useConfirm.tsx:26` (interface) + dòng 73 default `Cancel` khi `language !== "vi"` — đúng root cause vòng 1. Dòng thêm nằm đúng call `confirm({...})` tại `AdminShopApplicationReview.tsx:70`.
- `npx tsc --noEmit` → exit 0 (tôi tự chạy lại, không tin suông báo cáo).

## 2. Vòng 1 không bị đụng — kiểm bằng số học diff

- Vòng 1: +256/−24. Delta vòng 2 khai báo: 4 file copy (+7/−7) + 1 dòng `cancelText` (+1). Tổng kỳ vọng +264/−31 = **đúng bằng** `git diff --stat` hiện tại (9 file, 264 insertions, 31 deletions).
- 5 file untracked vòng 1 (3 test + migration `20260816090000_shop_activate_rpc.sql` + `shop_activate.test.sql`) giữ nguyên, không migration mới.
- 4 file copy là file mới-chạm vòng 2 (vòng 1 không sửa chúng); `AdminShopApplicationReview.tsx` chỉ thêm đúng 1 dòng so với vòng 1.

## 3. Đối chiếu báo cáo coder vs diff thật

Khớp hoàn toàn: danh sách file, số dòng, kết quả grep (5 dòng còn lại), vị trí `useConfirm.tsx:26`. Không có claim nào trong báo cáo mà diff không chứng minh được. Lưu ý minh bạch: tôi tự chạy lại `tsc` (pass) nhưng **không** chạy lại full `npm run test` — coder báo 2664 pass; rủi ro thấp (thay đổi thuần string literal + 1 prop đã type-check), tester vòng 2 sẽ bù bằng runtime thật.

## 4. Test case cho tester vòng 2 (giữ nguyên §3 round1-verdict.md, không cần điều chỉnh)

- **TC-R2-1:** Setup như vòng 1, activate với "Gặp trực tiếp" → tab ẩn danh `/shop/store/<slug>`: dòng xác minh phải là *"ThePickleHub đã xác minh shop này — đối chiếu giấy tờ hoặc gặp trực tiếp người bán."* và KHÔNG còn chữ "đã xem giấy tờ". Kiểm cả `/shop` (ProductCard) không claim giấy tờ.
- **TC-R2-2:** Dialog kích hoạt: nút huỷ label "Huỷ" (không còn "Cancel"); bấm Huỷ vẫn đóng dialog, không gọi RPC.
- **TC4-nhanh:** Lướt lại flow kích hoạt vòng 1 — kích hoạt vẫn thành công (diff chỉ chạm copy + 1 prop dialog, không cần chạy lại TC1-TC9 đầy đủ).

Bổ sung điểm quan sát phụ cho TC-R2-1 (không phải case riêng): nếu shop test có trạng thái CHƯA verified ở bước nào đó, dòng phải là *"Shop chưa được ThePickleHub xác minh."* (nhánh else mới của `ShopStore.tsx:107`).

## 5. Kết luận tạm: **ĐẠT (chờ tester)**

Code review đạt, chưa phải verdict cuối — đợi kết quả TC-R2-1 / TC-R2-2 / TC4-nhanh ở Bước B. 2 MINOR ghi nợ từ vòng 1 (pgTAP thiếu case `restricted`, replay chưa snapshot `verified_at`) vẫn ghi nợ, không chặn.
