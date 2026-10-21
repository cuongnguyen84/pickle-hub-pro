# Intake — seo-followup-checklist-v2

**Ý tưởng:** Cải thiện "SEO follow-up sau PR #515" checklist (TODO.md, commit f4c20b19, nhánh `docs/seo-followup-checklist`).

**Bối cảnh:** Trong phiên chat 02/08/2026, đã đánh giá checklist và tìm ra 3 điểm cần sửa:
1. "Loại khỏi sitemap" ≠ deindex — URL thin cần `noindex`, xoá sitemap chỉ là phụ.
2. Nên tách ưu tiên: 42 URL *Crawled – not indexed* (tín hiệu chất lượng) xử lý trước 138 *Discovered – not indexed* (crawl priority, tự cải thiện khi internal link tốt lên).
3. Sửa title venue phải invalidate prerender cache (`pr:v32` bump hoặc `?nocache=1` từng path) — không thì Googlebot thấy title cũ hàng tuần.
4. (Gộp) Mục "index coverage" và "giảm phụ thuộc singapore-open-2026" chung lời giải internal linking — nên gộp thành một hạng mục.

**Trả lời của Cuong (AskUserQuestion):**
- **Phạm vi:** Docs + tooling — viết lại checklist đúng kỹ thuật + script tự động phân loại URL từ export GSC (404, not-indexed theo sitemap segment).
- **Data GSC:** Có file local:
  - `~/Downloads/https___www.thepicklehub.net_-Coverage-2026-08-01/` — Siêu dữ liệu.csv, Sơ đồ.csv, Vấn đề nghiêm trọng.csv, Vấn đề không nghiêm trọng.csv
  - `~/Downloads/https___www.thepicklehub.net_-Performance-on-Search-2026-08-01/` — Cụm từ tìm kiếm.csv, Trang.csv (83KB), Quốc gia.csv, Thiết bị.csv, Sơ đồ.csv, Bộ lọc.csv, Hình thức xuất hiện.csv
  - ⚠️ Export Coverage là bản tổng hợp (chart data), KHÔNG chứa danh sách từng URL của nhóm 138 Discovered / 42 Crawled not-indexed. Danh sách URL chi tiết phải export riêng từng issue trên GSC web (hoặc dùng URL Inspection API, quota 2000/ngày).

**Thành công:** checklist thực thi được không cần rà tay từng URL; các bước kỹ thuật đúng (noindex/sitemap/prerender); baseline GSC 01/08 giữ nguyên làm mốc so sánh.

**Ràng buộc:** giữ workflow hiện có (Googlebot curl verification, seo-verify); tiếng Việt cho docs.
