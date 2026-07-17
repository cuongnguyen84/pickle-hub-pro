// ============================================================================
// feed-generate — system-generated feed cards → feed_highlights
// ----------------------------------------------------------------------------
// (Replaces the Sprint-1 skeleton; the per-user 4-layer feed idea it stubbed
// was superseded by the get_feed_timeline RPC.)
//
// Runs hourly (pg_cron :50). Every task is idempotent via a UNIQUE
// dedupe_key + upsert ignoreDuplicates, so time-of-day guards can be loose.
//
//   A. milestones  (every run)
//      - event participation: user's 5th/10th/25th/50th/100th registration
//        (event_registrations, non-cancelled)
//      - DUPR band crossing: doubles rating crosses a .5 band ≥ 3.0
//        (consecutive dupr_rating_history rows in the last 7 days)
//      Public profiles only (is_public_profile) — same privacy rule as the
//      dupr_leaderboard_vietnam RPC.
//   B. protour digest — yesterday-ICT pro matches; attempted every run,
//      inserts once and only if there were any
//   C. leaderboard weekly (Mondays ICT): top 5 DUPR doubles climbers of the
//      trailing 7 days
//   D. AI weekly recap (Sundays ≥19h ICT): Gemini writes a short VI+EN
//      community recap from the week's numbers
//
// Data-reality notes (2026-07-04): community `matches` is empty and quick
// tables use ad-hoc player names, so per-user MATCH-count milestones aren't
// derivable yet — event participation + DUPR bands are the real substitutes.
// Revisit when quick_table_registrations gets adopted.
// ============================================================================

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import { requireCronRequest } from "../_shared/cron-auth.ts";
import { cronCorsHeaders as corsHeaders } from "../_shared/cors.ts";

const ICT_OFFSET_MS = 7 * 3600_000;
const EVENT_THRESHOLDS = [5, 10, 25, 50, 100];
const DUPR_MIN_BAND = 3.0; // first celebrated band; below that it's noise
const CLIMBER_COUNT = 5;
const GEMINI_MODEL = "gemini-flash-lite-latest";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function ictNow(): Date {
  return new Date(Date.now() + ICT_OFFSET_MS);
}

