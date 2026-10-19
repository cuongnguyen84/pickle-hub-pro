/**
 * Series A/B/C (nhánh Vàng/Bạc/Đồng) sau vòng bảng.
 *
 * Nhánh d lấy hạng 2d+1 và 2d+2 của MỌI bảng, rồi dựng đúng bracket cổ điển
 * (nhất A–nhì B…) như playoff 1 nhánh. Chỉ áp dụng khi bracket sạch, không cần
 * vé vớt (2/4/8 bảng) — bảng 3/6 cần wildcard nên chỉ có 1 nhánh.
 */
export const MAX_SERIES = 3;
export type SeriesStyle = "series" | "medal";

const CLEAN_GROUP_COUNTS = new Set([2, 4, 8]);

/** Số nhánh tối đa: mỗi nhánh cần 2 người từ mỗi bảng, bảng ít người nhất quyết định. */
export function maxSeries(groupCount: number, smallestGroup: number): number {
  if (!CLEAN_GROUP_COUNTS.has(groupCount)) return 1;
  return Math.max(1, Math.min(MAX_SERIES, Math.floor(smallestGroup / 2)));
}

const MEDAL_VI = ["Nhánh Vàng", "Nhánh Bạc", "Nhánh Đồng"];
const MEDAL_EN = ["Gold bracket", "Silver bracket", "Bronze bracket"];

export function seriesName(style: SeriesStyle | undefined, division: number, lang: "vi" | "en"): string {
  if (style === "medal") return (lang === "en" ? MEDAL_EN : MEDAL_VI)[division] ?? `Series ${"ABC"[division]}`;
  return `Series ${"ABC"[division] ?? division + 1}`;
}

/** "hạng 1–2" / "ranks 3–4" của nhánh d. */
export function seriesRanks(division: number): [number, number] {
  return [division * 2 + 1, division * 2 + 2];
}

interface RankedPlayer { id: string; group_id: string | null; matches_won: number; point_diff: number; points_for: number }

/**
 * Chia người theo nhánh: trả về [nhánh][bảng] = [hạng cao, hạng thấp].
 * Xếp hạng cùng khoá với getQualifiedPlayers / bảng xếp hạng hiển thị.
 */
export function splitIntoSeries<P extends RankedPlayer>(groupIds: string[], players: P[], count: number): P[][][] {
  const ranked = groupIds.map((gid) =>
    players
      .filter((p) => p.group_id === gid)
      .sort((a, b) => b.matches_won - a.matches_won || b.point_diff - a.point_diff || b.points_for - a.points_for),
  );
  return Array.from({ length: count }, (_, d) => ranked.map((r) => r.slice(d * 2, d * 2 + 2)));
}
