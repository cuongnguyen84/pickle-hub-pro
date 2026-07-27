# round1 / idea-recon — SEO P1 Task 1+2

**Agent:** `idea-recon` (Claude, read-only)
**Chạy:** 2026-07-26, repo HEAD `4708b2ea`, branch `feat/otp-delivery-failure-alert`
**Output dưới đây là NGUYÊN VĂN từ agent.**

---

## Prior art

**Task 2 is already ~95% built and verified live.** The 2025→2026 redirect exists in 3 places and fires correctly on prod right now.

- `public/_redirects:20` — `/blog/best-pickleball-tournament-software-2025  /blog/best-pickleball-tournament-software-2026  301`
- `functions/_middleware.ts:315-317` — `BLOG_MERGED` dict mirrors the same rule for bots (comment at :312-314 explicitly says this exact slug 404'd for bots until this mirror was added), applied at `:346-350`
- `src/__tests__/redirect-parity.test.ts:139-164` — dedicated suite asserting `_redirects` EN-blog rules ⊆ `BLOG_MERGED` and vice versa, specifically covers this slug
- Introduced by commit `707f3ed5` (Apr 15, "2025→2026 redirect"), middleware-mirror + parity test added later in `af753abc` ("redirect+hreflang parity gates")

**Task 1 is NOT built** — logo is still the wide OG image, `sameAs` has no app-store URLs. Confirmed both in source and live prod curl (below).

## Touch surface (likely)

- `functions/_lib/render/home.ts:47-68` (EN Organization block) and `:145-164` (VI Organization block) — NOT `functions/_lib/render/index.ts` as the task brief says; that file is a pure re-export barrel (11-51, no JSON-LD). Repo wins: real edit site is `home.ts`.
- `functions/_lib/utils.ts:6` — `DEFAULT_OG_IMAGE = "https://www.thepicklehub.net/og-image.png"` (used at `home.ts:56,152`)
- `public/og-image.png` — actually 1024×1024 JPEG (`file` output), not 1200×630 as intake doc assumed
- `public/android-chrome-512x512.png` — exists, 13.9KB
- `functions/_middleware.ts:462` — cache key `pr:v32:${pathname}`; changing SSR JSON-LD output requires bumping to `v33`

## Data

No Supabase tables/RPCs involved — this Organization block is static string data in `home.ts`, no DB query. `siteUrl` = `env.CANONICAL_HOST || "https://www.thepicklehub.net"` (`_middleware.ts:440`); `CANONICAL_HOST` override value not in-repo (no root `wrangler.toml`; likely a Pages dashboard env var) — **not verifiable from repo alone whether it's ever non-default in prod.**

Other Organization/publisher JSON-LD instances exist and are **out of scope but co-located conceptually**: `functions/_lib/render/blog.ts:88-92,187-188` and `news.ts:145-149` both emit their own `logo: DEFAULT_OG_IMAGE` publisher blocks (not `@id`-linked to the brand entity in `home.ts`). Task says "2 blocks" and these are not among them — editing only `home.ts` leaves blog/news publisher logo unchanged.

## Binding constraints found

- CLAUDE.md §SEO Prerender — cache key `pr:v30:${pathname}` (repo has since bumped to **v32**; doc is stale) — bump on SSR output change.
- `docs/proposals/seo-p1-2026-07/00-intake.md:39` — "www only. KHÔNG đụng DNS." Not relevant here (no DNS touch).
- `docs/proposals/seo-p1-2026-07/00-intake.md:40` — DoD: `tsc --noEmit` + eslint pass, Googlebot curl = 200 + hreflang clean, no orphan 404.

## Test coverage today

- `src/__tests__/redirect-parity.test.ts` — covers `_redirects` ↔ `_middleware.ts` sync for VI-blog and EN-merged-blog rules; this exact slug is covered.
- `tests/seo.spec.ts:367` — only a comment referencing Organization/WebSite JSON-LD existing, no assertion on `logo` or `sameAs` content. **No test asserts Organization schema fields** — gap for Task 1.

## Unknowns worth asking Cuong

1. Task 1 brief says edit 2 blocks in `functions/_lib/render/index.ts` — actual file is `home.ts`. Confirm scope is home EN+VI only, not also `blog.ts`/`news.ts` publisher.logo (those use the same `DEFAULT_OG_IMAGE` but aren't `@id`-linked).
2. Task 2 deliverable ("xác định tầng nào honor redirect") — prod curl confirms `_middleware.ts` fires it (both plain UA and Googlebot UA get 301→200 correctly); is there still an open question here, or is this just "write it up"?

## Verified prod output (curl, 2026-07-26)

```
curl -sI https://thepicklehub.net/.../software-2025   → 301 → https://www.thepicklehub.net/.../software-2025
curl -sI https://www.thepicklehub.net/.../software-2025 → 301 → https://www.thepicklehub.net/.../software-2026
curl (Googlebot UA) same path → 301 (bot path confirmed, not just human)
final /.../software-2026 → 200
Googlebot homepage grep '"logo"' → "https://www.thepicklehub.net/og-image.png"
Googlebot homepage grep '"sameAs"' → ["facebook.com/ThePickleHub","instagram.com/thepicklehub","youtube.com/@thepicklehub"]  (no app-store URLs)
```

---

## Ghi chú orchestrator (KHÔNG phải output agent)

Recon sửa 3 giả định trong brief + intake:

| Brief/intake nói | Recon xác minh |
|---|---|
| Organization JSON-LD ở `functions/_lib/render/index.ts` (~L78, ~L176) | Thật ra ở `functions/_lib/render/home.ts:47-68` (EN) + `:145-164` (VI). `index.ts` là barrel re-export. |
| `og-image.png` là 1200×630 (không vuông) | Thật ra **1024×1024 JPEG — ĐÃ VUÔNG**. Lý do "không vuông" trong brief là SAI. |
| Cache key `pr:v30` (CLAUDE.md) | Thực tế `pr:v32` (`_middleware.ts:462`). CLAUDE.md stale. |

→ **Task 2 = ĐÃ XONG từ trước**, verify sạch trên prod. Theo /idea Bước 2, dừng phân tích Task 2.
→ Task 1 còn thật, nhưng luận cứ "logo không vuông" đã sụp; lý do còn lại để đổi logo là
  512×512 PNG trong suốt là asset brand đúng chuẩn hơn 1024×1024 JPEG OG có chữ.
  Phần `sameAs` app-store vẫn nguyên giá trị.
