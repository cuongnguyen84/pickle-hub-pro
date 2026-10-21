/**
 * Xếp sân + giờ cho playoff (1 hoặc nhiều nhánh).
 *
 * Thứ tự ưu tiên: vòng 1 nhánh A → vòng 1 nhánh B → … → vòng 2 nhánh A → …
 * Mỗi khung giờ lấp đủ sân bằng các trận ưu tiên cao nhất ĐÃ đánh được (các trận
 * dẫn vào nó xong ở khung trước), nên nhánh B vòng 1 ít trận thì sân trống được
 * bù bằng vòng 2 nhánh A. Trận BYE tự xong, không chiếm sân.
 */
export interface PlayoffSlotMatch {
  id: string;
  division: number;
  round: number;
  matchNumber: number;
  /** BYE / đã xong lúc tạo → không xếp */
  done: boolean;
  nextMatchId: string | null;
}

export interface PlayoffSlot { matchId: string; court: number; slot: number; startAt: string | null }

export function schedulePlayoff(
  matches: PlayoffSlotMatch[],
  courts: number[],
  startTime: string | null,
  matchDurationMinutes = 20,
): PlayoffSlot[] {
  if (!courts.length) return [];
  const feeders = new Map<string, string[]>();
  for (const m of matches) if (m.nextMatchId) feeders.set(m.nextMatchId, [...(feeders.get(m.nextMatchId) ?? []), m.id]);
  const byId = new Map(matches.map((m) => [m.id, m]));
  const queue = matches
    .filter((m) => !m.done)
    .sort((a, b) => a.round - b.round || a.division - b.division || a.matchNumber - b.matchNumber);
  const slotOf = new Map<string, number>(); // trận đã xếp → khung giờ
  const ready = (m: PlayoffSlotMatch, slot: number) =>
    (feeders.get(m.id) ?? []).every((f) => byId.get(f)?.done || (slotOf.has(f) && slotOf.get(f)! < slot));

  let startMins: number | null = null;
  const hm = startTime?.match(/^(\d{1,2}):(\d{2})/);
  if (hm) startMins = Number(hm[1]) * 60 + Number(hm[2]);
  const clock = (slot: number) => {
    if (startMins == null) return null;
    const t = startMins + slot * matchDurationMinutes;
    return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  };

  const out: PlayoffSlot[] = [];
  for (let slot = 0; queue.length; slot++) {
    const picked: PlayoffSlotMatch[] = [];
    for (const m of queue) {
      if (picked.length === courts.length) break;
      if (ready(m, slot)) picked.push(m);
    }
    picked.forEach((m, i) => {
      slotOf.set(m.id, slot);
      out.push({ matchId: m.id, court: courts[i], slot, startAt: clock(slot) });
      queue.splice(queue.indexOf(m), 1);
    });
    if (slot > 10_000) break; // ponytail: chặn vòng lặp vô hạn nếu dữ liệu next_match_id hỏng
  }
  return out;
}

/** Giờ bắt đầu playoff: ngay sau trận vòng bảng muộn nhất (hoặc giờ bắt đầu giải). */
export function playoffStartTime(groupStartTimes: (string | null)[], tableStart: string | null, matchDurationMinutes = 20): string | null {
  const mins = groupStartTimes
    .map((s) => s?.match(/^(\d{1,2}):(\d{2})/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => Number(m[1]) * 60 + Number(m[2]));
  if (!mins.length) return tableStart;
  const t = Math.max(...mins) + matchDurationMinutes;
  return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}
