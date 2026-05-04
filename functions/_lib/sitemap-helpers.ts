/**
 * Shared sitemap helpers for the family of /sitemap*.xml CF Pages Functions.
 *
 * Phase 3B.3 split the monolithic /sitemap.xml into a sitemap-index +
 * 6 segment sitemaps (static, blog, tournaments, matches, players, venues)
 * to stay under Google's 50k URL / 50 MB cap as the social layer
 * fills the matches + players + venues tables.
 */

export const SITE_URL_DEFAULT = "https://www.thepicklehub.net";

export const SITEMAP_CACHE_HEADERS: Record<string, string> = {
  "Content-Type": "application/xml; charset=utf-8",
  "Cache-Control": "public, max-age=300, s-maxage=300",
};

/** XML attribute / text escape — same rules used by both sitemap and prerender. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface UrlEntry {
  loc: string;
  lastmod?: string;
  changefreq: string;
  priority: string;
  hreflang?: { lang: string; href: string }[];
}

export function buildUrlEntry(entry: UrlEntry): string {
  const parts = [`  <url>`, `    <loc>${escapeXml(entry.loc)}</loc>`];
  if (entry.lastmod) parts.push(`    <lastmod>${entry.lastmod}</lastmod>`);
  parts.push(`    <changefreq>${entry.changefreq}</changefreq>`);
  parts.push(`    <priority>${entry.priority}</priority>`);
  if (entry.hreflang) {
    for (const h of entry.hreflang) {
      parts.push(
        `    <xhtml:link rel="alternate" hreflang="${h.lang}" href="${escapeXml(h.href)}"/>`,
      );
    }
  }
  parts.push(`  </url>`);
  return parts.join("\n");
}

/** Wrap a list of <url> blocks in a complete <urlset> document. */
export function wrapUrlset(entries: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entries.join("\n")}
</urlset>`;
}

/** Wrap a list of <sitemap> blocks in a sitemap-index document. */
export function wrapSitemapIndex(siteUrl: string, segmentPaths: string[], today: string): string {
  const segments = segmentPaths
    .map(
      (p) =>
        `  <sitemap>\n    <loc>${escapeXml(`${siteUrl}${p}`)}</loc>\n    <lastmod>${today}</lastmod>\n  </sitemap>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${segments}
</sitemapindex>`;
}

/** Today as YYYY-MM-DD (UTC). Used as default lastmod for static entries. */
export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Coerce a Postgres timestamp string to a YYYY-MM-DD lastmod. */
export function toLastmod(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString().slice(0, 10);
}

/** Slug allowlist — guards against slugs with spaces or special chars that
 *  break Search Console validation. Used by tournaments + matches + venues. */
export const URL_SAFE_SLUG_RE = /^[a-z0-9-]+$/;

/** Username allowlist for profile URLs (alphanumeric + underscore + dot). */
export const URL_SAFE_USERNAME_RE = /^[a-z0-9._-]+$/i;
