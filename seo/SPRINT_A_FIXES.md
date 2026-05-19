# Sprint A — Damage Control Fixes

**Date:** 2026-04-14
**Goal:** Fix tất cả critical SEO issues trong 24-48h
**Stack:** Claude Code (~/pickle-hub-pro repo) + GSC + Cloudflare

---

## Order of execution (5 steps)

| Step | Owner | Time | Status |
|---|---|---|---|
| 1. Upload disavow.txt to GSC | Cuong (UI) | 5' | ⬜ |
| 2. Request indexing 7 URL on GSC | **Claude (auto via Chrome)** | 10' | ⬜ |
| 3. Run Claude Code prompt: hreflang fix | Cuong → Claude Code | 30' | ⬜ |
| 4. Run Claude Code prompt: block share subdomain | Cuong → Claude Code | 20' | ⬜ |
| 5. Verify deploys | **Claude (auto via Chrome)** | 10' | ⬜ |

---

## Step 1 — Disavow 5 spam backlinks (Cuong, 5 min)

**File:** `seo/disavow.txt` (đã tạo)

**Steps:**
1. Mở https://search.google.com/search-console/disavow-links
2. Chọn property `sc-domain:thepicklehub.net`
3. Click "Disavow links"
4. Upload `seo/disavow.txt`
5. Confirm

**Effect:** 1-4 tuần Google ngưng tính 5 spam refdomain.

---

## Step 2 — Request indexing 7 URL (Claude tự làm qua Chrome)

Claude sẽ navigate GSC → URL Inspect → Request Indexing cho 7 URL:

**3 VI URLs (PRIORITY):**
- `https://www.thepicklehub.net/vi/blog`
- `https://www.thepicklehub.net/vi/blog/pickleball-la-gi`
- `https://www.thepicklehub.net/vi/blog/top-san-pickleball-ha-noi-2026`

**4 EN URLs:**
- `https://www.thepicklehub.net/blog/free-pickleball-bracket-generator`
- `https://www.thepicklehub.net/blog/how-to-create-pickleball-bracket`
- `https://www.thepicklehub.net/blog/pickleball-live-streaming-guide`
- `https://www.thepicklehub.net/blog/pickleball-round-robin-generator-guide`

**Limit:** GSC ~10 URL/day, đủ.

---

## Step 3 — Hreflang fix via Claude Code (30 min)

**Vấn đề:** 27/29 URL trong sitemap thiếu `<link rel="alternate" hreflang>`. VI/EN cannibalize nhau, indexing chậm.

**Cuong làm:**

```bash
cd ~/pickle-hub-pro
claude
```

**Paste prompt sau cho Claude Code:**

````
Add hreflang alternate links for bilingual SEO. Current state: only homepage has hreflang tags; all blog posts, tool pages, and section pages are missing them.

Task:
1. First explore the codebase to understand:
   - How meta tags are currently injected (likely react-helmet-async or a custom Helmet wrapper)
   - The blog post route component (probably src/pages/blog/[slug].tsx or src/pages/BlogPost.tsx)
   - The Vietnamese blog route component (likely src/pages/vi/blog/[slug].tsx)
   - How section pages (/tournaments, /watch, /tools, /blog) inject SEO
   - Whether there's a shared SEO/Helmet component or each page does it inline

2. Implement a reusable HreflangTags component (or extend existing SEO component) that outputs:

   <link rel="alternate" hreflang="en" href="https://www.thepicklehub.net{enPath}" />
   <link rel="alternate" hreflang="vi" href="https://www.thepicklehub.net/vi{viPath}" />
   <link rel="alternate" hreflang="x-default" href="https://www.thepicklehub.net{enPath}" />

   Props: { enPath: string, viPath?: string }
   - If viPath is undefined or VI version doesn't exist → only output `en` + `x-default` pointing to current page (no broken vi alternate)
   - Always use https://www.thepicklehub.net (with www)

3. Wire up:
   - Section pages (homepage, /tournaments, /watch, /blog, /tools, /news, /forum, /livestream, /videos): hardcoded path mapping (e.g., /tools ↔ /vi/tools)
   - Blog posts: lookup the alternate slug from a DB query or post.alternate_slug field
     - Query Supabase: SELECT alternate_slug FROM posts WHERE slug = $1 AND language = 'vi'
     - If post has alternate language version → output both hreflang
     - Else → only self + x-default
   - Tool pages: hardcoded mapping (currently EN-only; output en + x-default)

4. Update functions/sitemap.xml.ts to include xhtml:link hreflang tags for URLs with bilingual versions:

   <url>
     <loc>https://www.thepicklehub.net/blog/post-slug</loc>
     <xhtml:link rel="alternate" hreflang="en" href="https://www.thepicklehub.net/blog/post-slug" />
     <xhtml:link rel="alternate" hreflang="vi" href="https://www.thepicklehub.net/vi/blog/post-slug-vi" />
     <xhtml:link rel="alternate" hreflang="x-default" href="https://www.thepicklehub.net/blog/post-slug" />
   </url>

   Don't forget the namespace: xmlns:xhtml="http://www.w3.org/1999/xhtml"

