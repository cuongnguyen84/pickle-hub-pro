import { describe, expect, it } from "vitest";
import { formatJobHealthDigest, type JobHealthDigestSnapshot } from "../job-health-digest";

function snapshot(): JobHealthDigestSnapshot {
  return {
    generated_at: "2026-08-02T02:15:00Z",
    counts: { healthy: 8, warning: 1, failed: 1, pending: 0 },
    jobs: [
      {
        job_key: "news-fetcher",
        display_name: "News RSS fetcher",
        health_state: "healthy",
        last_activity_at: "2026-08-02T02:00:00Z",
        summary: "No new articles",
        metrics: { inserted: 0, sources_succeeded: 4 },
        error_message: null,
      },
      {
        job_key: "pro-tour-scraper",
        display_name: "Pro Tour results scraper",
        health_state: "warning",
        last_activity_at: "2026-08-02T00:00:00Z",
        summary: "One source changed [layout]",
        metrics: { matches_imported: 34, skipped_inactive: 3 },
        error_message: "Parser failed (source changed)",
      },
    ],
    facebook_posts: { thepicklehub: 3, ta_pickleball: 2 },
    news_sources: { active: 4, total: 5, needs_attention: ["ppa-tour"] },
  };
}

describe("formatJobHealthDigest", () => {
  it("always includes totals and the News/Pro Tour business metrics", () => {
    const text = formatJobHealthDigest(snapshot(), "2026-08-02");
    expect(text).toContain("8 healthy");
    expect(text).toContain("News: 0 bài mới · 4 nguồn OK");
    expect(text).toContain("Pro Tour: 34 trận · 3 event bỏ qua hợp lệ");
    expect(text).toContain("Facebook hôm nay: ThePickleHub 3 bài · TAPickleball 2 bài");
    expect(text).toContain("Nguồn tin: 4/5 active · cần xử lý: ppa\\-tour");
  });

  it("lists only warning/failed details and escapes Telegram MarkdownV2", () => {
    const text = formatJobHealthDigest(snapshot(), "2026-08-02");
    expect(text).toContain("Parser failed \\(source changed\\)");
    expect(text).not.toContain("No new articles");
  });
});
