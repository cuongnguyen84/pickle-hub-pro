## Bảng bất đồng — arch-02-03-refactor

| # | Chủ đề | Các phía | Vòng 2 | Trạng thái | Kết luận |
|---|--------|----------|--------|------------|----------|
| D1 | Trình tự ARCH-02: bắt đầu bằng extraction hay characterization tests + i18n TRƯỚC mọi lát tách? | **solution-architect**: Increments: (1) cancel/reactivate → handler.ts + vitest ngay ('0 rủi ro UI'); (2) kéo 7 call inline về hook; (<br>**ui-ux-critic**: Blocker: 0 test parity → 'không đổi hành vi' không kiểm chứng được. Characterization test xanh trước → i18n ho | **solution-architect**: REFINE<br>**ui-ux-critic**: REFINE | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |
| D2 | Bug sống member-path overbooking (register_event_as_member không advisory lock): vá trong cụm này hay ngoài scope? | **solution-architect**: Không trong increments Option A — scope ARCH-02 là layering, không phải vá race DB.<br>**risk-auditor**: Rủi ro Cao độc lập, DB-01 vá sót member path, db-race.mjs không test path này → PHẢI vá trước theo mẫu DB-01. | **solution-architect**: CONCEDE (`supabase/migrations/20260522180000_authed_user_skip_otp.sql:`)<br>**risk-auditor**: REFINE | ✅ RESOLVED_EVIDENCE | Bug overbooking member-path CONFIRMED sống (2 nguồn độc lập verify migration + caller). Vá = migration DB-01c riêng theo mẫu DB-01 (pg_advisory_xact_lock), ship prod-first ~30 phút, thêm member case vào db-race.mjs. Không gộp vào PR layering. |

### 🔶 Cần anh quyết (1)

**D1 — Trình tự ARCH-02: bắt đầu bằng extraction hay characterization tests + i18n TRƯỚC mọi lát tách?**

- `solution-architect`: Increments: (1) cancel/reactivate → handler.ts + vitest ngay ('0 rủi ro UI'); (2) kéo 7 call inline về hook; (3) capacity math → lib. Không đặt gate test-parity trước toàn bộ.
- `ui-ux-critic`: Blocker: 0 test parity → 'không đổi hành vi' không kiểm chứng được. Characterization test xanh trước → i18n hoá ~20 chuỗi VI màn tiền → rồi mới tách.


