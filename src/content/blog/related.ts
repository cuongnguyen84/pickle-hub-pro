import { blogMetadata } from './metadata';

const GENERIC_TAGS = new Set(['pickleball', '2026', 'guide', 'vietnam', 'pickleball vietnam']);
const terms = (slug: string) => new Set(slug.split('-').filter((term) => term.length > 2 && !['2026', 'pickleball', 'guide', 'the', 'how'].includes(term)));

/** Shared by the client and edge renderer; only suggest genuinely related posts. */
export function getRelatedPosts(currentSlug: string, limit = 3) {
  const current = blogMetadata.find((p) => p.slug === currentSlug);
  if (!current || limit <= 0) return [];
  const tags = new Set(current.tags.map((tag) => tag.toLowerCase()).filter((tag) => !GENERIC_TAGS.has(tag)));
  const keywords = terms(currentSlug);
  return blogMetadata.filter((p) => p.slug !== currentSlug)
    .map((post) => ({ post, score: post.tags.filter((tag) => tags.has(tag.toLowerCase())).length * 3
      + [...terms(post.slug)].filter((term) => keywords.has(term)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.post.updatedDate.localeCompare(a.post.updatedDate) || a.post.slug.localeCompare(b.post.slug))
    .slice(0, limit).map(({ post }) => post);
}
