import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { FeedMatch } from "./useFollowingFeed";
import type { FeedParticipant } from "@/lib/social/feed-formatters";
import { blogMetadata } from "@/content/blog/metadata";

/**
 * Sprint 7 — single mixed timeline for /feed Trending tab.
 *
 * Wraps the get_feed_timeline RPC which UNION-ALLs three sources:
 *
 *   - matches (community + pro tour)
 *   - vi_blog_posts (status='published')
 *   - videos (status='published')
 *
 * The hook then merges the static EN blog metadata (src/content/blog/
 * metadata.ts) on top of page 1 only — those posts are file-shipped
 * content with no DB row, so the RPC can't see them. We intentionally
 * do this client-side rather than dual-source the RPC to keep the
 * Postgres function provider-agnostic.
 *
 * Composite cursor pagination on (published_at, item_id) — same defensive
 * pattern as useFollowingFeed/useTrendingFeed. EN blog merge runs on the
 * first fetch only so subsequent pages don't keep re-inserting the same
 * static rows (the cursor for page 2 is based on the last DB row, not the
 * last visible row, which is the right thing — EN blog posts are all
 * within 30 days and all sit on page 1 anyway).
 */

export type FeedTimelineItem =
  | ({
      type: "match";
      cursor_id: string;
      published_at: string;
    } & FeedMatch)
  | {
      type: "blog";
      cursor_id: string; // RPC item_id for VI, slug-prefixed sentinel for EN
      id: string;
      slug: string;
      title: string;
      excerpt: string | null;
      cover_image_url: string | null;
      category: string | null;
      published_at: string;
      lang: "vi" | "en";
    }
  | {
      type: "video";
      cursor_id: string;
      id: string;
      title: string;
      description: string | null;
      thumbnail_url: string | null;
      duration_seconds: number | null;
      video_type: "short" | "long";
      published_at: string;
    };

export interface FeedTimelineCursor {
  published_at: string;
  item_id: string;
}

interface RpcRow {
  item_type: string;
  item_id: string;
  published_at: string;
  // match-specific
  slug: string | null;
  format: string | null;
  match_type: string | null;
  verification_status: string | null;
  venue_name: string | null;
  team_a_score: number[] | null;
  team_b_score: number[] | null;
  winning_team: string | null;
  participants: unknown;
  kudos_count: number | null;
  viewer_kudoed: boolean | null;
  comment_count: number | null;
  source_provider: string | null;
  source_url: string | null;
  tournament_name: string | null;
  tournament_event: string | null;
  round_name: string | null;
  // blog/video shared
  title: string | null;
  excerpt: string | null;
  cover_image_url: string | null;
  category: string | null;
  duration_seconds: number | null;
}

const PAGE_SIZE = 20;
const WINDOW_DAYS = 30;

export function useFeedTimeline() {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ["feed", "timeline", user?.id ?? null] as const,
    initialPageParam: null as FeedTimelineCursor | null,
    staleTime: 5 * 60_000,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("get_feed_timeline", {
        p_limit: PAGE_SIZE,
        p_cursor_published_at: pageParam?.published_at ?? null,
        p_cursor_item_id: pageParam?.item_id ?? null,
        p_viewer_id: user?.id ?? null,
      });
      if (error) throw error;
      const dbItems = ((data ?? []) as RpcRow[])
        .map(normalizeRow)
        .filter((item): item is FeedTimelineItem => item != null);

      // First-page-only merge of static EN blog metadata. We treat the
      // initial query (pageParam == null) as page 1 — that's where all
      // EN posts within the 30-day window get folded in, then the whole
      // list is re-sorted by published_at DESC so cards interleave with
      // matches/VI blog/videos by recency. Subsequent pages skip this
      // merge so the same posts don't appear twice.
      if (pageParam == null) {
        const enItems = buildEnBlogItems();
        return [...dbItems, ...enItems].sort(byPublishedDesc);
      }
      return dbItems;
    },
    getNextPageParam: (lastPage): FeedTimelineCursor | undefined => {
      // Use the cursor from the last item that has a real RPC origin
      // (i.e. type=match | type=video | type=blog with lang='vi'). EN
      // blog rows are static overlays and shouldn't drive pagination.
      const lastDb = [...lastPage].reverse().find(isDbItem);
      if (!lastDb) return undefined;
      // We need a full page to keep paging. Count DB items only — if
      // the underlying RPC returned fewer than PAGE_SIZE rows, there's
      // nothing left server-side.
      const dbCount = lastPage.filter(isDbItem).length;
      if (dbCount < PAGE_SIZE) return undefined;
      return {
        published_at: lastDb.published_at,
        item_id: lastDb.cursor_id,
      };
    },
  });
}

