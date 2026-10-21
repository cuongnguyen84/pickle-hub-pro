# idea-recon — seo-followup-checklist-v2 (02/08/2026)

**Đã có proposal intake trùng ý tưởng này: `docs/proposals/seo-followup-checklist-v2/00-intake.md`** — chứa đúng 3-4 gap đã tự tìm ra độc lập bên dưới, đã có câu trả lời AskUserQuestion của Cuong (phạm vi = docs + tooling), nhưng `round1/round2/external` còn rỗng — chưa có draft checklist hay script nào được viết.

## Prior art
- `docs/proposals/seo-followup-checklist-v2/00-intake.md` — intake đã tồn tại cho chính ý tưởng này, đã ghi rõ: (1) "loại khỏi sitemap ≠ deindex", (2) ưu tiên 42 crawled-not-indexed trước 138 discovered, (3) sửa title venue phải bump `pr:v32` hoặc `?nocache=1`, (4) gộp "index coverage" + "giảm phụ thuộc singapore-open" vào 1 hạng mục internal-link. `round1/`, `round2/`, `external/` = thư mục rỗng, chưa có nội dung.
- `scripts/seo/gsc_report.py` — gọi Search Analytics API (clicks/impressions/WoW), KHÔNG lấy được index-coverage status theo URL (API này không cung cấp).
- `scripts/seo/seo_verify.py` — bot-check/hreflang/schema/drift, stdlib Python, có sqlite baseline. `scripts/seo-verify.sh` — bash tương đương, curl Googlebot UA theo route list cứng.
- `scripts/seo/canonical_monitor.py` — dò canonical-poisoning giữa các route, không liên quan URL classification.
- `functions/_lib/render/venues.ts:56-70,487-489` + `functions/sitemap-venues.xml.ts` — cơ chế `isThinVenue()` DÙNG CHUNG giữa render (noindex meta) và sitemap (loại URL) đã tồn tại — đúng pattern checklist mục "404 hygiene/robots" cần, chỉ áp dụng cho venue chưa áp dụng nơi khác.
- `functions/_middleware.ts:36-115,521-568` — `X_ROBOTS_NOINDEX` header + noindex shell cho bot đã có pattern chuẩn (tool instances, private routes, 404).
- `functions/api/indexnow.ts` — submit URL tới Bing/Yandex qua key; KHÔNG có API resubmit sitemap Google (đúng như CLAUDE.md ghi — GSC blog blast chỉ có URL Inspection thủ công).
- `public/_redirects` — 301 pattern đã có nhiều tiền lệ (blog slug refresh, bracket-generator dedupe, /su-kien→/social) để tham chiếu style khi viết 301 cho 404 hygiene.
- `src/content/blog/posts/singapore-open-2026-recap.ts` sections đã có field `internalLinks: [{text, path}]` per-section — cơ chế internal link ĐÃ TỒN TẠI, checklist "mở rộng internal link" chỉ cần dùng field này, không cần dựng mới.
- `tests/seo.spec.ts` — Playwright, curl Googlebot UA kiểm title/OG/hreflang/schema theo route, không kiểm coverage/404.

## Checklist gốc giả định SAI (đối chiếu thực tế)
- Slug `/vi/blog/singapore-open-2026` **không tồn tại** — slug thật là `singapore-open-2026-recap` (file `src/content/blog/posts/singapore-open-2026-recap.ts:4`), đây chính là top page trong `Trang.csv` (52 click/263 impr/pos 5.63).
- Export Coverage local **KHÔNG có danh sách URL chi tiết** cho 138 "Discovered–not-indexed" / 42 "Crawled–not-indexed" / 61 404 / 12 robots-blocked / v.v — 4 file CSV (`Siêu dữ liệu.csv`, `Sơ đồ.csv`, `Vấn đề nghiêm trọng.csv`, `Vấn đề không nghiêm trọng.csv`) chỉ có **số đếm tổng theo nguyên nhân**, không có cột URL. Danh sách URL từng nhóm phải export riêng từ GSC UI (mỗi issue một file) hoặc URL Inspection API (quota 2000/ngày) — script "phân loại URL từ export GSC local" như checklist đề không thể chạy trên đúng bộ file này trừ khi có thêm export URL-level.
- `Trang.csv` (Performance export, 999 dòng) có URL list nhưng chỉ kèm clicks/impressions/CTR/position — không có index-status, nên không dùng để phân loại 404 vs noindex vs discovered.

## Data
- GSC Coverage export (`~/Downloads/https___www.thepicklehub.net_-Coverage-2026-08-01/`): 4 CSV, số liệu khớp checklist gốc (16 redirect, 12 robots-blocked, 5 alt-canonical, 3 noindex, 1 soft-404, 61 404, 138 discovered, 42 crawled — từ `Vấn đề nghiêm trọng.csv`).
- GSC Performance export (`~/Downloads/...-Performance-on-Search-2026-08-01/`): `Trang.csv` (999 URL), `Cụm từ tìm kiếm.csv` (1000 query, xác nhận các query CTR quick-win trong checklist đều có data thật: `dk pickleball club` pos 7.8, `picklezone...` pos 5.5 0 click 147 impr, v.v).

## Binding constraints found
- `CLAUDE.md` §Deployment Verification — chỉ dùng curl Googlebot UA / Rich Results Test; **cấm** GSC URL Inspection Live Test (false negative).
- `CLAUDE.md` §SEO Prerender — cache key `pr:v32:${pathname}`; force-refresh 1 path cần `?nocache=1` (giá trị đúng `"1"`); đổi output SSR phải bump version key.
- `CLAUDE.md` — không có Google Indexing API công khai cho blog; resubmit dùng GSC UI Request Indexing + IndexNow cho Bing.
- `docs/milestones.md:17` — mốc `SEO-CLUSTER-READ` 2026-08-23 dùng cùng nguồn GSC, cùng nguyên tắc "đủ ≥4 tuần dữ liệu mới kết luận" — áp dụng trực tiếp cho mục CWV field-data của checklist này.

## Test coverage today
- `tests/seo.spec.ts` — Playwright, bot-view title/OG/hreflang/schema theo route cố định; không cover 404/coverage/redirect classification.
- Không có test nào cho `scripts/seo/*.py` (gsc_report, seo_verify, canonical_monitor) — chạy tay/CI riêng, không có `pytest`/unittest trong repo.

## Unknowns worth asking Cuong
- Có sẵn export URL-level (per-issue) cho 138/42 nhóm không, hay cần hướng dẫn export lại từ GSC UI trước khi viết script phân loại?
- Có PAT/service-account đã cấp quyền URL Inspection API (quota 2000/ngày) để tự động hoá thay vì export tay không?
