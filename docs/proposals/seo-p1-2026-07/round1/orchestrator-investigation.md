# round1 / orchestrator-investigation — thay cho panel không chạy được

**Ai làm:** orchestrator (Claude Code, chính là con viết `proposal.md`) — **KHÔNG độc lập**.
**Vì sao:** `solution-architect` + `risk-auditor` chết 3 lần liên tiếp vì API 529 Overloaded.
Cuong chọn phương án A (orchestrator tự điều tra) lúc 2026-07-26.
**Ngày:** 2026-07-26 · repo HEAD `4708b2ea`

Dưới đây là **output lệnh thô**, chép nguyên văn, để Cuong kiểm lại kết luận trong `proposal.md`.

---

## 1. Logo asset — file thật

```
$ file public/android-chrome-512x512.png public/og-image.png
public/android-chrome-512x512.png: PNG image data, 512 x 512, 8-bit/color RGBA, non-interlaced
public/og-image.png:               JPEG image data, JFIF standard 1.01, ... 1024x1024, components 3

$ ls -l
-rw-r--r--  13917  public/android-chrome-512x512.png
-rw-r--r--  40238  public/og-image.png
```

→ `og-image.png` **đã vuông 1024×1024**, không phải 1200×630 như work order nói.
→ `android-chrome-512x512.png` là PNG RGBA 512×512, 13.9 KB.

## 2. Logo serve trên prod

```
$ curl -sI https://www.thepicklehub.net/android-chrome-512x512.png
HTTP/2 200
content-type: image/png
content-length: 13917
cache-control: public, max-age=14400, must-revalidate
```

## 3. robots.txt — có chặn ảnh không

```
User-agent: *
Content-Signal: search=yes,ai-train=no,use=reference
Allow: /
```
→ Không chặn. (Có `Disallow: /` riêng cho Amazonbot / Applebot-Extended / Bytespider — không phải Googlebot.)

`public/_headers` không có rule nào cho `*.png` ngoài `/assets/*` (immutable) — file ở root không dính.

## 4. ⚠️ APP STORE URLs — phát hiện quan trọng nhất

```
$ curl -sL -o /dev/null -w '%{http_code}' <url>

200   https://apps.apple.com/app/id6759968026
200   https://apps.apple.com/vn/app/id6759968026
404   https://play.google.com/store/apps/details?id=net.thepicklehub.app
```

Thử lại Play Store nhiều locale và nhiều app-id:

```
404  ...?id=net.thepicklehub.app&hl=vi&gl=VN
404  ...?id=net.thepicklehub.app&hl=en_US&gl=US
404  ...?id=net.thepicklehub.app&hl=en
404  id=com.thepicklehub.app
404  id=net.thepicklehub
```

Xác nhận đúng app iOS:
```
<title>‎ThePickleHub: Tournaments App - App Store</title>
"name":"ThePickleHub: Tournaments"
"name":"NGUYEN THE CUONG"
```

Play Store search "ThePickleHub" → không trả về listing nào cho `net.thepicklehub.*`.

**Kết luận: app Android CHƯA publish công khai.** Work order bảo thêm URL này vào `sameAs`
= nhét URL 404 vào brand entity. → D1 trong proposal.

Liên đới: `index.html:49` `<meta name="google-play-app" content="app-id=net.thepicklehub.app" />`
cũng trỏ vào app không tồn tại. → D2.

## 5. JSON-LD được sinh thế nào (rủi ro "JSON hỏng" = SAI)

```
functions/_lib/html.ts:161
  ? `<script type="application/ld+json">${escapeJsonLd(JSON.stringify(jsonLd))}</script>`

functions/_lib/utils.ts:12-18
  export function escapeJsonLd(str: string): string {
    if (!str) return "";
    return str.replace(/&/g,"\\u0026").replace(/</g,"\\u003c").replace(/>/g,"\\u003e");
  }
```

`jsonLd` ở `home.ts:43-85` (EN) và `:141-179` (VI) là **object TypeScript**, không phải chuỗi
viết tay. `tsc` bắt lỗi cú pháp trước khi build. → Rủi ro "sửa tay làm hỏng JSON, Google bỏ cả
schema trang chủ" **không xảy ra được** ở codebase này.

## 6. Cache prerender

```
functions/_middleware.ts:462   const cacheKey = `pr:v32:${url.pathname}`;
functions/_middleware.ts:463   const noCache = url.searchParams.get("nocache") === "1";
functions/_middleware.ts:510   const ttl = pathCacheTtl(url.pathname);
functions/_middleware.ts:499   // 6h TTL (was 1h) ... PR73 Phase 2B — pathCacheTtl returns 5 minutes
                               //    for /social + /clubs
functions/_middleware.ts:497   if (env.PRERENDER_CACHE && response.status === 200) { ... }
```

