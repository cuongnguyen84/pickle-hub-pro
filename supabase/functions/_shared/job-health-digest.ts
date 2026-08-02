export type JobHealthState = "healthy" | "warning" | "failed" | "pending";

export interface JobHealthDigestRow {
  job_key: string;
  display_name: string;
  health_state: JobHealthState;
  last_activity_at: string | null;
  summary: string | null;
  metrics: Record<string, unknown>;
  error_message: string | null;
}

export interface JobHealthDigestSnapshot {
  generated_at: string;
  counts: Record<JobHealthState, number>;
  jobs: JobHealthDigestRow[];
}

function escapeMarkdown(value: string): string {
  return value.replace(/([_*[\]()~`>#+\-=|{}.!\\])/g, "\\$1");
}

function metric(metrics: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = metrics[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return 0;
}

export function formatJobHealthDigest(
  snapshot: JobHealthDigestSnapshot,
  reportDate: string,
): string {
  const counts = snapshot.counts ?? { healthy: 0, warning: 0, failed: 0, pending: 0 };
  const lines = [
    `📊 *ThePickleHub Job Health — ${escapeMarkdown(reportDate)}*`,
    "",
    `✅ ${counts.healthy ?? 0} healthy · ⚠️ ${counts.warning ?? 0} warning · ❌ ${counts.failed ?? 0} failed · ⏳ ${counts.pending ?? 0} pending`,
  ];

  const news = snapshot.jobs.find((job) => job.job_key === "news-fetcher");
  const proTour = snapshot.jobs.find((job) => job.job_key === "pro-tour-scraper");
  const social = snapshot.jobs.find((job) => job.job_key === "social-poster");
  if (news || proTour || social) lines.push("", "*Kết quả chính:*");
  if (news) {
    const inserted = metric(news.metrics ?? {}, ["inserted", "items_inserted"]);
    const sources = metric(news.metrics ?? {}, ["sources_succeeded", "sources_total"]);
    lines.push(`• News: ${inserted} bài mới · ${sources} nguồn OK`);
  }
  if (proTour) {
    const matches = metric(proTour.metrics ?? {}, ["matches_imported", "matches_extracted"]);
    const matchesToday = metric(proTour.metrics ?? {}, ["matches_today"]);
    const events = metric(proTour.metrics ?? {}, ["events_processed", "due"]);
    const failed = metric(proTour.metrics ?? {}, ["events_failed", "failed"]);
    lines.push(`• Pro Tour: lượt gần nhất ${matches} trận · hôm nay ${matchesToday} trận · ${events} event${failed ? ` · ${failed} lỗi` : ""}`);
  }
  if (social) {
    const tph = metric(social.metrics ?? {}, ["thepicklehub_posts_today"]);
    const ta = metric(social.metrics ?? {}, ["ta_pickleball_posts_today"]);
    const noEligible = metric(social.metrics ?? {}, ["pages_no_eligible"]);
    lines.push(`• Facebook: ThePickleHub ${tph} bài · TA Pickleball ${ta} bài${noEligible ? " · không có bài đủ điều kiện" : ""}`);
  }

  const unhealthy = snapshot.jobs.filter((job) =>
    job.health_state === "failed" || job.health_state === "warning"
  );
  if (unhealthy.length > 0) {
    lines.push("", "*Cần chú ý:*");
    for (const job of unhealthy.slice(0, 8)) {
      const icon = job.health_state === "failed" ? "❌" : "⚠️";
      const reason = (job.error_message || job.summary || "Không có chi tiết").slice(0, 300);
      lines.push(`${icon} *${escapeMarkdown(job.display_name)}*: ${escapeMarkdown(reason)}`);
    }
  }

  lines.push("", `[Mở Job Health](${escapeMarkdown("https://www.thepicklehub.net/admin/jobs")})`);
  return lines.join("\n");
}
