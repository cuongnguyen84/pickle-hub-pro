import { describe, expect, it } from "vitest";
import { renderTournamentDetail } from "../tournaments";
import type { SupabaseClient } from "../../supabase";

const SITE = "https://www.thepicklehub.net";

type Row = Record<string, unknown> | null;

/** Minimal Supabase stub: from().select().eq().single() → { data }. */
function stubClient(row: Row): SupabaseClient {
  const chain = {
    select: () => chain,
    eq: () => chain,
    single: async () => ({ data: row, error: null }),
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

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

const render = async (row: Row, slug = "s") =>
  (await renderTournamentDetail(stubClient(row), slug, SITE)).text();

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
});
