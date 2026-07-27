import { describe, it, expect, vi } from "vitest";

// The module reaches the Supabase client at import time for its auth header;
// that needs env this node test environment does not have. Same shim the other
// hook tests use (see useFeaturedParentTournaments.test.ts).
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
}));

import { VI_SLUG_PATTERN } from "../useViBlogPosts";

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
