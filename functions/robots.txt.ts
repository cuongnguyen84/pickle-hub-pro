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
Disallow: /auth/
Disallow: /login
Disallow: /account
Disallow: /notifications
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
