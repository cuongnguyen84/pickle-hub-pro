## Bảng bất đồng — livestream-gate-hardening

| # | Chủ đề | Các phía | Vòng 2 | Trạng thái | Kết luận |
|---|--------|----------|--------|------------|----------|
| D1 | Chữ ký param mới của useIntervalViewCounter: optional default-true hay required | **solution-architect**: Thêm `active?: boolean` default `true` — video callers không đổi = 0 thay đổi hành vi, không đụng file ngoài s<br>**risk-auditor**: Giữ default = hành vi hiện tại nếu không truyền cờ, nhưng cập nhật + test cả 5 caller trong cùng PR.<br>**pre-mortem**: Param phải REQUIRED (không default) — TS đỏ ở mọi caller buộc quyết định tường minh; optional-default là đúng  | **solution-architect**: REFINE<br>**risk-auditor**: REFINE<br>**pre-mortem**: CONCEDE (`src/hooks/useIntervalViewCounter.ts:53-55 — tick hiện push e`) | ✅ RESOLVED_EVIDENCE | Kịch bản P0 mất-data-im-lặng chết bằng bằng chứng (hook hiện đếm vô điều kiện; default-true giữ nguyên hành vi video). Chữ ký chốt: REQUIRED param theo architect round-2 (thoả luôn merge-gate của auditor); bắt buộc kèm test 'video vẫn đếm' trong cùng PR. |
| D2 | Ngân sách preview 15s dùng chung giữa homepage hero và trang xem (localStorage key chỉ theo livestreamId) | **solution-architect**: Persist elapsed theo key `pkl_preview_elapsed_<id>` — một ngân sách chung cho mọi bề mặt (không tách theo surf<br>**pre-mortem**: Key chung + gate homepage arm thật = user đốt 15s ở ô nhỏ trang chủ rồi vào /live/:id bị chặn giây-0 đêm live <br>**risk-auditor**: Trung lập: chấp nhận có chủ đích HOẶC tách namespace — nhưng phải ghi rõ quyết định vào proposal. | **solution-architect**: REFINE<br>**pre-mortem**: HOLD<br>**risk-auditor**: REFINE | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |
| D3 | Presence-gated có ship trong đợt này không, và làm sao để nó không thành no-op giả | **solution-architect**: Ship, nhưng defer PR cuối; re-track qua channel.track() khi gated đổi; cắt nếu rủi ro > giá trị (admin-only ni<br>**ui-ux-critic**: Cần cho admin (tách 'Đang xem' vs 'Chờ đăng nhập') — giữ trong scope, mức hẹp: 1 field + 1 badge.<br>**pre-mortem**: Rủi ro cao nhất là fake-fix: track() chỉ chạy 1 lần lúc SUBSCRIBED, refcount channel dùng chung không cho re-t | **solution-architect**: REFINE<br>**ui-ux-critic**: REFINE<br>**risk-auditor**: HOLD<br>**pre-mortem**: HOLD | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |
| D4 | CTA của embed gate: có redirect về /live/:id sau auth không + tên param signup | **solution-architect**: Bỏ ?redirect (vô nghĩa trong iframe), trỏ thẳng /login?tab=signup.<br>**ui-ux-critic**: Redirect KHÔNG vô nghĩa: tab mới là top-level, sau auth tab đó redirect về /live/:id và user xem tiếp ở first- | **solution-architect**: CONCEDE (`src/pages/Login.tsx:32 — searchParams.get("mode") !== "signu`)<br>**ui-ux-critic**: HOLD | ✅ RESOLVED_EVIDENCE | CTA embed = /login?mode=signup&redirect=/live/:id&source=embed_live_gate (target=_blank). Đồng thời sửa luôn bug đang sống: nút 'Tạo tài khoản' của overlay hiện tại trỏ &tab=signup — dead param, mở nhầm tab Đăng nhập (LivestreamGateOverlay.tsx:38 vs Login.tsx:32). |
| D5 | Re-pause khi gated: tự pause trong MuxPlayer là đủ, hay bắt buộc thoát native fullscreen/PiP trước khi hiện overlay | **solution-architect**: MuxPlayer nhận prop gated, self re-pause trên mọi onPlay — 1 guard che mọi ca resume, coi là đủ.<br>**ui-ux-critic**: Blocker: re-pause câm trong native fullscreen = màn đen tự dừng không lý do, cảm giác app hỏng; MuxPlayerHandl | **solution-architect**: REFINE<br>**ui-ux-critic**: HOLD | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |
| D6 | Chiến lược thoát fullscreen (mới, phát sinh vòng 2): luôn exit-rồi-overlay, hay phân nhánh wrapper-fullscreen giữ nguyên + overlay trong wrapper vs native-exit | **solution-architect**: Always-exit-then-overlay; bỏ nhánh giữ-fullscreen — ít code, robust hơn cho solo-maintainer.<br>**ui-ux-critic**: Phân nhánh: wrapper-fullscreen thì render overlay trong wrapper giữ fullscreen; chỉ native video-only fullscre |  | 🔶 OPEN_FOR_CUONG | **cần Cuong quyết** |

### 🔶 Cần anh quyết (4)

**D2 — Ngân sách preview 15s dùng chung giữa homepage hero và trang xem (localStorage key chỉ theo livestreamId)**

- `solution-architect`: Persist elapsed theo key `pkl_preview_elapsed_<id>` — một ngân sách chung cho mọi bề mặt (không tách theo surface).
- `pre-mortem`: Key chung + gate homepage arm thật = user đốt 15s ở ô nhỏ trang chủ rồi vào /live/:id bị chặn giây-0 đêm live → phễu signup sập; phải tách key theo bề mặt hoặc chỉ tính preview trên trang xem.
- `risk-auditor`: Trung lập: chấp nhận có chủ đích HOẶC tách namespace — nhưng phải ghi rõ quyết định vào proposal.

**D3 — Presence-gated có ship trong đợt này không, và làm sao để nó không thành no-op giả**

- `solution-architect`: Ship, nhưng defer PR cuối; re-track qua channel.track() khi gated đổi; cắt nếu rủi ro > giá trị (admin-only nicety).
- `ui-ux-critic`: Cần cho admin (tách 'Đang xem' vs 'Chờ đăng nhập') — giữ trong scope, mức hẹp: 1 field + 1 badge.
- `pre-mortem`: Rủi ro cao nhất là fake-fix: track() chỉ chạy 1 lần lúc SUBSCRIBED, refcount channel dùng chung không cho re-track tự nhiên — không có runtime assert thì đừng ship, vì nó đóng bug thật dưới vỏ đã-fix.

**D5 — Re-pause khi gated: tự pause trong MuxPlayer là đủ, hay bắt buộc thoát native fullscreen/PiP trước khi hiện overlay**

- `solution-architect`: MuxPlayer nhận prop gated, self re-pause trên mọi onPlay — 1 guard che mọi ca resume, coi là đủ.
- `ui-ux-critic`: Blocker: re-pause câm trong native fullscreen = màn đen tự dừng không lý do, cảm giác app hỏng; MuxPlayerHandle phải thêm exitFullscreen()/exitPip() và chủ động thoát trước khi hiện overlay.

**D6 — Chiến lược thoát fullscreen (mới, phát sinh vòng 2): luôn exit-rồi-overlay, hay phân nhánh wrapper-fullscreen giữ nguyên + overlay trong wrapper vs native-exit**

- `solution-architect`: Always-exit-then-overlay; bỏ nhánh giữ-fullscreen — ít code, robust hơn cho solo-maintainer.
- `ui-ux-critic`: Phân nhánh: wrapper-fullscreen thì render overlay trong wrapper giữ fullscreen; chỉ native video-only fullscreen mới exit rồi hiện overlay; PiP thì exitPictureInPicture.


