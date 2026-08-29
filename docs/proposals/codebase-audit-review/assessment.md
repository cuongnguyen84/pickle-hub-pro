# Đánh giá bảng audit "6.6/10" — kết quả fact-check (04/08/2026)

**Cách làm:** 3 agent Explore độc lập, mỗi agent một mảng (backend/security · frontend · native/ops), verify 23 claim cụ thể bằng grep/wc/git log/CI run thật. Output thô nguyên văn: `round1/backend-verify.md`, `round1/frontend-verify.md`, `round1/native-ops-verify.md`. Không có vòng debate — 3 agent phủ 3 tập claim rời nhau, không phát sinh mâu thuẫn giữa chúng; mâu thuẫn duy nhất (C7) do phương pháp của agent, orchestrator giải bằng `gh workflow list` (bằng chứng bên dưới).

## Kết luận

Bảng audit **đáng tin về HƯỚNG, không đáng tin về SỐ**. 12/23 claim đúng hoàn toàn kèm bằng chứng; 4 claim đúng vấn đề nhưng đếm thiếu (thực tế **tệ hơn** báo cáo); 4 claim nói quá hoặc thiếu ngữ cảnh; 3 claim sai hoặc stale. Mẫu lỗi nhất quán: các chỗ sai đều là **trạng thái cũ** (coverage, cron workflow, types.ts) — bảng này được viết một phần từ trí nhớ/ghi chú cũ chứ không đo tươi 100% tại thời điểm viết.

## Điểm nặng nhất: XÁC NHẬN

**P1 security (claim #1) đúng toàn bộ 4 vế**, còn sống trên prod:
- Policy: `20260511120000_social_events_foundation.sql:301-308` — WITH CHECK chỉ ràng `profile_id = auth.uid()`, không ràng `payment_status`.
- Grant: `20260511130000_...:51` — `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` table-level, chưa từng bị REVOKE/narrow (grep hết 323 migration).
- CHECK constraint cho phép `'paid'`; trigger đều AFTER, không có BEFORE INSERT guard.
- Mọi đường client hợp lệ đi qua RPC `register_event_as_member` (advisory lock DB-01, set payment server-side) — policy INSERT này giờ **chỉ phục vụ attacker**. Khớp memory 27/07 ("lỗ .insert() sống trên prod").

## Bảng đối chiếu các claim lệch

| Claim trong bảng audit | Thực tế đo được | Verdict |
|---|---|---|
| 8/81 trang có isError | **7/113** (6%) — tệ hơn | Đúng hướng, sai số |
| 1.017 ternary `language === "vi"`, 991 `t.*` | **1.686** ternary (single+double quote), 2.010 `t.*` | Đúng hướng, đếm thiếu |
| invalidateQueries 294 điểm / 11+ file | 294 đúng, nhưng **75 file** | Đúng hướng, đếm thiếu |
| xcstrings: 851 needs_review, 34 thiếu EN | **1.764** needs_review, **86** thiếu EN (~2x) | Sai số, tệ hơn 2x |
| auth-registry khớp 100% (78) | Registry liệt kê **77** — thiếu `news-social-caption` | Nói quá |
| DUPR token plaintext at-rest | Đúng hiện trạng, nhưng bỏ qua: AES-256-GCM đã ship + wire (`_shared/token-crypto.ts`), có `TOKEN_ENCRYPTION_ROLLOUT.md`, chỉ chờ secret + backfill | Thiếu ngữ cảnh |
| Native blocker `update_chat_nickname` | Cả 3 vế đúng NHƯNG caller lẫn migration đều **chưa commit** — HEAD không reference RPC. Rủi ro thật = commit Swift mà thiếu SQL, không phải blocker hôm nay | Nói quá |
| types.ts thiếu audit_logs, content_reports | **SAI** — cả 2 có mặt (types.ts:56, :876) | FALSE |
| Coverage 75% < gate 83%, đỏ kinh niên, cần re-base | **STALE** — CLOSE-03 (PR #536, 03/08 đêm) đưa coverage lên **85.92%** bằng exclude trung thực, CI xanh 6/6. Các lần đỏ trước do test assertion + dependabot, không phải threshold. Đề xuất "re-base ngưỡng" của bảng là **thuốc sai bệnh** | FALSE (đã fix) |
| 8 cron workflow tắt, repo không ghi | Count stale: **7** disabled_manually (`gh workflow list` 04/08: dupr-canary, dupr-refresh, edge-auth-parity, lighthouse, migration-drift, milestone-due, theline-audit; security + uptime-ping đã bật lại). Vế "repo không ghi" **ĐÚNG** — file workflow trông "active", chính agent verify bị lừa khi chỉ đọc repo | PARTIAL |
| Bundle ratchet 1850→1970 | Đúng, còn sót 2 bước (1800→1850→1900→1950→1970), commit message tự thú "to unblock merges" | Đúng |
| 2 test stale đếm 76 function | Đúng — chạy lại: 2 failed (`edge-auth-registry.test.ts:41`, `edge-cors-serve.test.ts:235`, expected 76 got 78). CLAUDE.md "50 active" cũng stale | Đúng |
| Live/News/TournamentDetail nuốt lỗi mạng | Đúng cả 3, bằng chứng file:line trong round1/frontend-verify.md | Đúng |
| AVPlayer 2 controller / assertionFailure 4 repo | Đúng cả 2 (18 call site assertionFailure) | Đúng |
| Quy mô (201k TS / 839 file / 113 trang / 48k Swift / 230 file / 323 migration / 78 function) | Khớp chính xác toàn bộ | Đúng |

## Top-5 hành động của bảng — hiệu chỉnh

1. ~~**DROP policy `event_registrations_insert_self` + REVOKE INSERT**~~ — ✅ **SHIPPED 04/08**, migration `20260804090000_close_event_registrations_insert_bypass.sql`, đã áp prod. Verify: `has_table_privilege('authenticated', 'event_registrations', 'INSERT')` = false; probe forge-paid trên prod → `42501`; 105 row nguyên vẹn. DROP cả policy organizer (policy không grant sẽ mời sweep cấp lại grant). Chi tiết: `docs/proposals/codebase-audit-review/shipped.md`.
2. **5 file untracked** — GIỮ nhưng đổi khung: không phải blocker hiện tại; là việc quy trình — commit Swift + migration + test cùng nhau, xác nhận 2 migration 01/08 đã áp prod chưa, regen types.
3. **isError/ErrorState cho Live/News/TournamentDetail** — GIỮ, thực tế 7/113 tệ hơn số báo cáo.
4. **Re-base coverage** — **BỎ** (đã xong 03/08). Thay bằng việc nhỏ thật: sửa 2 test 76→78 + thêm `news-social-caption` vào auth-registry.json + sửa CLAUDE.md "50 active"→78.
5. **Query key factory** — GIỮ, scope thật 75 file chứ không phải 11.

## Về điểm 6.6/10

Không re-score. Sai số của bảng đi cả hai chiều (i18n/xcstrings tệ hơn báo cáo, coverage/types.ts tốt hơn báo cáo) nên điểm tổng không lệch hệ thống — nhưng mọi con số trong bảng nên coi là **ước lượng có sai số ±50%**, còn các phát hiện định tính (nuốt lỗi mạng, god component, ratchet trượt, P1 security) đều đứng vững khi kiểm bằng bằng chứng.
