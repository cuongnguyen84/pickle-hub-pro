/**
 * SSR render handlers — organization pages.
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import {
  buildTitle,
  absImage,
  singleCanonicalHreflang,
  buildBreadcrumbJsonLd,
} from "../utils";
import { pickMetaDescription } from "../seo-helpers";
import { render404 } from "./static-pages";

// ─── Organization ──────────────────────���──────────────────

export async function renderOrgDetail(supabase: SupabaseClient, slug: string, siteUrl: string): Promise<Response> {
  const { data: org } = await supabase.from("organizations").select("id, name, description, slug, logo_url").eq("slug", slug).single();

  if (!org) return render404(`/org/${slug}`, siteUrl);

  const title = buildTitle(org.name, " | Pickleball Creator");
  // Audit 2026-10-21 — buildMetaDescription's "default" fallback made
  // every org without a 120+ char description ship the identical
  // platform boilerplate ("…là nền tảng pickleball hàng đầu Việt Nam…"),
  // differing only by name. Use an org-specific fallback via
  // pickMetaDescription (the renderClub pattern), and enrich a
  // short-but-real description instead of discarding it.
  const fallbackDesc =
    `${org.name} — creator pickleball trên ThePickleHub: video, livestream, ` +
    "hướng dẫn và tin tức pickleball Việt Nam & quốc tế.";
  const rawOrgDesc = (org.description ?? "").trim();
  const enrichedOrgDesc =
    rawOrgDesc && rawOrgDesc.length < 100
      ? `${rawOrgDesc} — video, livestream & nội dung pickleball trên ThePickleHub.`
      : rawOrgDesc;
  const desc = pickMetaDescription(enrichedOrgDesc || null, fallbackDesc);

  return htmlResponse(buildHtml({
    title,
    description: desc,
    url: `${siteUrl}/org/${org.slug}`,
    siteUrl,
    image: absImage(org.logo_url, siteUrl),
    extraMeta: singleCanonicalHreflang(`${siteUrl}/org/${org.slug}`, "en"),
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "Organization", name: org.name, url: `${siteUrl}/org/${org.slug}`, ...(org.logo_url ? { logo: absImage(org.logo_url, siteUrl) } : {}) },
        buildBreadcrumbJsonLd([
          { label: "Home", href: siteUrl },
          { label: org.name },
        ]),
      ],
    },
  }));
}
