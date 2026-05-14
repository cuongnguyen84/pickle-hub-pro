/**
 * Dynamic robots.txt as a Cloudflare Pages Function.
 */

interface Env {
  CANONICAL_HOST: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);

  const siteUrl = context.env.CANONICAL_HOST || "https://www.thepicklehub.net";

  const body = `User-agent: *
Allow: /

Disallow: /admin
Disallow: /admin/
Disallow: /creator
Disallow: /creator/
Disallow: /auth/
Disallow: /login
Disallow: /vi/login
Disallow: /account
Disallow: /vi/account
Disallow: /onboarding
Disallow: /notifications
Disallow: /vi/notifications
Disallow: /thong-bao
Disallow: /vi/thong-bao
Disallow: /embed/
Disallow: /matches/
Disallow: /join/

# Block indexing of user-generated tool sessions (they have noindex meta too)
Disallow: /tools/flex-tournament/
Disallow: /tools/doubles-elimination/
Disallow: /tools/quick-tables/
Disallow: /tools/team-match/

# Allow tool hub pages specifically
Allow: /tools$
Allow: /tools/flex-tournament$
Allow: /tools/doubles-elimination$
Allow: /tools/quick-tables$
Allow: /tools/team-match$

# PR72 (SEO Phase 2A I-7+I-14) — social-event private surfaces.
# Magic-link pages carry a UUID bearer token in the URL — must never
# be indexed. Same for organizer dashboards + create flows + per-event
# ephemeral surfaces (roster, matchmaking, live). Belt-and-braces with
# the X-Robots-Tag header that functions/_middleware.ts sets on the
# matching response, and the client-side useNoindex() hook in
# src/hooks/useNoindex.ts.
Disallow: /dang-ky/
Disallow: /vi/dang-ky/
Disallow: /khoi-phuc-dang-ky
Disallow: /vi/khoi-phuc-dang-ky
Disallow: /clubs/new
Disallow: /clb/*/quan-ly
Disallow: /clb/*/social/moi
Disallow: /clb/*/su-kien/moi
Disallow: /social/*/danh-sach
Disallow: /social/*/xep-cap
Disallow: /social/*/live
Disallow: /vi/social/*/live
Disallow: /su-kien/*/danh-sach
Disallow: /su-kien/*/xep-cap
Disallow: /su-kien/*/live
Disallow: /vi/su-kien/*/live

# AI training opt-out
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Google-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: anthropic-ai
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: PerplexityBot
Disallow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
