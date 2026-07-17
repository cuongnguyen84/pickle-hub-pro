/**
 * SSR render handlers — organization pages.
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import {
  buildTitle,
  buildMetaDescription,
  absImage,
  singleCanonicalHreflang,
  buildBreadcrumbJsonLd,
} from "../utils";
import { render404 } from "./static-pages";

// ─── Organization ──────────────────────���──────────────────

export async function renderOrgDetail(supabase: SupabaseClient, slug: string, siteUrl: string): Promise<Response> {
  const { data: org } = await supabase.from("organizations").select("id, name, description, slug, logo_url").eq("slug", slug).single();

  if (!org) return render404(`/org/${slug}`, siteUrl);

  const title = buildTitle(org.name, " | Pickleball Creator");
  const desc = buildMetaDescription(org.description, { type: "default", title: org.name });

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
