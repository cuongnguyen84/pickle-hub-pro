// Tournament cluster links: schedule ↔ results ↔ how-to-watch ↔ rankings ↔ tools.
// Pure + import-free on purpose: ViBlogPost uses it without pulling the blog
// metadata chunk, and the SSR renderers use it without React. The caller says
// which EN slugs actually exist (`resolve`), so a sibling that was never
// published is skipped instead of linked as a 404.

export type ClusterLink = { text: string; path: string };
type Lang = "en" | "vi";

const GENERIC_WATCH = "how-to-watch-ppa-tour-live-2026";

const LABELS: Record<Lang, Record<string, string>> = {
  en: { schedule: "Schedule", results: "Results", watch: "How to watch live", rankings: "Rankings", tools: "Free tournament tools" },
  vi: { schedule: "Lịch thi đấu", results: "Kết quả", watch: "Cách xem trực tiếp", rankings: "Bảng xếp hạng", tools: "Công cụ tổ chức giải" },
};

/** EN slugs a results/schedule post may link to; [] for any other post. */
export function clusterCandidates(enSlug: string): string[] {
  const base = enSlug.match(/^(.+)-(results|schedule)$/)?.[1];
  return base ? [`${base}-schedule`, `${base}-results`, `${base}-how-to-watch`, GENERIC_WATCH] : [];
}

/**
 * Ordered cluster for one post. `resolve(enSlug)` returns the localized path
 * when that post exists, else undefined. Deliberately does not drop links the
 * intro already carries (coverage `related`): the row stays the same shape on
 * every tournament page.
 */
export function buildTournamentClusterLinks(
  enSlug: string,
  language: Lang,
  resolve: (enSlug: string) => string | undefined,
): ClusterLink[] {
  const [schedule, results, watch, genericWatch] = clusterCandidates(enSlug);
  if (!schedule) return [];
  const t = LABELS[language];
  const p = language === "vi" ? "/vi" : "";
  // Event-specific watch guide first; the PPA guide is the fallback.
  return [
    { text: t.schedule, path: schedule !== enSlug ? resolve(schedule) : undefined },
    { text: t.results, path: results !== enSlug ? resolve(results) : undefined },
    { text: t.watch, path: resolve(watch) ?? resolve(genericWatch) },
    { text: t.rankings, path: p + "/rankings" },
    { text: t.tools, path: p + "/tools" },
  ].filter((l): l is ClusterLink => !!l.path);
}
