import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "../../supabase";
import { renderFeed } from "../feed";

const SITE = "https://www.thepicklehub.net";
const NOW = Date.parse("2026-11-22T00:00:00Z");

function stub(timeline: unknown[], recent: unknown[] = []): SupabaseClient {
  return {
    rpc: async (name: string) => {
      if (name === "get_feed_recent_results") return { data: recent, error: null };
      if (name === "get_feed_timeline") return { data: timeline, error: null };
      return { data: null, error: { message: name } };
    },
  } as unknown as SupabaseClient;
}

const posts = [
  {
    slug: "paddle-rules",
    publishedDate: "2026-11-20",
    titleEn: "What the paddle rule changes",
    titleVi: "Luật vợt thay đổi thế nào",
    metaDescriptionEn: "English excerpt",
    excerptVi: "Tóm tắt tiếng Việt",
  },
];

const timeline = [
  {
    item_type: "blog",
    item_id: "vi-1",
    slug: "luat-vot",
    title: "Tiêu đề tiếng Việt",
    excerpt: "tóm tắt",
    published_at: "2026-11-20T00:00:00.000Z",
    ranked_at: "2026-11-20T00:00:00.000Z",
    score: 1,
  },
  {
    item_type: "result",
    item_id: "final-1",
    slug: "share-abc",
    source_provider: "quick_table",
    source_url: "/tools/quick-tables/share-abc",
    tournament_name: "Sunday Cup",
    winning_team: "a",
    participants: [],
    team_a_score: [11],
    team_b_score: [7],
    published_at: "2026-11-20T00:00:00.000Z",
    ranked_at: "2026-11-20T00:00:00.000Z",
    score: 5,
  },
  {
    item_type: "match",
    item_id: "semi-1",
    slug: "qt-abcdef12-11111111",
    tournament_name: "Sunday Cup",
    winning_team: "a",
    participants: [],
    team_a_score: [11],
    team_b_score: [5],
    published_at: "2026-11-20T00:00:00.000Z",
    ranked_at: "2026-11-20T00:00:00.000Z",
    score: 4,
  },
  {
    item_type: "match",
    item_id: "semi-2",
    slug: "qt-99999999-22222222",
    tournament_name: "Monday Cup",
    winning_team: "b",
    participants: [],
    team_a_score: [11],
    team_b_score: [8],
    published_at: "2026-11-20T00:00:00.000Z",
    ranked_at: "2026-11-20T00:00:00.000Z",
    score: 3,
  },
];

describe("renderFeed language and quick-table copies", () => {
  it("shows English blog links on /feed and Vietnamese links on /vi/feed", async () => {
    const en = await (await renderFeed(stub(timeline), SITE, "en", { nowMs: NOW, posts })).text();
    expect(en).toContain("What the paddle rule changes");
    expect(en).toContain(`${SITE}/blog/paddle-rules`);
    expect(en).not.toContain("Tiêu đề tiếng Việt");
    expect(en).not.toContain("/vi/blog/luat-vot");

    const vi = await (await renderFeed(stub(timeline), SITE, "vi", { nowMs: NOW, posts })).text();
    expect(vi).toContain("Tiêu đề tiếng Việt");
    expect(vi).toContain(`${SITE}/vi/blog/luat-vot`);
    expect(vi).not.toContain(`${SITE}/blog/paddle-rules`);
  });

  it("drops the qt-* semifinal when the final card for that table is rendered", async () => {
    const html = await (await renderFeed(stub(timeline), SITE, "en", { nowMs: NOW, posts })).text();
    expect(html).toContain("/tools/quick-tables/share-abc");
    expect(html).not.toContain("qt-abcdef12-11111111");
    expect(html).toContain("qt-99999999-22222222");
  });

  it("falls back to the Vietnamese article when no English post is in the window", async () => {
    const html = await (await renderFeed(stub(timeline), SITE, "en", {
      nowMs: NOW,
      posts: [{ ...posts[0], publishedDate: "2020-01-01" }],
    })).text();
    expect(html).toContain("Tiêu đề tiếng Việt");
    expect(html).toContain(`${SITE}/vi/blog/luat-vot`);
  });
});
