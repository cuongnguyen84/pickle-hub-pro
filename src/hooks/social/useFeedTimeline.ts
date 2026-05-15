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
 * The hook also merges the static EN blog metadata (src/content/blog/
 * metadata.ts) into the same timeline — those posts are file-shipped
 * content with no DB row so the RPC can't see them. We compute the same
 * Phase 1 score for EN items client-side and merge by score DESC so the
 * combined list matches the server's ordering.
 *
 * Keyset pagination is now (score, item_id) lex order — Codex P1 on
 * PR #82 flagged that the previous (published_at, item_id) cursor
 * silently dropped rows whose recency disagreed with the score order.
 * The hook stores the last DB row's `score` and passes it back as
 * p_cursor_score for the next page.
 */

export type FeedTimelineItem =
  | ({
      type: "match";
      cursor_id: string;
      published_at: string;
      score: number;
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
      score: number;
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
      score: number;
    };

export interface FeedTimelineCursor {
  score: number;
  item_id: string;
}

interface RpcRow {
  item_type: string;
  item_id: string;
  /**
   * Recency anchor — for matches this is COALESCE(verified_at, played_at)
   * (i.e. "when this became news"). Used for sort + cursor only.
   */
  published_at: string;
  score: number;
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
  /**
   * Display anchor for match cards — the literal scheduled/actual play
   * time. NULL for blog and video rows (they use published_at for both
   * sort and display). Sprint 7 follow-up migration 20260515120001.
   */
  match_played_at: string | null;
  // blog/video shared
  title: string | null;
  excerpt: string | null;
  cover_image_url: string | null;
  category: string | null;
  duration_seconds: number | null;
}

const PAGE_SIZE = 20;
const WINDOW_DAYS = 30;

// Phase 1 scoring constants — kept here in sync with the SQL function
// body in supabase/migrations/20260515100000_feed_timeline_scored.sql.
// EN blog rows have no DB engagement signals, so client-side scoring
// reduces to recency_decay + type_bonus.
const HALF_LIFE_HOURS = 48;
const BLOG_TYPE_BONUS = 1.0;

export function useFeedTimeline() {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ["feed", "timeline", user?.id ?? null] as const,
    initialPageParam: null as FeedTimelineCursor | null,
    staleTime: 5 * 60_000,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc("get_feed_timeline", {
        p_limit: PAGE_SIZE,
        p_cursor_score: pageParam?.score ?? null,
        p_cursor_item_id: pageParam?.item_id ?? null,
        p_viewer_id: user?.id ?? null,
      });
      if (error) throw error;
      const dbItems = ((data ?? []) as RpcRow[])
        .map(normalizeRow)
        .filter((item): item is FeedTimelineItem => item != null);

      // Merge static EN blog metadata into the SAME score window the
      // server returned for this page. Codex P2 (PR #80 review) needed
      // a windowed merge for chronological order; the score-based
      // version of the same fix is: only fold in EN items whose
      // client-computed score falls between the score of the previous
      // page's last row (exclusive upper) and the score of this page's
      // last DB row (exclusive lower, or unbounded on the final page).
      const upperExclusive = pageParam?.score ?? null;
      const isFinalPage = dbItems.length < PAGE_SIZE;
      const lastDbInPage = dbItems[dbItems.length - 1];
      const lowerExclusive = isFinalPage
        ? null
        : lastDbInPage?.score ?? null;

      const enItems = buildEnBlogItems().filter((item) => {
        if (upperExclusive != null && item.score >= upperExclusive) {
          return false;
        }
        if (lowerExclusive != null && item.score <= lowerExclusive) {
          return false;
        }
        return true;
      });

      if (enItems.length === 0) return dbItems;
      // Merge by score DESC (server ORDER BY) so EN cards interleave
      // with DB cards at their correct ranking position rather than
      // being dumped at the bottom.
      return [...dbItems, ...enItems].sort(byScoreDesc);
    },
    getNextPageParam: (lastPage): FeedTimelineCursor | undefined => {
      // Cursor advances from the last DB row in the page. EN blog rows
      // are static overlays — using them as the cursor would skip DB
      // rows that fall between two EN scores. DB items only.
      const lastDb = [...lastPage].reverse().find(isDbItem);
      if (!lastDb) return undefined;
      const dbCount = lastPage.filter(isDbItem).length;
      if (dbCount < PAGE_SIZE) return undefined;
      return {
        score: lastDb.score,
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

function byScoreDesc(a: FeedTimelineItem, b: FeedTimelineItem): number {
  if (a.score === b.score) {
    // Match the SQL tiebreaker — item_id DESC. Stable across renders.
    return a.cursor_id < b.cursor_id ? 1 : -1;
  }
  return a.score < b.score ? 1 : -1;
}

function normalizeRow(row: RpcRow): FeedTimelineItem | null {
  if (row.item_type === "match") {
    return {
      type: "match",
      cursor_id: row.item_id,
      published_at: row.published_at,
      score: row.score,
      match_id: row.item_id,
      slug: row.slug ?? "",
      // Card display uses the literal match time (match_played_at),
      // NOT the feed recency anchor (published_at = COALESCE
      // (verified_at, played_at)). Fall back to published_at if the
      // RPC didn't populate match_played_at — defensive for pre-Sprint-7
      // schemas where the column doesn't exist yet.
      played_at: row.match_played_at ?? row.published_at,
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
      score: row.score,
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
      score: row.score,
    };
  }
  return null;
}

/**
 * Build FeedTimelineItem rows for EN blog posts that fall inside the
 * timeline window. publishedDate is a date-only string ("YYYY-MM-DD") in
 * the metadata file — we treat it as midnight UTC, then convert to an
 * ISO timestamp + compute the Phase 1 score (recency_decay + 1.0 type
 * bonus, no engagement signals) so the merged sort lines up with what
 * the SQL function would have produced if the row lived in vi_blog_posts.
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
      const ageHours = (now - ts) / (1000 * 60 * 60);
      const recencyDecay = Math.exp(-ageHours / HALF_LIFE_HOURS);
      const score = recencyDecay + BLOG_TYPE_BONUS;
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
        score,
        lang: "en",
      };
      return item;
    })
    .filter((item): item is FeedTimelineItem => item != null);
}