function isDbItem(item: FeedTimelineItem): boolean {
  if (item.type === "match") return true;
  if (item.type === "video") return true;
  return item.type === "blog" && item.lang === "vi";
}

function byPublishedDesc(a: FeedTimelineItem, b: FeedTimelineItem): number {
  if (a.published_at === b.published_at) {
    // Stable secondary sort by cursor_id so two items sharing a timestamp
    // don't shuffle between renders. Matches the RPC's tiebreaker.
    return a.cursor_id < b.cursor_id ? 1 : -1;
  }
  return a.published_at < b.published_at ? 1 : -1;
}

function normalizeRow(row: RpcRow): FeedTimelineItem | null {
  if (row.item_type === "match") {
    return {
      type: "match",
      cursor_id: row.item_id,
      published_at: row.published_at,
      match_id: row.item_id,
      slug: row.slug ?? "",
      played_at: row.published_at,
      format: row.format ?? "",
      match_type: row.match_type ?? "",
      verification_status: row.verification_status ?? "",
      venue_name: row.venue_name,
      team_a_score: row.team_a_score ?? [],
      team_b_score: row.team_b_score ?? [],
      winning_team: row.winning_team ?? "",
      participants: Array.isArray(row.participants)
        ? (row.participants as FeedParticipant[])
        : [],
      kudos_count: row.kudos_count ?? 0,
      viewer_kudoed: row.viewer_kudoed ?? false,
      comment_count: row.comment_count ?? 0,
      source_provider: (row.source_provider ?? "community") as FeedMatch["source_provider"],
      source_url: row.source_url,
      tournament_name: row.tournament_name,
      tournament_event: row.tournament_event,
      round_name: row.round_name,
    };
  }
  if (row.item_type === "blog") {
    return {
      type: "blog",
      cursor_id: row.item_id,
      id: row.item_id,
      slug: row.slug ?? "",
      title: row.title ?? "",
      excerpt: row.excerpt,
      cover_image_url: row.cover_image_url,
      category: row.category,
      published_at: row.published_at,
      lang: "vi",
    };
  }
  if (row.item_type === "video") {
    // The RPC stashes the video type (short/long) in the `category`
    // column so the UNION shape stays uniform. Treat any unknown value
    // as 'long' to fail safe to the 16:9 layout.
    const videoType: "short" | "long" =
      row.category === "short" ? "short" : "long";
    return {
      type: "video",
      cursor_id: row.item_id,
      id: row.item_id,
      title: row.title ?? "",
      description: row.excerpt,
      thumbnail_url: row.cover_image_url,
      duration_seconds: row.duration_seconds,
      video_type: videoType,
      published_at: row.published_at,
    };
  }
  return null;
}

/**
 * Build FeedTimelineItem rows for EN blog posts that fall inside the
 * timeline window. publishedDate is a date-only string ("YYYY-MM-DD") in
 * the metadata file — we treat it as midnight UTC, then convert to an ISO
 * timestamp so the merged sort lines up with RPC rows. A blog whose date
 * is older than WINDOW_DAYS or in the future is dropped.
 */
function buildEnBlogItems(): FeedTimelineItem[] {
  const now = Date.now();
  const windowStartMs = now - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  return blogMetadata
    .map((post) => {
      const ts = Date.parse(`${post.publishedDate}T00:00:00Z`);
      if (Number.isNaN(ts)) return null;
      if (ts < windowStartMs || ts > now) return null;
      const publishedAt = new Date(ts).toISOString();
      const item: FeedTimelineItem = {
        type: "blog",
        // Synthetic cursor id so the static row has a stable React key
        // and is distinguishable from a real UUID at a glance during QA.
        cursor_id: `en-blog:${post.slug}`,
        id: `en-blog:${post.slug}`,
        slug: post.slug,
        title: post.titleEn,
        excerpt: post.metaDescriptionEn,
        cover_image_url: post.heroImage?.src ?? null,
        category: null,
        published_at: publishedAt,
        lang: "en",
      };
      return item;
    })
    .filter((item): item is FeedTimelineItem => item != null);
}
