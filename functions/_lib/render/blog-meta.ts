// ============================================================================
// BLOG_POST_META — SSR truth table for EN blog posts.
// SEO-02 (2026-07-17): GENERATED at module load from the single source
// src/content/blog/metadata.ts — do not hand-edit entries here. A new blog
// post only needs (1) the post content module, (2) its metadata.ts entry,
// (3) the vi_blog_posts INSERT. Missing metadata entry = Googlebot/Bingbot
// get 404 for that slug.
//
// Field mapping (Cuong's call 2026-07-17):
//   title        <- metaTitleEn      (the SEO-optimized short title)
//   description  <- metaDescriptionEn
//   datePublished<- publishedDate
//   dateModified <- updatedDate, only when it differs from publishedDate
//                   (renderer falls back to datePublished otherwise)
//   image        <- heroImage.src    (renderer falls back to DEFAULT_OG_IMAGE)
// ============================================================================

import { blogMetadata } from "../../../src/content/blog/metadata";

export const BLOG_POST_META: Record<string, {
  title: string;
  description: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
}> = Object.fromEntries(
  blogMetadata.map((p) => [
    p.slug,
    {
      title: p.metaTitleEn,
      description: p.metaDescriptionEn,
      datePublished: p.publishedDate,
      dateModified:
        p.updatedDate && p.updatedDate !== p.publishedDate ? p.updatedDate : undefined,
      image: p.heroImage?.src || undefined,
    },
  ]),
);
