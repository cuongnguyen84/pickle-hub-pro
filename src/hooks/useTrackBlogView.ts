import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "tph_blog_session";
const DEDUPE_KEY_PREFIX = "tph_blog_view_";
const DEDUPE_TTL_MS = 24 * 60 * 60 * 1000;

function getSessionHash(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const hash = Array.from(crypto.getRandomValues(new Uint8Array(8)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    localStorage.setItem(SESSION_KEY, hash);
    return hash;
  } catch {
    return "unknown";
  }
}

function wasRecentlyViewed(lang: string, slug: string): boolean {
  try {
    const key = `${DEDUPE_KEY_PREFIX}${lang}_${slug}`;
    const ts = localStorage.getItem(key);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < DEDUPE_TTL_MS;
  } catch {
    return false;
  }
}

function markViewed(lang: string, slug: string): void {
  try {
    localStorage.setItem(`${DEDUPE_KEY_PREFIX}${lang}_${slug}`, String(Date.now()));
  } catch {
    // localStorage not available — silent fail
  }
}

function detectReferrerSource(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const utm = params.get("utm_source");
    if (utm) return `utm:${utm}`;

    const ref = document.referrer;
    if (!ref) return "direct";

    const refUrl = new URL(ref);
    const host = refUrl.hostname.toLowerCase();

    if (host === window.location.hostname) return "internal";

    const search = ["google.", "bing.", "yahoo.", "duckduckgo.", "baidu.", "yandex."];
    if (search.some((s) => host.includes(s))) return "search";

    const social = ["facebook.", "fb.", "twitter.", "x.com", "instagram.", "tiktok.", "youtube.", "linkedin.", "zalo."];
    if (social.some((s) => host.includes(s))) return "social";

    return "referral";
  } catch {
    return "unknown";
  }
}

export function useTrackBlogView(lang: "en" | "vi" | undefined, slug: string | undefined): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!lang || !slug) return;
    if (wasRecentlyViewed(lang, slug)) return;

    let cancelled = false;

    const fire = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled) return;

        const { error } = await supabase.from("blog_post_views").insert({
          lang,
          slug,
          viewer_user_id: user?.id ?? null,
          session_hash: getSessionHash(),
          referrer_source: detectReferrerSource(),
        });

        if (cancelled) return;

        if (error) {
          console.debug("[blog-view] insert failed", { lang, slug, error });
          return; // do NOT mark viewed if insert failed — let next mount retry
        }

        markViewed(lang, slug);

        // Refresh display immediately so the badge ticks up without waiting
        // for the 60s React Query staleTime. Without this, viewers see "0"
        // even after their own view was recorded.
        queryClient.invalidateQueries({
          queryKey: ["blog-post-view-count", lang, slug],
        });

        // Also invalidate batch query used on list pages
        queryClient.invalidateQueries({
          queryKey: ["blog-post-view-counts-batch"],
        });
      } catch (err) {
        console.debug("[blog-view] failed to record view", { lang, slug, err });
      }
    };

    const timer = setTimeout(fire, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [lang, slug, queryClient]);
}
