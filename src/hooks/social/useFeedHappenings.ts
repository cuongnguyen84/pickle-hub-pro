import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * "Happenings" for /feed Trending — live platform activity merged
 * client-side like useFeedNews/useFeedEmbeds (the RPC stays untouched):
 *
 *   - live:       livestreams with status='live' → pinned near the top
 *                 while streaming (huge score bonus, drops off at end)
 *   - tournament: doubles-elimination tournaments with registration open
 *                 → "còn N slot" conversion card
 *   - event:      upcoming published social events → "tối nay tại sân X"
 *
 * One hook + one card for all three: they share the same shape and are
 * each a single cheap indexed query. published_at drives the page's age
 * decay — future events use start_at (age 0 → no decay), so they float
 * until they happen and disappear 14 days later via the standard cutoff.
 */

const EVENT_LIMIT = 5;
const TOURNAMENT_LIMIT = 5;
// Above embeds (1.3) — a tournament you can still join or an event you can
// still attend beats archive content.
const HAPPENING_BONUS = 1.5;
// Effectively pins live streams to the top slot while status='live'.
const LIVE_BONUS = 10;
const HALF_LIFE_HOURS = 48;

export interface FeedHappeningItem {
  type: "happening";
  kind: "live" | "tournament" | "event";
  cursor_id: string;
  id: string;
  /** Internal route the card links to. */
  href: string;
  title: string;
  /** Secondary line, already language-appropriate where the data allows. */
  meta_vi: string;
  meta_en: string;
  published_at: string;
  score: number;
}

function decayScore(publishedAt: string, bonus: number): number {
  const ageHours = Math.max(0, (Date.now() - Date.parse(publishedAt)) / 3_600_000);
  return Math.exp(-ageHours / HALF_LIFE_HOURS) + bonus;
}

export function useFeedHappenings() {
  return useQuery({
    queryKey: ["feed", "happenings"],
    staleTime: 60_000, // live status should surface within a minute
    queryFn: async (): Promise<FeedHappeningItem[]> => {
      const [liveRes, tourRes, eventRes] = await Promise.all([
        supabase
          .from("livestreams")
          .select("id, title, started_at")
          .eq("status", "live")
          .order("started_at", { ascending: false })
          .limit(3),
        supabase
          .from("doubles_elimination_tournaments")
          .select("id, name, share_id, team_count, updated_at")
          .eq("status", "registration_open")
          .order("updated_at", { ascending: false })
          .limit(TOURNAMENT_LIMIT),
        supabase
          .from("social_events")
          .select("id, slug, title_vi, title_en, start_at, location_text, max_players")
          .eq("status", "published")
          .eq("visibility", "public")
          .gt("start_at", new Date().toISOString())
          .order("start_at", { ascending: true })
          .limit(EVENT_LIMIT),
      ]);
      // Partial failure = partial feed, not an error page.
      const items: FeedHappeningItem[] = [];

      for (const row of liveRes.data ?? []) {
        const publishedAt = row.started_at ?? new Date().toISOString();
        items.push({
          type: "happening",
          kind: "live",
          cursor_id: `live:${row.id}`,
          id: row.id,
          href: `/live/${row.id}`,
          title: row.title,
          meta_vi: "Đang phát trực tiếp — bấm để xem",
          meta_en: "Streaming now — tap to watch",
          published_at: publishedAt,
          score: decayScore(publishedAt, LIVE_BONUS),
        });
      }

      for (const row of tourRes.data ?? []) {
        // updated_at is NOT NULL in the DB (codegen types it nullable); it's
        // the feed sort key, so fall back defensively if a row lacks it.
        const publishedAt = row.updated_at ?? new Date().toISOString();
        items.push({
          type: "happening",
          kind: "tournament",
          cursor_id: `tournament:${row.id}`,
          id: row.id,
          href: `/tools/doubles-elimination/${row.share_id}`,
          title: row.name.trim(),
          meta_vi: `Đang mở đăng ký · tối đa ${row.team_count} đội`,
          meta_en: `Registration open · up to ${row.team_count} teams`,
          published_at: publishedAt,
          score: decayScore(publishedAt, HAPPENING_BONUS),
        });
      }

      for (const row of eventRes.data ?? []) {
        const when = new Date(row.start_at);
        const whenVi = when.toLocaleString("vi-VN", {
          weekday: "short", day: "numeric", month: "numeric",
          hour: "2-digit", minute: "2-digit",
        });
        const whenEn = when.toLocaleString("en-US", {
          weekday: "short", day: "numeric", month: "short",
          hour: "2-digit", minute: "2-digit",
        });
        const where = row.location_text ? ` · ${row.location_text}` : "";
        items.push({
          type: "happening",
          kind: "event",
          cursor_id: `event:${row.id}`,
          id: row.id,
          href: `/social/${row.slug}`,
          title: row.title_vi || row.title_en || "",
          meta_vi: `${whenVi}${where}${row.max_players ? ` · ${row.max_players} chỗ` : ""}`,
          meta_en: `${whenEn}${where}${row.max_players ? ` · ${row.max_players} spots` : ""}`,
          // start_at is in the future → age 0 in the page's decay until it
          // starts, then it ages out like everything else.
          published_at: row.start_at,
          score: decayScore(new Date().toISOString(), HAPPENING_BONUS),
        });
      }

      return items;
    },
  });
}