/** ISO-8601 week label like 2026-W27 (UTC getters on an ICT-shifted date). */
function isoWeek(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

interface Highlight {
  kind: "milestone" | "leaderboard" | "protour" | "recap";
  dedupe_key: string;
  title_vi: string;
  title_en: string;
  body_vi?: string;
  body_en?: string;
  href?: string;
}

async function insertHighlights(
  supabase: SupabaseClient,
  rows: Highlight[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const { data, error } = await supabase
    .from("feed_highlights")
    .upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true })
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

interface FeedProfile {
  display_name: string | null;
  profile_slug: string | null;
}

interface EventMilestoneCandidate extends FeedProfile {
  profile_id: string;
  registration_count: number;
}

interface DuprBandCrossing extends FeedProfile {
  profile_id: string;
  reached_band: number;
}

interface DuprWeeklyClimber extends FeedProfile {
  profile_id: string;
  rating_delta: number;
  current_rating: number;
}

// ---------------------------------------------------------------------------
// A. Milestones
// ---------------------------------------------------------------------------

// PostgREST caps a single response at 1000 rows, so the milestone RPC (one row
// per qualifying profile, unbounded over all history) would be silently
// truncated once >1000 profiles cross a threshold. Page through the full,
// deterministically-ordered set instead of trusting one capped read.
const RPC_PAGE_SIZE = 1000;

async function generateEventMilestones(supabase: SupabaseClient): Promise<Highlight[]> {
  const candidates: EventMilestoneCandidate[] = [];
  for (let from = 0; ; from += RPC_PAGE_SIZE) {
    const { data, error } = await supabase
      .rpc("feed_event_milestone_candidates", {
        p_min_count: EVENT_THRESHOLDS[0],
      })
      .range(from, from + RPC_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as EventMilestoneCandidate[];
    candidates.push(...page);
    if (page.length < RPC_PAGE_SIZE) break;
  }

  const rows: Highlight[] = [];
  for (const candidate of candidates) {
    const count = Number(candidate.registration_count);
    // Emit only the highest threshold reached — the first cron run must not
    // spam a backlog of 5-then-10-then-25 cards for veteran players.
    const reached = EVENT_THRESHOLDS.filter((t) => count >= t).pop()!;
    rows.push({
      kind: "milestone",
      dedupe_key: `milestone:events:${candidate.profile_id}:${reached}`,
      title_vi: `🎉 ${candidate.display_name} vừa tham gia sự kiện thứ ${reached}!`,
      title_en: `🎉 ${candidate.display_name} just joined their ${reached}th event!`,
      body_vi: "Một cột mốc mới trên hành trình pickleball.",
      body_en: "Another pickleball journey milestone.",
      href: candidate.profile_slug ? `/u/${candidate.profile_slug}` : undefined,
    });
  }
  return rows;
}

async function generateDuprBandMilestones(supabase: SupabaseClient): Promise<Highlight[]> {
  // Recent window only — old crossings shouldn't backfill the feed.
  const windowStart = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data, error } = await supabase
    .rpc("feed_dupr_band_crossings", {
      p_window_start: windowStart,
      p_min_band: DUPR_MIN_BAND,
    });
  if (error) throw error;

  const rows: Highlight[] = [];
  for (const crossing of (data ?? []) as DuprBandCrossing[]) {
    const band = Number(crossing.reached_band);
    const bandLabel = Number.isInteger(band) ? band.toFixed(1) : String(band);
    rows.push({
      kind: "milestone",
      dedupe_key: `milestone:dupr:${crossing.profile_id}:${band}`,
      title_vi: `📈 ${crossing.display_name} vừa vượt mốc DUPR ${bandLabel}!`,
      title_en: `📈 ${crossing.display_name} just crossed DUPR ${bandLabel}!`,
      body_vi: "Rating đôi mới nhất đã qua một nấc thang mới.",
      body_en: "Their doubles rating just cleared a new band.",
      href: crossing.profile_slug ? `/u/${crossing.profile_slug}` : undefined,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// B. Pro tour digest (yesterday ICT)
// ---------------------------------------------------------------------------

async function generateProTourDigest(supabase: SupabaseClient): Promise<Highlight[]> {
  const nowIct = ictNow();
  const todayIctMidnightUtc = new Date(
    Date.UTC(nowIct.getUTCFullYear(), nowIct.getUTCMonth(), nowIct.getUTCDate()) - ICT_OFFSET_MS,
  );
  const yesterdayStart = new Date(todayIctMidnightUtc.getTime() - 86400_000);
  const dateLabel = new Date(todayIctMidnightUtc.getTime() - 1).toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("matches")
    .select("slug, source_provider, tournament_name, played_at")
    .not("source_provider", "is", null)
    .gte("played_at", yesterdayStart.toISOString())
    .lt("played_at", todayIctMidnightUtc.toISOString())
    .order("played_at", { ascending: false });
  if (error) throw error;
  const matches = data ?? [];
  if (matches.length === 0) return [];

  const providers = [...new Set(matches.map((m) => m.source_provider!.toUpperCase()))];
  const tournaments = [...new Set(matches.map((m) => m.tournament_name).filter(Boolean))];
  const top = matches[0];
  return [{
    kind: "protour",
    dedupe_key: `protour:${dateLabel}`,
    title_vi: `🏓 Pro tour hôm qua: ${matches.length} trận (${providers.join(", ")})`,
    title_en: `🏓 Yesterday on the pro tours: ${matches.length} matches (${providers.join(", ")})`,
    body_vi: tournaments.length > 0 ? `Các giải: ${tournaments.slice(0, 3).join(" · ")}` : undefined,
    body_en: tournaments.length > 0 ? `Events: ${tournaments.slice(0, 3).join(" · ")}` : undefined,
    href: top?.slug ? `/tran-dau/${top.slug}` : "/feed",
  }];
}

// ---------------------------------------------------------------------------
// C. Weekly leaderboard movement (Mondays ICT)
// ---------------------------------------------------------------------------

async function generateLeaderboardDigest(supabase: SupabaseClient): Promise<Highlight[]> {
  const nowIct = ictNow();
  if (nowIct.getUTCDay() !== 1) return []; // Monday ICT only

  const windowStart = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data, error } = await supabase
    .rpc("feed_dupr_weekly_climbers", {
      p_window_start: windowStart,
      p_limit: CLIMBER_COUNT,
    });
  if (error) throw error;

  const top = (data ?? []) as DuprWeeklyClimber[];
  if (top.length === 0) return [];

  const body = top
    .map((c, i) =>
      `${i + 1}. ${c.display_name} +${Number(c.rating_delta).toFixed(2)} → ${Number(c.current_rating).toFixed(2)}`
    )
    .join("\n");
  const week = isoWeek(nowIct);
  return [{
    kind: "leaderboard",
    dedupe_key: `leaderboard:${week}`,
    title_vi: `📊 BXH tuần: ${top[0].display_name} leo hạng mạnh nhất (+${Number(top[0].rating_delta).toFixed(2)} DUPR)`,
    title_en: `📊 Weekly movers: ${top[0].display_name} climbed the most (+${Number(top[0].rating_delta).toFixed(2)} DUPR)`,
    body_vi: body,
    body_en: body,
    href: "/rankings",
  }];
}

// ---------------------------------------------------------------------------
// D. AI weekly recap (Sundays ≥ 19h ICT)
// ---------------------------------------------------------------------------

async function generateWeeklyRecap(supabase: SupabaseClient): Promise<Highlight[]> {
  const nowIct = ictNow();
  if (nowIct.getUTCDay() !== 0 || nowIct.getUTCHours() < 19) return [];
  const geminiKey = Deno.env.get("GEMINI_API_KEY") ?? "";
  if (!geminiKey) return [];

  const weekStart = new Date(Date.now() - 7 * 86400_000).toISOString();
  const [events, regs, proMatches, reels] = await Promise.all([
    supabase.from("social_events").select("id", { count: "exact", head: true })
      .eq("status", "published").gte("start_at", weekStart),
    supabase.from("event_registrations").select("id", { count: "exact", head: true })
      .gte("registered_at", weekStart),
    supabase.from("matches").select("id", { count: "exact", head: true })
      .not("source_provider", "is", null).gte("played_at", weekStart),
    supabase.from("feed_embeds").select("id", { count: "exact", head: true })
      .gte("created_at", weekStart),
  ]);

  const stats = {
    social_events: events.count ?? 0,
    event_registrations: regs.count ?? 0,
    pro_tour_matches: proMatches.count ?? 0,
    new_reels: reels.count ?? 0,
  };

  const prompt = `Bạn viết recap tuần cho cộng đồng pickleball Việt trên thepicklehub.net.
Số liệu 7 ngày qua: ${JSON.stringify(stats)}.
Viết JSON đúng schema {"title_vi","title_en","body_vi","body_en"}:
- title: 1 câu hào hứng, ngắn (<90 ký tự), nêu số liệu nổi bật nhất.
- body: 2-3 câu tóm tắt các con số, giọng báo thể thao thân thiện. body_en là bản English tương đương.
- KHÔNG bịa số liệu ngoài JSON trên. Không emoji trong body.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const payload = await res.json();
  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const parsed = JSON.parse(text) as {
    title_vi: string; title_en: string; body_vi: string; body_en: string;
  };
  if (!parsed.title_vi || !parsed.title_en) throw new Error("Gemini recap missing titles");

  const week = isoWeek(nowIct);
  return [{
    kind: "recap",
    dedupe_key: `recap:${week}`,
    title_vi: `📝 ${parsed.title_vi}`,
    title_en: `📝 ${parsed.title_en}`,
    body_vi: parsed.body_vi,
    body_en: parsed.body_en,
    href: "/feed",
  }];
}

// ---------------------------------------------------------------------------
// Entrypoint
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method === "GET") return json({ name: "feed-generate", status: "ok" });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const auth = req.headers.get("authorization") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authedByService = serviceRole !== "" && auth === `Bearer ${serviceRole}`;
  if (!authedByService) {
    const authError = requireCronRequest(req, Deno.env.get("CRON_SECRET") ?? "");
    if (authError) return authError;
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRole);

  // Per-task try/catch: one broken generator never blocks the others.
  const results: Record<string, number | string> = {};
  const tasks: Array<[string, () => Promise<Highlight[]>]> = [
    ["event_milestones", () => generateEventMilestones(supabase)],
    ["dupr_milestones", () => generateDuprBandMilestones(supabase)],
    ["protour_digest", () => generateProTourDigest(supabase)],
    ["leaderboard_weekly", () => generateLeaderboardDigest(supabase)],
    ["ai_recap", () => generateWeeklyRecap(supabase)],
  ];
  for (const [name, task] of tasks) {
    try {
      results[name] = await insertHighlights(supabase, await task());
    } catch (e) {
      results[name] = `error: ${e instanceof Error ? e.message : String(e)}`;
    }
  }
  return json({ results });
});
