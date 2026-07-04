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

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const ICT_OFFSET_MS = 7 * 3600_000;
const EVENT_THRESHOLDS = [5, 10, 25, 50, 100];
const DUPR_MIN_BAND = 3.0; // first celebrated band; below that it's noise
const CLIMBER_COUNT = 5;
const GEMINI_MODEL = "gemini-flash-lite-latest";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-auth-secret",
};

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

interface PublicProfile {
  id: string;
  display_name: string | null;
  profile_slug: string | null;
}

async function publicProfilesById(
  supabase: SupabaseClient,
  ids: string[],
): Promise<Map<string, PublicProfile>> {
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name, profile_slug")
    .in("id", ids)
    .eq("is_public_profile", true);
  if (error) throw error;
  return new Map((data ?? []).map((p) => [p.id, p as PublicProfile]));
}

// ---------------------------------------------------------------------------
// A. Milestones
// ---------------------------------------------------------------------------

async function generateEventMilestones(supabase: SupabaseClient): Promise<Highlight[]> {
  const { data, error } = await supabase
    .from("event_registrations")
    .select("profile_id, status")
    .not("profile_id", "is", null)
    .neq("status", "cancelled");
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const r of data ?? []) {
    counts.set(r.profile_id, (counts.get(r.profile_id) ?? 0) + 1);
  }
  const candidates = [...counts.entries()].filter(([, n]) => n >= EVENT_THRESHOLDS[0]);
  const profiles = await publicProfilesById(supabase, candidates.map(([id]) => id));

  const rows: Highlight[] = [];
  for (const [profileId, count] of candidates) {
    const profile = profiles.get(profileId);
    if (!profile?.display_name) continue;
    // Emit only the highest threshold reached — the first cron run must not
    // spam a backlog of 5-then-10-then-25 cards for veteran players.
    const reached = EVENT_THRESHOLDS.filter((t) => count >= t).pop()!;
    rows.push({
      kind: "milestone",
      dedupe_key: `milestone:events:${profileId}:${reached}`,
      title_vi: `🎉 ${profile.display_name} vừa tham gia sự kiện thứ ${reached}!`,
      title_en: `🎉 ${profile.display_name} just joined their ${reached}th event!`,
      body_vi: "Một cột mốc mới trên hành trình pickleball.",
      body_en: "Another pickleball journey milestone.",
      href: profile.profile_slug ? `/u/${profile.profile_slug}` : undefined,
    });
  }
  return rows;
}

async function generateDuprBandMilestones(supabase: SupabaseClient): Promise<Highlight[]> {
  // Recent window only — old crossings shouldn't backfill the feed.
  const windowStart = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data, error } = await supabase
    .from("dupr_rating_history")
    .select("profile_id, dupr_doubles, recorded_at")
    .gte("recorded_at", windowStart)
    .not("dupr_doubles", "is", null)
    .order("profile_id")
    .order("recorded_at");
  if (error) throw error;

  const crossings = new Map<string, number>(); // profile_id → newly reached band
  let prevProfile: string | null = null;
  let prevRating: number | null = null;
  for (const row of data ?? []) {
    if (row.profile_id !== prevProfile) {
      prevProfile = row.profile_id;
      prevRating = row.dupr_doubles;
      continue;
    }
    const prevBand = Math.floor((prevRating ?? 0) * 2) / 2;
    const currBand = Math.floor(row.dupr_doubles * 2) / 2;
    if (currBand > prevBand && currBand >= DUPR_MIN_BAND) {
      crossings.set(row.profile_id, currBand);
    }
    prevRating = row.dupr_doubles;
  }

  const profiles = await publicProfilesById(supabase, [...crossings.keys()]);
  const rows: Highlight[] = [];
  for (const [profileId, band] of crossings) {
    const profile = profiles.get(profileId);
    if (!profile?.display_name) continue;
    const bandLabel = Number.isInteger(band) ? band.toFixed(1) : String(band);
    rows.push({
      kind: "milestone",
      dedupe_key: `milestone:dupr:${profileId}:${band}`,
      title_vi: `📈 ${profile.display_name} vừa vượt mốc DUPR ${bandLabel}!`,
      title_en: `📈 ${profile.display_name} just crossed DUPR ${bandLabel}!`,
      body_vi: "Rating đôi mới nhất đã qua một nấc thang mới.",
      body_en: "Their doubles rating just cleared a new band.",
      href: profile.profile_slug ? `/u/${profile.profile_slug}` : undefined,
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
    .from("dupr_rating_history")
    .select("profile_id, dupr_doubles, recorded_at")
    .gte("recorded_at", windowStart)
    .not("dupr_doubles", "is", null)
    .order("recorded_at");
  if (error) throw error;

  const firstLast = new Map<string, { first: number; last: number }>();
  for (const row of data ?? []) {
    const entry = firstLast.get(row.profile_id);
    if (!entry) firstLast.set(row.profile_id, { first: row.dupr_doubles, last: row.dupr_doubles });
    else entry.last = row.dupr_doubles;
  }
  const climbers = [...firstLast.entries()]
    .map(([id, { first, last }]) => ({ id, delta: last - first, now: last }))
    .filter((c) => c.delta > 0.005)
    .sort((a, b) => b.delta - a.delta);

  const profiles = await publicProfilesById(supabase, climbers.map((c) => c.id));
  const top = climbers
    .filter((c) => profiles.get(c.id)?.display_name)
    .slice(0, CLIMBER_COUNT);
  if (top.length === 0) return [];

  const body = top
    .map((c, i) => `${i + 1}. ${profiles.get(c.id)!.display_name} +${c.delta.toFixed(2)} → ${c.now.toFixed(2)}`)
    .join("\n");
  const week = isoWeek(nowIct);
  return [{
    kind: "leaderboard",
    dedupe_key: `leaderboard:${week}`,
    title_vi: `📊 BXH tuần: ${profiles.get(top[0].id)!.display_name} leo hạng mạnh nhất (+${top[0].delta.toFixed(2)} DUPR)`,
    title_en: `📊 Weekly movers: ${profiles.get(top[0].id)!.display_name} climbed the most (+${top[0].delta.toFixed(2)} DUPR)`,
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
  const sharedSecret = req.headers.get("x-auth-secret") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const scraperSecret = Deno.env.get("SCRAPER_AUTH_SECRET") ?? "";
  const authed =
    (serviceRole && auth === `Bearer ${serviceRole}`) ||
    (scraperSecret && sharedSecret === scraperSecret);
  if (!authed) return json({ error: "Unauthorized" }, 401);

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
