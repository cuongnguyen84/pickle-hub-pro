import { describe, expect, it } from "vitest";
import { renderTournamentDetail, renderTournaments } from "../tournaments";
import type { SupabaseClient } from "../../supabase";

const SITE = "https://www.thepicklehub.net";

type Row = Record<string, unknown> | null;

/**
 * Minimal Supabase stub for the detail renderer, which makes two calls:
 *   tournaments : from().select().eq().single()          → { data: row }
 *   livestreams : from().select().eq().order().limit()   → { data: streams }
 */
function stubClient(row: Row, streams: Record<string, unknown>[] = []): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    limit: async () => ({ data: streams, error: null }),
    single: async () => ({ data: row, error: null }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

/** Two broadcasts: one with a recording (→ /watch), one upcoming (→ /live). */
const STREAMS = [
  {
    id: "ls-replay",
    title: "Tứ kết | Alshon vs Jack Sock",
    status: "ended",
    scheduled_start_at: "2026-03-12T14:50:00+00:00",
    started_at: null,
    thumbnail_url: "https://img.example/thumb.jpg",
    mux_playback_id: "pb123",
    vod_url: null,
  },
  {
    id: "ls-upcoming",
    title: "Chung kết đôi nam",
    status: "scheduled",
    scheduled_start_at: "2026-03-15T09:00:00+00:00",
    started_at: null,
    thumbnail_url: null,
    mux_playback_id: null,
    vod_url: null,
  },
];

const ENDED_ROW = {
  id: "t1",
  name: "PPATour Texas Open 2026",
  description: null,
  status: "ended",
  start_date: "2026-03-11",
  end_date: "2026-03-15",
  slug: "ppatour-texas-open-2026",
  organizations: { name: "PPA Tour", slug: "ppa-tour" },
};

const render = async (row: Row, slug = "s", streams: Record<string, unknown>[] = []) =>
  (await renderTournamentDetail(stubClient(row, streams), slug, SITE)).text();

/** Visible words in <main>, the metric the 145-word regression was caught by. */
const bodyWordCount = (html: string) =>
  (html.match(/<main[\s\S]*?<\/main>/)?.[0] ?? html)
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

const jsonLdGraph = (html: string) => {
  const block = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  expect(block, "no JSON-LD emitted").toBeTruthy();
  return JSON.parse(block![1])["@graph"] as Record<string, unknown>[];
};

const metaDescription = (html: string) =>
  html.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "";

const utf8Bytes = (s: string) => new TextEncoder().encode(s).length;

describe("renderTournamentDetail", () => {
  it("front-loads name, dates and status into the extractable opening passage", async () => {
    const html = await render(ENDED_ROW);

    expect(html).toContain("<h1>PPATour Texas Open 2026</h1>");
    expect(html).toContain("11–15/3/2026");
    expect(html).toContain("đã kết thúc");
    expect(html).toContain("PPA Tour");
  });

  it("emits exactly one h1", async () => {
    const html = await render(ENDED_ROW);
    expect(html.match(/<h1[\s>]/g)?.length).toBe(1);
  });

  it("gives each tournament a distinct meta description instead of the generic fallback", async () => {
    const html = await render(ENDED_ROW);
    const desc = metaDescription(html);

    expect(desc).not.toContain("nền tảng pickleball hàng đầu Việt Nam");
    expect(desc).toContain("PPATour Texas Open 2026");
    expect(desc).toContain("11–15/3/2026");
  });

  it("keeps the ThePickleHub attribution inside the 160-byte description budget", async () => {
    // A Vietnamese diacritic costs 2-3 UTF-8 bytes, so buildHtml's byte-based
    // truncation used to cut the brand mention off the end of every row.
    for (const row of [
      ENDED_ROW,
      { ...ENDED_ROW, name: "Giải Pickleball Vô địch Quốc gia Việt Nam Mở rộng 2026" },
      { ...ENDED_ROW, organizations: { name: "Major League Pickleball", slug: "mlp" } },
      { ...ENDED_ROW, start_date: null, end_date: null, organizations: null },
    ]) {
      const desc = metaDescription(await render(row));
      expect(utf8Bytes(desc)).toBeLessThanOrEqual(160);
      expect(desc).toContain("ThePickleHub");
      expect(desc).not.toContain("…");
      expect(desc).not.toContain("nền tảng pickleball hàng đầu Việt Nam");
    }
  });

  it("does not claim aggregated tournaments are online events organised by ThePickleHub", async () => {
    const html = await render(ENDED_ROW);

    expect(html).not.toContain("OnlineEventAttendanceMode");
    expect(html).not.toContain("VirtualLocation");
    expect(html).toContain('"startDate":"2026-03-11"');
    expect(html).toContain('"endDate":"2026-03-15"');
  });

  it("labels the linked organization as broadcaster, never as organiser", async () => {
    // tournaments.organization_id was backfilled from livestreams, so it is the
    // channel that broadcast the event. Calling TAPickleball the organiser of a
    // US PPA Tour stop would be false.
    const html = await render(ENDED_ROW);

    expect(html).toContain("Đơn vị phát sóng:");
    expect(html).not.toContain("Đơn vị tổ chức");
    expect(html).toContain("phát sóng bởi PPA Tour");
    expect(html).not.toContain("organizer");
    expect(html).toContain('href="https://www.thepicklehub.net/org/ppa-tour"');
  });

  it("renders a single-day event and an organiser-less row without empty fields", async () => {
    const html = await render({
      ...ENDED_ROW,
      end_date: "2026-03-11",
      organizations: null,
      status: "upcoming",
    });

    expect(html).toContain("11/3/2026");
    expect(html).toContain("Sắp diễn ra");
    expect(html).not.toContain("Đơn vị phát sóng");
    expect(html).not.toContain("organizer");
  });

  it("formats cross-month and cross-year date ranges", async () => {
    const crossMonth = await render({ ...ENDED_ROW, start_date: "2026-01-12", end_date: "2026-02-16" });
    expect(crossMonth).toContain("12/1–16/2/2026");

    const crossYear = await render({ ...ENDED_ROW, start_date: "2025-12-28", end_date: "2026-01-03" });
    expect(crossYear).toContain("28/12/2025–3/1/2026");
  });

  it("still produces a substantive body when the row has no dates and no organiser", async () => {
    const html = await render({ ...ENDED_ROW, start_date: null, end_date: null, organizations: null });

    expect(html).toContain("<h1>PPATour Texas Open 2026</h1>");
    expect(html).toContain("Môn thi đấu:");
    expect(html).toContain("Trạng thái:");
    expect(html).not.toContain("Thời gian:");
  });

  it("escapes tournament names that contain markup", async () => {
    const html = await render({ ...ENDED_ROW, name: 'Giải "A" & <b>B</b>', organizations: null });

    expect(html).not.toContain("<b>B</b>");
    expect(html).toContain("&lt;b&gt;B&lt;/b&gt;");
  });

  it("404s an unknown slug", async () => {
    const res = await renderTournamentDetail(stubClient(null), "nope", SITE);
    expect(res.status).toBe(404);
  });

  // ── SEO-GUARD-01 (2026-08-19) ────────────────────────────────────────────
  // GSC 10-16/8 showed all 14 tournament URLs serving a ~145-word body built
  // from four scalar columns. The broadcasts in livestreams.tournament_id are
  // the per-tournament content the table itself does not carry.

  it("lists the tournament's broadcasts with the right destination per stream", async () => {
    const html = await render(ENDED_ROW, "s", STREAMS);

    // Recorded stream → /watch (replayable); scheduled stream → /live.
    expect(html).toContain(`href="${SITE}/watch/ls-replay"`);
    expect(html).toContain(`href="${SITE}/live/ls-upcoming"`);
    expect(html).toContain("Tứ kết | Alshon vs Jack Sock");
    expect(html).toContain("Chung kết đôi nam");
    // VN calendar day (UTC+7), not the raw UTC timestamp.
    expect(html).toContain("12/3/2026");
  });

  it("clears the 145-word body floor that the thin-content audit flagged", async () => {
    expect(bodyWordCount(await render(ENDED_ROW, "s", STREAMS))).toBeGreaterThan(300);
    // Even with no broadcasts at all the explainer sections carry the page.
    expect(bodyWordCount(await render(ENDED_ROW))).toBeGreaterThan(200);
  });

  it("omits the broadcast section entirely when no stream is linked", async () => {
    const html = await render(ENDED_ROW);
    expect(html).not.toContain("Trận đấu &amp; livestream");
    expect(html).not.toContain("<ul></ul>");
    expect(jsonLdGraph(html).find((n) => n["@type"] === "SportsEvent")?.subEvent).toBeUndefined();
  });

  it("graphs broadcasts as subEvent without inventing a location or organizer", async () => {
    const ev = jsonLdGraph(await render(ENDED_ROW, "s", STREAMS)).find(
      (n) => n["@type"] === "SportsEvent",
    )!;
    const sub = ev.subEvent as Record<string, unknown>[];

    expect(sub).toHaveLength(2);
    expect(sub[0]["@type"]).toBe("BroadcastEvent");
    expect(sub[0].url).toBe(`${SITE}/watch/ls-replay`);
    expect(sub[0].isLiveBroadcast).toBe(false);
    // The two claims PR #581 removed must stay removed.
    expect(ev.location).toBeUndefined();
    expect(ev.organizer).toBeUndefined();
  });

  it("gives the page a per-tournament og:image, falling back to the site default", async () => {
    const withThumb = await render(ENDED_ROW, "s", STREAMS);
    expect(withThumb).toContain('property="og:image" content="https://img.example/thumb.jpg"');

    // No stream → no thumbnail → buildHtml's DEFAULT_OG_IMAGE, not an empty tag.
    const without = await render(ENDED_ROW);
    expect(without).toContain('property="og:image" content="https://www.thepicklehub.net/og-image.png"');
  });

  it("keeps eventStatus a valid schema.org EventStatusType on finished events", async () => {
    // schema.org has no "EventCompleted" — an event that ran as planned is
    // EventScheduled. Guards against a well-meaning "fix".
    const html = await render(ENDED_ROW, "s", STREAMS);
    expect(html).toContain("https://schema.org/EventScheduled");
    expect(html).not.toContain("EventCompleted");
  });

  it("links out to the calendar, rankings and livestream hubs", async () => {
    const html = await render(ENDED_ROW, "s", STREAMS);
    expect(html).toContain(`href="${SITE}/vi/tournaments"`);
    expect(html).toContain(`href="${SITE}/vi/rankings"`);
    expect(html).toContain(`href="${SITE}/vi/live"`);
    expect(html).toContain(`href="${SITE}/vi/news"`);
  });

  it("still emits no hreflang — /vi/tournament/* 301s to the EN canonical", async () => {
    // SEO audit batch 5 made these pages single-locale on purpose. Adding
    // hreflang here would point it at a redirect (middleware.ts /vi/(org|
    // tournament|watch)/ → 301). Do not "restore" it without first giving the
    // renderer a real VI path.
    const html = await render(ENDED_ROW, "s", STREAMS);
    expect(html).not.toContain('rel="alternate" hreflang');
  });

  it("escapes markup coming from stream titles", async () => {
    const html = await render(ENDED_ROW, "s", [
      { ...STREAMS[0], title: '<script>alert(1)</script> & "quotes"' },
    ]);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});

/**
 * Hub-level cover for the 2026-08-16 site-audit fix: the SportsEvent graph on
 * /tournaments must only claim an organizer we can actually source. Before the
 * fix every curated event was hardcoded to "PPA Tour Asia", including the
 * Heineken Pickleball World Cup in Da Nang and the Hong Kong Slam.
 */
describe("renderTournaments — curated SportsEvent graph", () => {
  /** Supabase stub for the hub: from().select().in().order().limit() → { data }. */
  function hubClient(rows: Record<string, unknown>[]): SupabaseClient {
    const chain = {
      select: () => chain,
      in: () => chain,
      order: () => chain,
      limit: async () => ({ data: rows, error: null }),
    };
    return { from: () => chain } as unknown as SupabaseClient;
  }

  const sportsEvents = async (lang: "en" | "vi" = "en") => {
    const html = await (
      await renderTournaments(hubClient([]), SITE, lang === "vi" ? "/vi/tournaments" : "/tournaments", lang)
    ).text();
    const block = html.match(
      /<script type="application\/ld\+json">([\s\S]*?)<\/script>/,
    );
    expect(block, "hub emitted no JSON-LD").toBeTruthy();
    const graph = JSON.parse(block![1])["@graph"] as Record<string, unknown>[];
    return graph.filter((n) => n["@type"] === "SportsEvent");
  };

  it("omits organizer on the events PPA Tour Asia does not organise", async () => {
    const events = await sportsEvents();
    for (const name of ["Heineken Pickleball World Cup", "Hong Kong Slam"]) {
      const ev = events.find((e) => e.name === name);
      if (!ev) continue; // already past — the hub only graphs live + upcoming
      expect(ev.organizer, `${name} must not claim an organizer`).toBeUndefined();
    }
  });

  it("keeps the PPA Tour Asia attribution on the Opens it does organise", async () => {
    const events = await sportsEvents();
    const ppa = events.filter((e) => e.organizer !== undefined);
    for (const ev of ppa) {
      expect(ev.organizer).toEqual({
        "@type": "Organization",
        name: "PPA Tour Asia",
      });
    }
  });

  it("never emits an empty organizer object on either locale", async () => {
    for (const lang of ["en", "vi"] as const) {
      for (const ev of await sportsEvents(lang)) {
        if ("organizer" in ev) {
          expect((ev.organizer as { name?: string })?.name).toBeTruthy();
        }
      }
    }
  });
});
