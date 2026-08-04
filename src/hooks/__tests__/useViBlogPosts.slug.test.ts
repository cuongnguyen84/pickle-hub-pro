import { afterEach, describe, it, expect, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

// The module reaches the Supabase client at import time for its auth header;
// that needs env this node test environment does not have. Same shim the other
// hook tests use (see useFeaturedParentTournaments.test.ts).
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession } },
}));

import {
  fetchPublishedViBlogPostBySlug,
  preloadViBlogPostBySlug,
  VI_SLUG_PATTERN,
} from "../useViBlogPosts";

afterEach(() => {
  vi.unstubAllGlobals();
  getSession.mockReset();
});

// useViBlogPostBySlug interpolates the slug into a PostgREST `or=(...)` filter,
// where `,` and `()` are grammar. encodeURIComponent does NOT escape parens, so
// the guard has to be the character class — this locks it.
describe("VI_SLUG_PATTERN", () => {
  it("accepts the shape every real vi_blog_posts slug uses", () => {
    for (const slug of [
      "hcmc-open-2026",
      "thuat-ngu-pickleball",
      "singapore-open-2026-ket-qua",
      "cam-nang-xem-pickleball-world-cup-2026-da-nang",
    ]) {
      expect(VI_SLUG_PATTERN.test(slug)).toBe(true);
    }
  });

  it("rejects the characters that carry meaning in a PostgREST or= filter", () => {
    for (const bad of [
      "a)bad(x",
      "x,alternate_en_slug.eq.y",
      "slug.eq.x",
      "a*b",
      "a%b",
      'a"b',
      "a b",
    ]) {
      expect(VI_SLUG_PATTERN.test(bad)).toBe(false);
    }
  });

  it("rejects empty, uppercase and accented input", () => {
    for (const bad of ["", "HCMC-Open", "thuật-ngữ", "a/b", "../../etc"]) {
      expect(VI_SLUG_PATTERN.test(bad)).toBe(false);
    }
  });
});

describe("Vietnamese blog cold preload", () => {
  it("shares one public CMS request with the first React Query fetch", async () => {
    const post = { slug: "cold-deep-link", status: "published" };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [post],
    });
    vi.stubGlobal("fetch", fetchMock);

    preloadViBlogPostBySlug(post.slug);
    await expect(fetchPublishedViBlogPostBySlug(post.slug)).resolves.toEqual(post);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getSession).not.toHaveBeenCalled();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("status=eq.published");
    expect(url).toContain("limit=1");
    expect(init.headers.Authorization).toMatch(/^Bearer /);
  });

  it("does not preload a malformed PostgREST slug", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    preloadViBlogPostBySlug("x,alternate_en_slug.eq.secret");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });
});
