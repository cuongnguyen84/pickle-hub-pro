import { describe, it, expect, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));

import { publishedViBlogPostsQuery } from "../useViBlogPosts";

// The homepage caps its vi_blog_posts fetch (payload weight on slow links);
// the blog index keeps the full listing. The capped variant MUST order by
// updated_at: the homepage ranks by effective date max(published_at,
// updated_at) and intentionally resurfaces refreshed older posts, so a
// published_at-ordered cap would silently drop them from the homepage.
describe("publishedViBlogPostsQuery", () => {
  it("unlimited keeps the full listing contract (published_at order, no limit)", () => {
    const q = publishedViBlogPostsQuery();
    expect(q).toContain("status=eq.published");
    expect(q).toContain("order=published_at.desc");
    expect(q).not.toContain("limit=");
  });

  it("limited caps the window ordered by updated_at", () => {
    const q = publishedViBlogPostsQuery(30);
    expect(q).toContain("order=updated_at.desc");
    expect(q).toContain("limit=30");
    expect(q).toContain("status=eq.published");
  });

  it("both variants select the same light columns", () => {
    const cols = "select=id,slug,title,excerpt,cover_image_url,category,published_at,updated_at,tags";
    expect(publishedViBlogPostsQuery()).toContain(cols);
    expect(publishedViBlogPostsQuery(30)).toContain(cols);
  });
});