Comment `:458-461` vẫn ghi "Current: v29" trong khi code là v32 — **comment stale**.
`docs/prerender-cache-log.md` dừng ở v29→v30; v30→v31→v32 chưa được append. *(Nợ nhỏ, không
thuộc phạm vi PR này, nhưng đáng ghi.)*

Cold render có gọi Supabase: `home.ts:119-123` query 3 bảng (`public_livestreams`, `videos`,
`vi_blog_posts`) qua `Promise.all`, có `RENDER_BUDGET_MS` timeout (`:493`).
→ Bump cache key = mọi route cold cùng lúc = mọi route gọi Supabase cùng lúc.

## 7. `CANONICAL_HOST`

```
functions/_middleware.ts:440   const siteUrl = env.CANONICAL_HOST || "https://www.thepicklehub.net";
```
Pattern y hệt ở 13 file khác: `robots.txt.ts:10`, `rss.xml.ts:109`, và toàn bộ `sitemap-*.ts`.
→ Dùng `${siteUrl}` cho logo là **nhất quán với repo**. Hardcode www sẽ là ngoại lệ duy nhất.
Giá trị prod thật của biến này **không verify được từ repo** (không có `wrangler.toml` gốc;
nhiều khả năng là env var trên Pages dashboard).

## 8. Phạm vi logo — blog.ts / news.ts

```
functions/_lib/render/blog.ts:88-92    publisher: { "@type":"Organization", name, url, logo: {ImageObject, DEFAULT_OG_IMAGE} }
functions/_lib/render/blog.ts:188      publisher: { "@type":"Organization", name, logo: {ImageObject, DEFAULT_OG_IMAGE} }   // VI
functions/_lib/render/news.ts:145-149  publisher: { "@type":"Organization", name, url, logo: {ImageObject, DEFAULT_OG_IMAGE} }
```

**Không khối nào có `@id`.** Brand entity thật là `home.ts:48` `@id: ${siteUrl}#org`, được
`WebSite` tham chiếu ở `:74` `publisher: { "@id": ... }`. blog/news là Organization **ẩn danh**,
Google không nối vào entity đó. → Đổi logo ở blog/news **không cộng vào tín hiệu brand**.

## 9. Task 2 — tầng nào honor redirect (ĐÁP ÁN)

```
functions/_middleware.ts:213-215
  // ─── 1. Apex → www redirect ───────────────────────────
  if (url.hostname === "thepicklehub.net") {
    return secureRedirect(`https://www.thepicklehub.net${url.pathname}${url.search}`, 301);
  }

functions/_middleware.ts:1b (comment)
  // public/_redirects already has this rule but CF Pages middleware
  // runs BEFORE _redirects is consulted, so bots hitting /u/<slug>
  // were getting renderDefault's generic shell at status 200
```

→ **`functions/_middleware.ts` là tầng honor.** Chạy trước `_redirects`. Apex→www cũng ở đây,
**không phải Cloudflare Redirect Rules** như work order §3.1 giả định.
→ Task 3 (nếu làm) đặt 301 ở `_middleware.ts`, mirror vào `_redirects`, thêm case vào
`src/__tests__/redirect-parity.test.ts`.

## 10. Yêu cầu của Google cho Organization.logo

Nguồn: <https://developers.google.com/search/docs/appearance/structured-data/logo> (fetch 2026-07-26)

- "The image must be **112x112px, at minimum**."
- "The image file format must be supported by Google Images."
- "The image URL must be **crawlable and indexable**."
- "Make sure the image looks how you intend it to look **on a purely white background**."
- **Không có yêu cầu nào về tỉ lệ khung hình.** Doc không nhắc landscape/square.
  (Yêu cầu 600×60 mà nhiều người nhớ là của **AMP publisher logo** — site này không dùng AMP.)

→ `android-chrome-512x512.png` hợp lệ. Điều duy nhất chưa kiểm được bằng máy: nó trông thế nào
trên nền trắng (file có alpha channel).

## 11. Chưa xác minh được

- Đổi `logo` của entity đang có thứ hạng brand ổn định **có làm Google đánh giá lại
  knowledge-panel signal không** — không tìm được tài liệu chính thức khẳng định hay phủ nhận.
  Ghi là **chưa biết**, không phải "rủi ro bằng 0".
- Giá trị thật của `CANONICAL_HOST` trên prod/preview.
