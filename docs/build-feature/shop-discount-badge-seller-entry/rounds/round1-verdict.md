VERDICT: CHƯA ĐẠT

## Vòng 1 — Bước B

Code review (Bước A) chưa đạt vì B1 và B2; test thật 2 pass / 0 fail / 7 skip — 7 case skip là do tab Chrome chưa login và `SHOP_PUBLIC_OPEN=false`, không phải lỗi code, nhưng cũng chưa có bằng chứng UI nào cho AC5-12. Theo luật "đạt = review đạt VÀ test pass", vòng này chưa đạt.

Tôi đã tự đối chiếu lại code trong worktree trước khi chốt:

- **B1 thật.** `src/lib/shop/discount.ts` `discountPct()` trả `Math.floor(...)` có thể là `0` (1.999.999/2.000.000) → PDP/hint form/VariantEditor in `-0%`, trong khi card gate ≥1 nên không badge → lệch AC5. SQL `discount_pct_max` (migration 20260829120000, dòng ~655) cũng có thể trả `0`.
- **B2 thật.** `src/components/shop/VariantEditor.tsx:133` seed cho `reconcileRows` chỉ có `priceVnd`/`stockOnHand`; `variantMatrix.ts:156,176` hard-code `compareAtVnd: first/kept?.compareAtVnd ?? ""` → bật ma trận cho sản phẩm đơn đang giảm giá là mất giá gốc âm thầm, lưu là mất thật.
- **B6 xác nhận có rủi ro.** `src/styles/shop.css:1556` `.tl-pdp-price > span { white-space: nowrap; }` áp cả span giá/khoảng giá (span không class, ProductDetail.tsx:349) — chuỗi "1.250.000₫ – 2.450.000₫" ở 22px bold ~ 300px, thêm gap và badge là tràn 320px.
- B3, B5 bác như Bước A. B4 nhẹ, tuỳ chọn.

Tester không fail case nào nên không có bất đồng giữa Codex/tester/tôi. Vòng 2: coder sửa 3 mục theo `round2-prompt.md`; tester chạy lại TC1-TC9 sau khi Cuong login sẵn trong Chrome (admin đi xuyên ShopGate).
