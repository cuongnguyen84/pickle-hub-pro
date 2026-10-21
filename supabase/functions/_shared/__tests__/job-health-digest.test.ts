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
        metrics: { matches_imported: 4, matches_today: 34, events_processed: 4, events_failed: 1 },
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
    facebook_posts: { thepicklehub: 3, ta_pickleball: 2 },
    news_sources: { active: 4, total: 5, needs_attention: ["ppa-tour"] },
  };
}

describe("formatJobHealthDigest", () => {
  it("always includes totals and the News/Pro Tour business metrics", () => {
    const text = formatJobHealthDigest(snapshot(), "2026-08-02");
    expect(text).toContain("8 healthy");
    expect(text).toContain("News: 0 bài mới · 4 nguồn OK");
    expect(text).toContain("Pro Tour: lượt gần nhất 4 trận · hôm nay 34 trận · 4 event · 1 lỗi");
    expect(text).toContain("Facebook: ThePickleHub 0 bài · TA Pickleball 0 bài · không có bài đủ điều kiện");
    expect(text).toContain("Nguồn tin: 4/5 active · cần xử lý: ppa\\-tour");
  });

  it("chỉ in MỘT dòng Facebook kể cả khi có cả job metrics lẫn facebook_posts", () => {
    // Merge 19/08 từng để cả hai nhánh cùng push: digest in Facebook hai lần
    // với hai con số khác nhau (0 bài từ job metrics, 3 bài từ facebook_posts).
    // Fixture dưới có ĐỦ cả hai nguồn, nên test này đỏ nếu lỗi đó quay lại.
    const text = formatJobHealthDigest(snapshot(), "2026-08-02");
    const facebookLines = text.split("\n").filter((line) => line.includes("Facebook"));
    expect(facebookLines).toHaveLength(1);
    // Và dòng còn lại phải là dòng nói được lý do, không phải dòng chỉ đếm.
    expect(facebookLines[0]).toContain("không có bài đủ điều kiện");
  });

  it("dùng facebook_posts khi không có job social-poster", () => {
    const snap = snapshot();
    snap.jobs = snap.jobs.filter((job) => job.job_key !== "social-poster");
    const text = formatJobHealthDigest(snap, "2026-08-02");
    expect(text).toContain("Facebook hôm nay: ThePickleHub 3 bài · TAPickleball 2 bài");
  });

  it("lists only warning/failed details and escapes Telegram MarkdownV2", () => {
    const text = formatJobHealthDigest(snapshot(), "2026-08-02");
    expect(text).toContain("Parser failed \\(source changed\\)");
    expect(text).not.toContain("No new articles");
  });
});
