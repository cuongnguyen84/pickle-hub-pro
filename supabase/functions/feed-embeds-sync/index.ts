// ============================================================================
// feed-embeds-sync — auto-ingest new reels from curated Instagram accounts
// ----------------------------------------------------------------------------
// For each active row in feed_embed_sources, reads the account's recent
// media via the OFFICIAL Instagram Graph API business_discovery edge and
// inserts new video posts into feed_embeds (deduped on shortcode). The
// /feed card renders IG's own /embed/ iframe — nothing is downloaded or
// re-hosted (copyright + IG ToS safe by design).
//
// Requirements (one-time setup, see /admin/embeds notes):
//   - IG_ACCESS_TOKEN — long-lived token of a Facebook app with
//     instagram_basic + business_discovery access, linked to an IG
//     Business/Creator account
//   - IG_USER_ID — the IG Business account id that "hosts" the queries
//   Target accounts must be Business/Creator (true for media accounts);
//   personal accounts return error #110 and are recorded in last_error.
//
// Triggers:
//   - POST /                    — manual run (service_role Bearer or
//                                 SCRAPER_AUTH_SECRET x-auth-secret header)
//   - pg_cron via pg_net hourly — migration 20260704110000
//
// Error policy: per-source try/catch — one broken username never kills the
// run. Failures land in feed_embed_sources.last_error for the admin UI.
// ============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GRAPH_VERSION = "v21.0";
// Recent posts per account per run. Hourly cron + active accounts posting
// a few times a day → 15 is plenty of overlap to never miss one.
const MEDIA_LIMIT = 15;
const CAPTION_MAX = 220;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-auth-secret",
};

interface SourceRow {
  id: string;
  username: string;
  auto_publish: boolean;
}

interface IgMedia {
  permalink?: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  timestamp?: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function shortcodeFromPermalink(url: string): string | null {
  const m = url.match(/instagram\.com\/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ name: "feed-embeds-sync", status: "ok" });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Auth: service_role Bearer OR shared scraper secret (pg_cron path).
  const auth = req.headers.get("authorization") ?? "";
  const sharedSecret = req.headers.get("x-auth-secret") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const scraperSecret = Deno.env.get("SCRAPER_AUTH_SECRET") ?? "";
  const authed =
    (serviceRole && auth === `Bearer ${serviceRole}`) ||
    (scraperSecret && sharedSecret === scraperSecret);
  if (!authed) return json({ error: "Unauthorized" }, 401);

  const igToken = Deno.env.get("IG_ACCESS_TOKEN") ?? "";
  const igUserId = Deno.env.get("IG_USER_ID") ?? "";
  if (!igToken || !igUserId) {
    return json(
      {
        error:
          "IG_ACCESS_TOKEN / IG_USER_ID secrets not set — create a Facebook app with business_discovery access and run: supabase secrets set IG_ACCESS_TOKEN=... IG_USER_ID=...",
      },
      500,
    );
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRole);

  const { data: sources, error: srcError } = await supabase
    .from("feed_embed_sources")
    .select("id, username, auto_publish")
    .eq("active", true);
  if (srcError) return json({ error: srcError.message }, 500);

  const results: Array<{
    username: string;
    found: number;
    inserted: number;
    error?: string;
  }> = [];

  for (const source of (sources ?? []) as SourceRow[]) {
    try {
      const fields =
        `business_discovery.username(${source.username})` +
        `{media.limit(${MEDIA_LIMIT}){permalink,caption,media_type,media_product_type,timestamp}}`;
      const url =
        `https://graph.facebook.com/${GRAPH_VERSION}/${igUserId}` +
        `?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(igToken)}`;

      const res = await fetch(url);
      const body = await res.json();
      if (!res.ok || body.error) {
        throw new Error(body.error?.message ?? `HTTP ${res.status}`);
      }

      const media: IgMedia[] = body.business_discovery?.media?.data ?? [];
      const videos = media.filter(
        (m) =>
          m.permalink &&
          (m.media_type === "VIDEO" || m.media_product_type === "REELS"),
      );

      let inserted = 0;
      for (const m of videos) {
        const shortcode = shortcodeFromPermalink(m.permalink!);
        if (!shortcode) continue;
        const caption =
          (m.caption ?? "").split("\n")[0].slice(0, CAPTION_MAX).trim() || null;
        // upsert+ignoreDuplicates on the shortcode partial unique index =
        // insert only if this reel wasn't ingested (or hand-pasted) before.
        const { error, data } = await supabase
          .from("feed_embeds")
          .upsert(
            {
              url: m.permalink!,
              shortcode,
              caption,
              author_name: source.username,
              source_username: source.username,
              is_active: source.auto_publish,
              published_at: m.timestamp ?? new Date().toISOString(),
            },
            { onConflict: "shortcode", ignoreDuplicates: true },
          )
          .select("id");
        if (error) throw error;
        inserted += data?.length ?? 0;
      }

      await supabase
        .from("feed_embed_sources")
        .update({ last_checked_at: new Date().toISOString(), last_error: null })
        .eq("id", source.id);
      results.push({ username: source.username, found: videos.length, inserted });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      await supabase
        .from("feed_embed_sources")
        .update({ last_checked_at: new Date().toISOString(), last_error: message })
        .eq("id", source.id);
      results.push({ username: source.username, found: 0, inserted: 0, error: message });
    }
  }

  return json({ sources: results.length, results });
});
