

# Blog System với 2 ngôn ngữ (EN + VN)

## Tổng quan

Tạo hệ thống blog static (không cần database) với nội dung song ngữ EN/VN, sử dụng i18n system hiện có. 3 bài blog target từ khóa GSC có impressions cao nhưng rank thấp.

## Kiến trúc

```text
src/
├── lib/blog-data.ts          → Blog metadata + content (EN/VN)
├── pages/Blog.tsx             → Blog listing page
├── pages/BlogPost.tsx         → Blog post renderer
├── components/seo/
│   └── ArticleSchema.tsx      → Article JSON-LD cho Rich Results
```

## Chi tiết thực hiện

### 1. Blog data structure (`src/lib/blog-data.ts`)
- Mỗi post chứa `content.en` và `content.vi` (title, description, body sections)
- Slug-based lookup, metadata (publishedDate, author, tags)
- 3 bài:
  - `best-pickleball-tournament-software-2025` → target "pickleball tournament software"
  - `how-to-create-pickleball-bracket` → target "pickleball brackets"  
  - `pickleball-round-robin-generator-guide` → target "pickleball round robin generator"

### 2. Blog listing page (`src/pages/Blog.tsx`)
- Grid cards hiển thị title/description theo ngôn ngữ hiện tại
- DynamicMeta + BreadcrumbSchema
- Link đến từng post

### 3. Blog post page (`src/pages/BlogPost.tsx`)
- Render content theo `language` từ i18n context
- DynamicMeta (title/description theo ngôn ngữ)
- ArticleSchema JSON-LD
- BreadcrumbSchema (Home > Blog > Post)
- CTA buttons link về `/tools` và sub-tools
- Internal links footer

### 4. ArticleSchema (`src/components/seo/ArticleSchema.tsx`)
- JSON-LD `@type: Article` với headline, datePublished, author, image
- Hỗ trợ `inLanguage` dynamic theo ngôn ngữ hiện tại

### 5. Routing & Navigation
- `App.tsx`: thêm lazy routes `/blog`, `/blog/:slug`
- `AppHeader.tsx`: thêm "Blog" vào navLinks
- i18n: thêm `nav.blog` key cho EN/VN

### 6. SEO updates
- `sitemap.xml`: thêm `/blog` + 3 post URLs
- `ToolsSeoContent.tsx`: thêm links đến blog posts
- Barrel export `ArticleSchema` trong `seo/index.ts`

## Files thay đổi

| File | Action |
|------|--------|
| `src/lib/blog-data.ts` | Tạo mới |
| `src/pages/Blog.tsx` | Tạo mới |
| `src/pages/BlogPost.tsx` | Tạo mới |
| `src/components/seo/ArticleSchema.tsx` | Tạo mới |
| `src/App.tsx` | Thêm 2 routes |
| `src/components/layout/AppHeader.tsx` | Thêm Blog nav link |
| `src/i18n/vi.ts` | Thêm blog interface + VN strings |
| `src/i18n/en.ts` | Thêm blog EN strings |
| `src/components/seo/index.ts` | Export ArticleSchema |
| `public/sitemap.xml` | Thêm blog URLs |
| `src/components/seo/ToolsSeoContent.tsx` | Thêm links đến blog |

## Nội dung blog

Mỗi bài ~800-1200 words, keyword density tự nhiên, có CTA rõ ràng link về tools. Content tiếng Việt là bản dịch/localize đầy đủ (không phải tóm tắt), phù hợp để rank từ khóa tiếng Việt.

