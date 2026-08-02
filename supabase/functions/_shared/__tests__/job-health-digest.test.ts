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
        metrics: { matches_imported: 34, events_processed: 4, events_failed: 1 },
        error_message: "Parser failed (source changed)",
      },
      {
        job_key: "social-poster",
        display_name: "Facebook social poster",
        health_state: "healthy",
        last_activity_at: "2026-08-02T02:10:00Z",
        summary: "Không có bài đủ điều kiện",
        metrics: { thepicklehub_posts_today: 0, ta_pickleball_posts_today: 0, pages_no_eligible: 2 },
        error_message: null,
      },
    ],
  };
}

describe("formatJobHealthDigest", () => {
  it("always includes totals and the News/Pro Tour business metrics", () => {
    const text = formatJobHealthDigest(snapshot(), "2026-08-02");
    expect(text).toContain("8 healthy");
    expect(text).toContain("News: 0 bài mới · 4 nguồn OK");
    expect(text).toContain("Pro Tour: 34 trận · 4 event · 1 lỗi");
    expect(text).toContain("Facebook: ThePickleHub 0 bài · TA Pickleball 0 bài · không có bài đủ điều kiện");
  });

  it("lists only warning/failed details and escapes Telegram MarkdownV2", () => {
    const text = formatJobHealthDigest(snapshot(), "2026-08-02");
    expect(text).toContain("Parser failed \\(source changed\\)");
    expect(text).not.toContain("No new articles");
  });
});
