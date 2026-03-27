

# SEO Optimization — GSC Data-Driven Actions

## Đánh giá

Phân tích từ Claude AI hợp lý. 3 ưu tiên rõ ràng:

1. **www → non-www redirect** — Traffic đang bị chia đôi (192 vs 49 clicks). Cần gộp authority.
2. **Tối ưu từ khóa "pickleball tournament software" & "pickleball brackets"** — Đang rank #60-64, cần đẩy lên top 20 bằng cách tối ưu title/H1/content trang `/tools`.
3. **Tận dụng đà impressions đang tăng** — Cải thiện CTR bằng meta descriptions hấp dẫn hơn.

## Kế hoạch thực hiện

### 1. 301 Redirect www → non-www
- Thêm redirect rule trong `public/_headers` hoặc configure tại domain level
- **Lưu ý:** Lovable hosting dùng `_headers` file — cần kiểm tra xem có hỗ trợ redirect không. Nếu không, cần configure ở DNS/domain registrar level (Cloudflare hoặc tương tự). Lovable custom domain settings có thể handle việc này nếu cả `thepicklehub.net` và `www.thepicklehub.net` đều được thêm, với non-www là Primary domain.
- **Action:** Kiểm tra domain settings trong Lovable, đảm bảo `www` redirect về non-www.

### 2. Tối ưu trang `/tools` cho target keywords
**Files thay đổi:** `src/pages/Tools.tsx`, `src/i18n/en.ts`, `src/i18n/vi.ts`

- **Title tag:** `"Free Pickleball Tournament Software – Bracket Generator, Team Match & Scoring"` (chứa "pickleball tournament software" + "bracket generator")
- **H1:** Đổi từ generic `t.tools.title` ("Tools") → keyword-rich: `"Free Pickleball Tournament Software & Bracket Generator"`
- **Meta description:** Tối ưu CTR: `"Free pickleball tournament software for organizers. Generate brackets, run round robin, MLP team matches & double elimination. Real-time scoring, mobile-friendly. No signup required."`
- Thêm subtitle paragraph chứa secondary keywords: "pickleball brackets", "pickleball bracket maker", "tournament bracket generator"

### 3. Cải thiện H1 cho sub-pages
- `/tools/quick-tables`: H1 chứa "Pickleball Bracket Generator" 
- `/tools/team-match`: H1 chứa "MLP Team Match Software"
- `/tools/doubles-elimination`: H1 chứa "Double Elimination Bracket"
- Kiểm tra các page này đã có keyword-optimized H1 chưa, nếu chưa thì cập nhật i18n keys

### 4. Internal linking trong SEO content
- Đã có `ToolsHubSeoContent` với internal links — OK
- Thêm `ToolsInternalLinks` component nhỏ ở footer các sub-tool pages link ngược về `/tools` với anchor text chứa target keywords

### 5. Sitemap cập nhật lastmod
- Đã làm ở lần trước — OK

## Files thay đổi
1. `src/pages/Tools.tsx` — title tag + H1 keyword optimization
2. `src/i18n/en.ts` — cập nhật tools.title, tools.description cho SEO
3. `src/i18n/vi.ts` — tương ứng tiếng Việt
4. Domain settings — configure www → non-www redirect (hướng dẫn user)

## Lưu ý quan trọng
- **www redirect** không thể handle hoàn toàn bằng code — cần configure ở domain/hosting level. Sẽ hướng dẫn bạn check domain settings.
- Không thay đổi UI/UX, chỉ meta tags, H1 text, và i18n strings.
- Tuân thủ SEO policy: preserve existing functionality.

