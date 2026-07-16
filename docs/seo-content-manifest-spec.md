# Single Content Manifest — Spec (SEO-01)

> Spec only; SEO-02 implements. Goal: one source of truth generates every
> SEO surface, collapsing the blog pipeline's 5 manual touch points to ≤3
> and making the HOT-03 failure class (slug present in one surface, missing
> from another) structurally impossible.

## Problem

A new blog post today touches 5 places that must agree (CLAUDE.md
checklist): post module, `metadata.ts`, `BLOG_POST_META` (SSR truth table,
`functions/_lib/render/index.ts`), Supabase `vi_blog_posts`, and
`EN_BLOG_SLUGS` (`functions/_lib/static-blog-slugs.ts`). HOT-03 happened
because #5 was skipped; SEO-03 will add the CI check, but generation is the
real fix.

## Manifest shape

One TypeScript module, checked in, imported by BOTH the SPA and Pages
Functions (they already share a build graph via `functions/_lib`):

```ts
// src/content/manifest.ts
export interface ContentEntry {
  slug: string;                  // EN slug (canonical)
  viSlug?: string;               // VI slug when the VI page is static-routed
  kind: "blog" | "static";
  title: { en: string; vi: string };
  description: { en: string; vi: string };
  ogImage: string;               // absolute or /public path
  datePublished: string;         // ISO
  dateModified?: string;         // ISO — sitemap <lastmod> + Article schema
  noindex?: boolean;
}
export const CONTENT_MANIFEST: ContentEntry[] = [ ... ];
```

VI blog HTML stays in Supabase `vi_blog_posts` (content), but its ROUTING +
hreflang existence comes from `viSlug` here — the DB row stops being a
routing dependency.

## Surfaces generated from it (SEO-02)

| Surface | Today | After |
|---|---|---|
| `BLOG_POST_META` SSR dict | hand-edited dict | derived at module load from manifest |
| `EN_BLOG_SLUGS` → sitemap-static | hand-edited array | derived |
| React blog `metadata.ts` | hand-edited array | thin re-export of manifest (or derived) |
| hreflang pairs (en/vi/x-default) | per-handler logic | one helper reading `slug`/`viSlug` |
| RSS + OG tags | per-handler | derived |

Touch points after: (1) post content module, (2) manifest entry,
(3) `vi_blog_posts` INSERT for VI content. ≤3 ✅

## Constraints

- Zero extra KV/network reads in the middleware — the manifest compiles
  into the Functions bundle exactly like `BLOG_POST_META` does today.
- Prerender cache version (`pr:vNN`) must bump in the same PR that changes
  generated SSR output.
- SEO-03 adds the fixture test: every `metadata.ts`/manifest slug appears in
  the rendered sitemap + SSR dict; CI fails on divergence.
- Migration is mechanical: script converts the current dict + arrays into
  manifest entries; diff of generated output vs live surfaces must be empty
  before the swap merges.
