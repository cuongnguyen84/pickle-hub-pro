## Bảng bất đồng — ux-01-05-organizer-wizard

| # | Chủ đề | Các phía | Vòng 2 | Trạng thái | Kết luận |
|---|--------|----------|--------|------------|----------|
| D1 | Thứ tự ship: autosave trước hay instrumentation trước cho 4 flow tournament | **solution-architect**: Increment 1-2 = autosave (social rồi 4 flow + native), increment 3 mới là journey organizer_tournament. Autosa<br>**pre-mortem**: Gate cứng: mở journey funnel sang 4 flow tournament TRƯỚC khi merge UX-04/05, nếu không mọi hồi quy flow tourn<br>**risk-auditor**: Slice order khuyến nghị (đồng ý với GPT-5.6): instrument → backend additive → social autosave → tournament khô | **solution-architect**: REFINE<br>**risk-auditor**: REFINE<br>**pre-mortem**: CONCEDE (`docs/proposals/ux-01-05-organizer-wizard/round1/solution-arc`) | ✅ RESOLVED_EVIDENCE | localStorage-only triệt tiêu cơ sở an toàn của gate instrument-first (pre-mortem CONCEDE có bằng chứng). Thứ tự chốt (architect tự siết): (1) autosave social → (2) instrument organizer_tournament 4 flow → (3) autosave 4 flow tournament. Ràng buộc còn lại từ risk-auditor: không tuyên bố 'tăng completion' cho 4 flow tournament trước khi funnel live; native tách PR riêng. |
| D2 | UX-03 consolidation cho tournament flows: làm ngay hay chờ evidence | **solution-architect**: STOP-AND-LOOK: chỉ làm template/disclosure cho flow bracket khi funnel organizer_tournament (2 tuần) chỉ ra dr<br>**ui-ux-critic**: Recon SAI — TeamMatch/DoublesElim/QuickTable ĐÃ là stepped wizard. UX-03 thật = hợp nhất 2 ngôn ngữ wizard + c | **solution-architect**: CONCEDE (`TeamMatchSetup.tsx:21,95-103,376 (type Step=1..5, STEPS[], '`)<br>**ui-ux-critic**: REFINE | ✅ RESOLVED_EVIDENCE | UX-03 = 3 việc consolidation đã biết (unify step-header cả 5 flow, Dreambreaker collapse TeamMatch 5→4, payment branching tường minh) — làm ngay, không chờ funnel. Payment branching phải kèm guard risk-auditor #4 (validate server-side theo payment mode đã persist, clear state khi ẩn). Mọi mở rộng template/disclosure bracket vượt 3 việc này vẫn qua cổng evidence. |
| D3 | UX-02 templates: nguồn template và ranh giới an toàn bank config | **solution-architect**: templates.ts = 2-3 preset TĨNH prefill FormState (vòng 1 không nói rõ có loại trừ bank fields không).<br>**pre-mortem**: P0: template sinh từ event cũ kéo nguyên bank trio → 3 tuần tiền vào STK người đã rời CLB. Đòi guard: checkbox<br>**ui-ux-critic**: UX-02 xếp CUỐI (nice-to-have) — đo usage sau khi autosave live rồi hãy đầu tư. | **solution-architect**: REFINE<br>**pre-mortem**: REFINE<br>**ui-ux-critic**: HOLD | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |
| D4 | UX-01 resume-slice: dashboard 'Bản nháp' có bắt buộc ship cùng autosave không | **solution-architect**: Không cần — restore xảy ra ngay trong wizard khi mở lại cùng scope (DraftRestoredBanner). Dashboard section = <br>**ui-ux-critic**: Bắt buộc ship cùng UX-04 — entry point duy nhất là nút 'Tạo sự kiện mới' (vi.ts:4865), organizer bỏ dở không b | **solution-architect**: HOLD<br>**ui-ux-critic**: HOLD | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |

### 🔶 Cần anh quyết (2)

**D3 — UX-02 templates: nguồn template và ranh giới an toàn bank config**

- `solution-architect`: templates.ts = 2-3 preset TĨNH prefill FormState (vòng 1 không nói rõ có loại trừ bank fields không).
- `pre-mortem`: P0: template sinh từ event cũ kéo nguyên bank trio → 3 tuần tiền vào STK người đã rời CLB. Đòi guard: checkbox xác nhận hiển thị bank_account_name khi bank đến từ prefill.
- `ui-ux-critic`: UX-02 xếp CUỐI (nice-to-have) — đo usage sau khi autosave live rồi hãy đầu tư.

**D4 — UX-01 resume-slice: dashboard 'Bản nháp' có bắt buộc ship cùng autosave không**

- `solution-architect`: Không cần — restore xảy ra ngay trong wizard khi mở lại cùng scope (DraftRestoredBanner). Dashboard section = nâng cấp discoverability, ship sau nếu usage chứng minh.
- `ui-ux-critic`: Bắt buộc ship cùng UX-04 — entry point duy nhất là nút 'Tạo sự kiện mới' (vi.ts:4865), organizer bỏ dở không bấm nút 'MỚI' để mong khôi phục; vòng lặp không khép.


