import type { BlogPost, BlogPostMetadata } from "./types";
import { blogMetadata } from "./metadata";

/**
 * Dynamic imports — each blog post lives in its own chunk.
 * Vite's import.meta.glob produces a module map where each key
 * is a path and each value is a Promise-returning loader.
 *
 * Pages load a single post asynchronously via getBlogPost(slug).
 * This drops the bundle size for list pages (which used to pull
 * all posts' content via the static blogPosts array).
 */
const postLoaders = import.meta.glob<{ default: BlogPost }>(
  "./posts/*.ts"
);

/** Build a slug → loader map once at module init. */
const loaderBySlug: Record<string, () => Promise<{ default: BlogPost }>> = {};
for (const [path, loader] of Object.entries(postLoaders)) {
  // path = "./posts/<slug>.ts"
  const match = path.match(/\/posts\/(.+)\.ts$/);
  if (match) loaderBySlug[match[1]] = loader;
}

/**
 * Load a single blog post by slug. Returns undefined if not found.
 * Caller should handle the Promise in a useEffect / Suspense boundary.
 */
export async function getBlogPost(slug: string): Promise<BlogPost | undefined> {
  const loader = loaderBySlug[slug];
  if (!loader) return undefined;
  try {
    const mod = await loader();
    return mod.default;
  } catch (err) {
    console.error(`[blog] Failed to load post "${slug}"`, err);
    return undefined;
  }
}

/**
 * Find related posts by shared tag count — operates on lightweight
 * metadata so no post content is loaded.
 */
export function getRelatedPosts(
  currentSlug: string,
  limit: number = 3
): BlogPostMetadata[] {
  const current = blogMetadata.find((p) => p.slug === currentSlug);
  if (!current) return [];

  const currentTags = new Set(current.tags);
  return blogMetadata
    .filter((p) => p.slug !== currentSlug)
    .map((p) => ({
      post: p,
      shared: p.tags.filter((t) => currentTags.has(t)).length,
    }))
    .sort((a, b) => b.shared - a.shared)
    .slice(0, limit)
    .map((item) => item.post);
}

export { blogMetadata } from "./metadata";
export type { BlogPost, BlogPostMetadata, BlogSection, BlogPostContent } from "./types";
