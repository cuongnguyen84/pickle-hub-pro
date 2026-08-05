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
  facebook_posts?: {
    thepicklehub: number | null;
    ta_pickleball: number | null;
  };
  news_sources?: {
    active: number;
    total: number;
    needs_attention: string[];
  };
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
  if (news || proTour) lines.push("", "*Kết quả chính:*");
  if (news) {
    const inserted = metric(news.metrics ?? {}, ["inserted", "items_inserted"]);
    const sources = metric(news.metrics ?? {}, ["sources_succeeded", "sources_total"]);
    lines.push(`• News: ${inserted} bài mới · ${sources} nguồn OK`);
  }
  if (proTour) {
    const matches = metric(proTour.metrics ?? {}, ["matches_imported", "matches_extracted"]);
    const skipped = metric(proTour.metrics ?? {}, ["skipped", "skipped_inactive"]);
    lines.push(`• Pro Tour: ${matches} trận · ${skipped} event bỏ qua hợp lệ`);
  }
  if (snapshot.facebook_posts) {
    const primary = snapshot.facebook_posts.thepicklehub;
    const secondary = snapshot.facebook_posts.ta_pickleball;
    lines.push(
      `• Facebook hôm nay: ThePickleHub ${primary ?? "—"} bài · TAPickleball ${secondary ?? "—"} bài`,
    );
  }
  if (snapshot.news_sources) {
    // Nguồn tin tắt-có-ghi-chú phải hiện việc-cần-làm mỗi sáng cho tới khi được
    // xử lý — tắt câm là cách mất nguồn tin 5 tuần không ai biết.
    let sourcesLine = `• Nguồn tin: ${snapshot.news_sources.active}/${snapshot.news_sources.total} active`;
    if (snapshot.news_sources.needs_attention.length > 0) {
      sourcesLine += ` · cần xử lý: ${
        snapshot.news_sources.needs_attention.map((name) => escapeMarkdown(name)).join(", ")
      }`;
    }
    lines.push(sourcesLine);
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
