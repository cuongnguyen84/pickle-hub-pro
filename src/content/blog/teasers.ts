import { blogMetadata } from "./metadata";
import type { BlogPostMetadata } from "./types";
import { truncateExcerpt } from "./excerpt";

/**
 * Client-side view of blog metadata (DEBT-09). Cards, ticker, feed, author
 * page, related posts and the post-page hero preload read only these fields;
 * metaTitle*, ctaPath/ctaLabel and the full VI description feed SSR only.
 *
 * Derived from metadata.ts — never edit by hand. In the production build,
 * vite.config.ts (`precompute-blog-teasers`) evaluates this module at build
 * time and emits ONLY `blogTeasers` as a literal (keep it the sole runtime
 * export), so metadata.ts itself never reaches
 * a client chunk. vitest and Pages Functions run this file as written.
 */
export type BlogTeaser = Pick<
  BlogPostMetadata,
  | "slug"
  | "publishedDate"
  | "updatedDate"
  | "author"
  | "tags"
  | "heroImage"
  | "titleEn"
  | "titleVi"
  | "metaDescriptionEn"
> & {
  /** metaDescriptionVi cut to ticker length — the only client use of it. */
  excerptVi?: string;
};

export const blogTeasers: BlogTeaser[] = blogMetadata.map((m) => ({
  slug: m.slug,
  publishedDate: m.publishedDate,
  updatedDate: m.updatedDate,
  author: m.author,
  tags: m.tags,
  heroImage: m.heroImage,
  titleEn: m.titleEn,
  titleVi: m.titleVi,
  metaDescriptionEn: m.metaDescriptionEn,
  excerptVi: truncateExcerpt(m.metaDescriptionVi),
}));
