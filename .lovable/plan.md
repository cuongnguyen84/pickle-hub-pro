

# Phân tích keyword GSC & Kế hoạch hành động

## Phân tích dữ liệu keyword

Từ ảnh GSC, tôi nhận diện các cụm keyword chính và đối chiếu với blog hiện có:

| Cụm keyword | Impressions cao | Đã có blog? | Hành động |
|---|---|---|---|
| "pickleball tournament software" | 80 imp, 3 clicks | ✅ Có | Thêm internal links |
| "pickleball brackets" | 43 imp, 0 clicks | ✅ Có | Thêm internal links |
| "round robin generator/schedule" | 15+ imp | ✅ Có | Thêm internal links |
| **"pickleball live stream/streaming"** | 9 clicks, nhiều imp | ❌ CHƯA | **Tạo blog mới** |
| **"mlp format/mlp pickleball format"** | Nhiều imp, 0 clicks | ❌ Chỉ 1 section nhỏ | **Tạo blog mới** |
| **"pickleball bracket generator free"** | Nhiều variants | ❌ Chỉ mention | **Tạo blog mới** |
| **"pickleball bracket template"** | Vài imp | ❌ CHƯA | **Tạo blog mới** |
| "pickleball organize tools" | Vài imp | ✅ Có | OK |

**Nhận xét quan trọng**: "pickleball live stream" có **9 clicks** — là keyword non-branded duy nhất có clicks đáng kể, nhưng **chưa có blog post nào** nhắm vào nó. Đây là cơ hội lớn nhất.

---

## Kế hoạch thực hiện

### 1. Tạo 4 blog posts mới (file: `src/lib/blog-data.ts`)

**Blog 1: "Pickleball Live Streaming — How to Watch & Stream Pickleball Online"**
- Target keywords: `pickleball live stream`, `pickleball live streaming`, `pickleball live`
- Nội dung: Hướng dẫn xem livestream pickleball, các platform streaming, cách stream giải đấu
- CTA → `/live`

**Blog 2: "MLP Format Explained — Major League Pickleball Team Match Rules"**
- Target keywords: `mlp format`, `mlp pickleball format`, `mlp format pickleball`
- Nội dung: Chi tiết thể thức MLP, cách tổ chức team match, lineup, dreambreaker
- CTA → `/tools/team-match`

**Blog 3: "Free Pickleball Bracket Generator — Create Brackets in 60 Seconds"**
- Target keywords: `pickleball bracket generator`, `pickleball bracket generator free`, `free pickleball bracket maker`, `pickleball brackets app free`
- Nội dung: So sánh bracket generators, hướng dẫn dùng Quick Tables, features
- CTA → `/tools/quick-tables`

**Blog 4: "Pickleball Bracket Templates — Download & Use Free Templates"**
- Target keywords: `pickleball tournament bracket template`, `pickleball bracket template`, `bracket template`
- Nội dung: Các mẫu bracket cho 4/8/16/32 người, round robin vs elimination templates
- CTA → `/tools/quick-tables`

### 2. Thêm internal linking: Related Posts (file: `src/pages/BlogPost.tsx`)

Thêm section "Related Posts" ở cuối mỗi bài blog, hiển thị 3 bài liên quan dựa trên shared tags. Giúp:
- Google crawl sâu hơn
- Tăng thời gian trên trang
- Truyền link equity giữa các bài

### 3. Thêm internal links từ Tools → Blog (file: `src/components/seo/ToolsSeoContent.tsx`)

Thêm links từ SEO content sections trên trang Tools trỏ về các blog posts liên quan. Ví dụ: section "Round Robin" link tới blog "pickleball-round-robin-generator".

### 4. Cập nhật sitemap (file: `public/sitemap.xml`)

Thêm URLs cho 4 blog posts mới.

---

## Tóm tắt files thay đổi

| File | Thay đổi |
|---|---|
| `src/lib/blog-data.ts` | Thêm 4 blog posts mới |
| `src/pages/BlogPost.tsx` | Thêm Related Posts section |
| `src/components/seo/ToolsSeoContent.tsx` | Thêm internal links tới blog |
| `public/sitemap.xml` | Thêm 4 URLs mới |

