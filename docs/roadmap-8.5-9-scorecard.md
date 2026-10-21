# Scorecard roadmap 8.5→9 (CLOSE-04, 2026-08-03)

> Chốt sổ roadmap `docs/roadmap-8.5-9.md`. Mỗi phase chấm theo ĐÚNG exit criteria đã
> viết lúc lập kế hoạch — kể cả những cái không đạt/không đo. Bằng chứng = PR/migration/
> report đã ghi trong roadmap + `docs/audits/close-03-2026-08.md`. Ngoại lệ ghi thẳng,
> không làm tròn.

## Kết quả tổng

**71 done · 0 partial · 0 blocked · 3 closed-by-decision (BASE-07, UX-07, UX-09).**
Từ 14/07 đến 03/08 (~3 tuần thay vì 28 tuần kế hoạch — solo + agent pipeline).
Trạng thái cuối: **CI 6/6 xanh không waiver** (PR #536 — lần đầu từ 30/07), 0 secret lộ,
0 `.legacy.tsx`, 2 TODO toàn codebase, coverage 85.92%/83, bundle 1881.5/1970 KB gz,
precache 1.54/3 MB.

## Chấm theo phase

| Phase | Exit criteria | Verdict | Bằng chứng / ngoại lệ |
|---|---|---|---|
| 0.5 Hotfix | 4 defect prod fix + cron alert trong grace | ✅ ĐẠT | HOT-01..07 + OPS-00, `ops_cron_monitors` alert sống (đã bắt sự cố thật nhiều lần trong tháng 7) |
| 0 Baseline | activation versioned · funnel+vitals visible · mobile ADR · before/after đo được | ✅ ĐẠT | BASE-01..06; funnel/vitals: chứng minh queryable bằng chính các mốc UX-07/BADGE/PERF-05 đọc số thật |
| 1 Security | no token in URL · telemetry không impersonate · auth classification tested · drift/rotation/recovery có evidence | ✅ ĐẠT | SEC-01..06, BE-01..03, registry validator 80/80/80 tự động; OPS-02 restore drill PASS 22/07 |
| 2 DS + a11y | token parity web/Swift · component specs · **Lighthouse a11y ≥95** · no critical/serious axe | ⚠️ ĐẠT CÓ NGOẠI LỆ | Parity test 54 assertions ✅; touch 44px ✅; axe: dark theme 0 violation, light còn 0 sau 2 fix #536 ✅. **Ngoại lệ 1:** Lighthouse a11y score chưa bao giờ đo chính thức (Lighthouse CI disabled vì budget + timing-dependent — memory đã đánh dấu "gate mù"). **Ngoại lệ 2:** page-wide axe vẫn `disableRules(["color-contrast"])` — 2 bug nó giấu đã fix, guard vẫn mù (nợ #3 audit) |
| 3 UX | **setup nhanh hơn 40% · task success ≥90% · SUS ≥80** · abandonment giảm đo được | ⚠️ SHIP KHÔNG ĐO | UX-01..08 ship đủ (10 PR). **Ngoại lệ 3 (lớn nhất scorecard):** 3 chỉ số hành vi chưa bao giờ đo — BASE-07/UX-09 (usability sessions) bị Cuong đóng có chủ đích 22/07, nên exit criteria dạng "X% faster/SUS" là unmeasurable by decision. Cái ĐO ĐƯỢC thay thế: funnel organizer 70% completion (n=10, UX-07 read 03/08), 0 support-question class mới |
| 4 Arch/QA | lint/type/test/build green · transitions atomic · 4 lớp test cho journeys · module boundaries doc | ✅ ĐẠT | Re-verified 03/08 trong CLOSE-03 (gates re-check, kèm probe Rule 4 HARD đỏ thật); DB-01/02 + PH001 trigger + pgTAP; QA-01..08; ARCH-01..05 |
| 5 Perf/SEO/Ops | **CWV p75 good** · precache <3MB · SEO 1 manifest · SLO dashboards+alerts live | ⚠️ ĐẠT 3/4, CWV PARTIAL | Precache 1.54MB ✅; SEO-02 manifest ✅ (+track hậu close: #530/#533); OPS-04 trọn 3 inc (uptime-ping, AdminJobs+digest, burn-alert #535 verify tick sống) ✅. **Ngoại lệ 4:** CWV — LCP p75 mobile 2423ms GOOD ✅, **CLS ~0.67 POOR** (tồn tại từ trước, #502/#504/#515 đã ship, field-verdict 30/08), INP chưa đủ mẫu CrUX. PERF-05B (05/08) + mốc 30/08 là phần đọc còn lại |
| 6 Consolidation | dead paths removed · docs refreshed · final audit · scorecard | ✅ ĐẠT | CLOSE-01/02/03 (#536, audit report) + file này là CLOSE-04 |

## Ngoại lệ còn mở (đánh số để trace)

1. **Lighthouse a11y score không có số chính thức** — Lighthouse CI disabled; nếu cần con số, chạy 1 lần thủ công/quý.
2. **Blanket color-contrast trong axe page-wide** — ~2-3h gỡ (kèm gotcha 2 hệ theme `theme`/`tl-theme-mode`).
3. **Phase 3 exit metrics unmeasured-by-decision** — nếu tương lai cần SUS/task-success thật: template `docs/usability-baseline-2026-07.md` còn dùng được.
4. **CLS p75 ~0.67 POOR** — verdict field 30/08; nếu không cải thiện sau #515 → việc perf lớn nhất của chu kỳ sau.
5. 8 nợ kỹ thuật có địa chỉ trong `docs/audits/close-03-2026-08.md` (backstop gz 4.8%, react-router v7, test money-path, CodeQL python, geo-check rate-limit, workflows disabled...).

## Cái học được ở tầng roadmap (không phải tầng code)

- **Gate đỏ kinh niên = không có gate**: quality đỏ 30/07-03/08 cho 15+ commit merge tự do,
  và chính nhánh đó để lọt một bài blog gãy main. Fix không phải "kỷ luật hơn" mà là làm
  gate xanh trung thực được (exclusion đúng đắn) + branch protection (vẫn chưa bật — quyết
  định của Cuong).
- **Đo trước, build sau thắng lớn 2 lần**: UX-07 guest-path (10-14 nửa ngày RED) và
  increment-4 thin-gate đều bị số thật giết trước khi tốn công.
- **Mốc mang predicate + ngày** hoạt động: 4 mốc đọc trong 3 ngày đầu tháng 8 đều thực thi
  đúng predicate, không mốc nào quyết trên data chưa tồn tại.