5. Constraints:
   - Don't change existing canonical tags
   - Don't modify the legacy Cloudflare Worker `prerender-worker` (separate scope)
   - Don't change Supabase edge functions
   - Don't change og:* tags (separate task)
   - Use complete file rewrites for any Cloudflare Pages function or config file (per CLAUDE.md style)

6. After implementing, run:
   - npm run build
   - npx tsc --noEmit
   Both must pass.

7. Commit with message: "feat(seo): add hreflang tags to all bilingual pages and sitemap"

8. Push to a feature branch (not main):
   - git checkout -b feature/seo-hreflang-bilingual
   - git push -u origin feature/seo-hreflang-bilingual

9. Report back:
   - List of files changed
   - Sample of generated HTML for one EN blog post and one VI blog post
   - Sample of new sitemap output for one bilingual URL
   - Preview deployment URL on Cloudflare Pages

I will verify on the preview URL before merging to main.
````

**After Claude Code finishes, Cuong báo Claude (qua Cowork chat) "Sprint A.3 done — preview URL: ..." → Claude verify.**

---

## Step 4 — Deprecate share.thepicklehub.net (done)

**Vấn đề ban đầu:** `share.thepicklehub.net` serve preview URL livestream. Khi stream end → 404. Google đang index → kill crawl budget.

**Resolution (2026-04-14):** Subdomain deprecated. All share links updated to `www.thepicklehub.net` with correct paths. Share subdomain guards removed from Cloudflare functions.

**Cuong làm:**

```bash
cd ~/pickle-hub-pro
claude
```

**Paste prompt sau cho Claude Code:**

````
Block search engines from indexing the share.thepicklehub.net subdomain.

Context:
- share.thepicklehub.net serves preview/share URLs for livestreams (e.g. /live/<uuid>)
- These URLs 404 when streams end → Google has discovered them and they appear in GSC as "Not Found (404)"
- These URLs are NOT meant to be indexed
- 2 specific URLs flagged (now redirected to www):
  - https://share.thepicklehub.net/live/afc2506b-e81f-... (legacy)
  - https://share.thepicklehub.net/live/06a19788-f9d0-4d49-... (legacy)

Task:
1. First investigate the codebase to understand:
   - What serves share.thepicklehub.net? (Cloudflare Worker? Cloudflare Pages with a separate route? Supabase function?)
   - Check Cloudflare Pages config (functions/), Cloudflare Worker (prerender-worker if relevant), DNS routing
   - Look for any code referencing 'share.thepicklehub.net' or '/live/' URL pattern

2. Choose ONE of these implementations based on what's actually serving the subdomain:

   Option A — If served by Cloudflare Pages middleware (functions/_middleware.ts):
   - Add a check: if hostname === 'share.thepicklehub.net', set X-Robots-Tag: 'noindex, nofollow' header on response
   - Also add a fallback /robots.txt route that returns "User-agent: *\nDisallow: /" for share subdomain

   Option B — If served by a separate Cloudflare Worker:
   - Tell me the worker name and code location, I'll add the noindex header there manually
   - DO NOT modify prerender-worker (per CLAUDE.md, must preserve)

   Option C — If served by Supabase function:
   - Set X-Robots-Tag: 'noindex, nofollow' in response headers of that function

3. Make sure:
   - The block applies to ALL paths on share.thepicklehub.net
   - The main www.thepicklehub.net is NOT affected
   - Implementation works for both bot crawlers (via header) and user navigation

4. Constraints:
   - Don't break existing share functionality (URLs must still load for users with the link)
   - Don't disable prerender-worker (per CLAUDE.md)
   - Use complete file rewrites for config files
   - Per CLAUDE.md, this is technical SEO scope — should be in Cloudflare Pages functions, not Supabase

5. After implementing:
   - npm run build (if applicable)
   - Test locally if possible

6. Commit + push to feature branch:
   - git checkout -b feature/seo-block-share-subdomain
   - git push -u origin feature/seo-block-share-subdomain

7. Report back:
   - Which option you implemented (A/B/C) and why
   - Files changed
   - How to verify (which curl commands hit which URL)
   - Preview deployment URL

I will verify share.thepicklehub.net/robots.txt + curl headers on share URL after deploy.
````

**After Claude Code finishes, Cuong báo Claude → Claude verify.**

---

## Step 5 — Verification (Claude tự làm qua Chrome)

Sau khi Cuong báo Step 3 + Step 4 deployed (preview hoặc main), Claude sẽ:

1. Navigate Chrome đến preview URL → check hreflang trên 3 page (homepage, EN blog, VI blog)
2. Navigate Chrome đến `https://share.thepicklehub.net/robots.txt` → verify Disallow
3. Check response headers `share.thepicklehub.net/live/...` qua DevTools
4. Submit verification report cho Cuong → trước khi merge to main

---

## Sau khi Sprint A merge to main

Claude sẽ tự:
- Tạo Sprint A summary report
- Bắt đầu Sprint B (4 tool pages differentiation + KD=2 quick win + 2 VI posts)

---

## Files trong workspace

- `seo/disavow.txt` — Upload lên GSC
- `seo/SPRINT_A_FIXES.md` — File này (full guide)
