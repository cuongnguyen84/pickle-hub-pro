// ============================================================================
// Telegram reporting for wc-open-scraper: what it did, and what to do when it
// could not.
//
// Two shapes of message, deliberately not one.
//
//   * An hourly digest of the numbers. The cron fires every minute, so a
//     message per run would be ~840 a day — Telegram rate-limits that, and a
//     person mutes it long before Telegram does. One message an hour is small
//     enough to keep reading for eight days.
//
//   * An immediate alert when a cycle fails, de-duplicated by fingerprint. A
//     source outage repeats identically every minute; sending it 60 times an
//     hour trains the reader to ignore the channel right before the message
//     that matters.
//
// An alert that only says what broke wastes the interruption. Each one carries
// the layer, the likeliest cause, and a command that can actually be run — the
// point is to be actionable from a phone, mid-tournament, without opening the
// repo. Where a failure is harmless (the worker keeps existing rows, pruning is
// blocked until the source recovers) the message says so, because "is anything
// lost" is the first question and the answer is usually no.
// ============================================================================

export interface Diagnosis {
  /** Which layer to look at first. */
  layer: string;
  /** The likeliest cause, in plain Vietnamese. */
  cause: string;
  /** Something to actually run or check. */
  fix: string;
  /** Whether stored data is at risk. Most failures are self-healing. */
  impact: string;
}

const LIVE_URL = "https://www.sporttora.com/pwc2026/live";

/**
 * Map a worker error string to a diagnosis. Matches on the messages the worker
 * itself throws — keep the two in step; an unrecognised error still returns a
 * usable message rather than nothing.
 */
export function diagnose(error: string): Diagnosis {
  const e = error.toLowerCase();

  if (e.includes("parse guard")) {
    return {
      layer: "Nguồn (sporttora)",
      cause:
        "Trang nguồn đổi cấu trúc HTML nên parser không nhận đủ dữ liệu. Guard đã chặn không cho ghi đè bằng dữ liệu rỗng.",
      fix: `curl -sS -A "ThePickleHubBot/1.0" "${LIVE_URL}" | head -c 3000 — so với src/lib/wc-open/parse-pro.ts rồi chỉnh selector.`,
      impact: "Không mất dữ liệu: các dòng đã lưu được giữ nguyên, trang kết quả vẫn hiển thị bản cũ.",
    };
  }

  const live = error.match(/live fetch (\d+)/i);
  if (live) {
    const code = live[1];
    return {
      layer: "Nguồn (sporttora /live)",
      cause:
        code.startsWith("5") || code === "429"
          ? "Trang nguồn đang lỗi hoặc chặn tần suất. Thường tự hết sau vài phút."
          : `Trang nguồn trả HTTP ${code} — có thể đã đổi URL hoặc chặn User-Agent.`,
      fix: `curl -sS -o /dev/null -w "%{http_code}" -A "ThePickleHubBot/1.0" "${LIVE_URL}"`,
      impact: "Chu kỳ này không ghi gì. Dữ liệu cũ giữ nguyên; nếu lặp quá 30 phút thì trang bắt đầu cũ thật.",
    };
  }

  if (e.startsWith("brackets:") || e.includes("bracket")) {
    return {
      layer: "Nguồn (trang nhánh đấu)",
      cause:
        "Một hoặc nhiều trang bracket không tải được. Có thể do sporttora rate-limit khi 5 trang được kéo liên tiếp.",
      fix: "Mở trang bracket của nội dung được nêu trong lỗi bằng trình duyệt. Nếu vào được thì gần như chắc là rate-limit và tự hết.",
      impact:
        "An toàn theo thiết kế: khi bracket lỗi, worker KHÔNG prune, nên không trận nào bị xóa nhầm. Chỉ là kết quả mới chậm vào bảng.",
    };
  }

  const sb = error.match(/(select|upsert|delete|mark completed) pro (\d+)/i);
  if (sb) {
    const [, op, code] = sb;
    const auth = code === "401" || code === "403";
    return {
      layer: "Supabase (PostgREST)",
      cause: auth
        ? "Service role key bị từ chối — nhiều khả năng key đã bị xoay vòng mà worker chưa được cập nhật."
        : `PostgREST trả HTTP ${code} khi ${op}. Thường là project đang quá tải hoặc bảo trì.`,
      fix: auth
        ? "cd workers/wc-open-scraper && wrangler secret put SUPABASE_SERVICE_ROLE_KEY (lấy key mới từ Supabase dashboard → API keys)."
        : 'curl -sS -H "apikey: $KEY" "$SUPABASE_URL/rest/v1/wc_pro_matches?select=match_id&limit=1" — nếu cũng lỗi thì là phía Supabase, chờ và theo dõi status page.',
      impact: auth
        ? "Worker không ghi được gì cho tới khi key được cập nhật. Trang kết quả đứng yên."
        : "Chu kỳ này hỏng, chu kỳ sau thử lại. Không mất dữ liệu đã lưu.",
    };
  }

  if (e.includes("delegations fetch")) {
    return {
      layer: "Nguồn (trang đoàn tham dự)",
      cause: "Trang danh sách đội tuyển không tải được. Chỉ ảnh hưởng bảng đội, không ảnh hưởng kết quả Pro.",
      fix: 'curl -sS -o /dev/null -w "%{http_code}" -A "ThePickleHubBot/1.0" "https://www.sporttora.com/pwc2026/delegations"',
      impact: "Bảng kết quả Pro không bị ảnh hưởng.",
    };
  }

  if (e.includes("timeout") || e.includes("network") || e.includes("fetch failed")) {
    return {
      layer: "Mạng",
      cause: "Request không hoàn tất trong giới hạn của Worker. Thường là nguồn chậm chứ không phải worker hỏng.",
      fix: "Xem log: wrangler tail wc-open-scraper. Nếu lặp lại đều đặn thì trang nguồn đang chậm bất thường.",
      impact: "Chu kỳ này bỏ qua; chu kỳ sau thử lại sau một phút.",
    };
  }

  return {
    layer: "Chưa xác định",
    cause: "Lỗi không khớp mẫu nào đã biết — cần xem log để biết tầng nào hỏng.",
    fix: "wrangler tail wc-open-scraper --format pretty",
    impact: "Chưa rõ. Kiểm tra số dòng trong bảng trước khi kết luận có mất dữ liệu hay không.",
  };
}

/**
 * A stable key for "the same problem", so a repeating failure is reported once
 * per cooldown rather than once per minute. Digits are stripped from the tail
 * of source errors so `brackets: pro_mixed fetch 503` and `... 502` collapse.
 */
export function fingerprint(error: string): string {
  const e = error.toLowerCase();
  if (e.includes("parse guard")) return "parse-guard";
  if (/live fetch/i.test(error)) return "live-fetch";
  if (e.startsWith("brackets:")) return "brackets";
  const sb = error.match(/(select|upsert|delete|mark completed) pro/i);
  if (sb) return `supabase-${sb[1].toLowerCase().replace(/\s+/g, "-")}`;
  if (e.includes("delegations fetch")) return "delegations";
  if (e.includes("timeout") || e.includes("network") || e.includes("fetch failed")) return "network";
  return "unknown";
}

export interface DigestState {
  /** UTC hour this accumulator belongs to, as YYYY-MM-DDTHH. */
  hourKey: string;
  cycles: number;
  errorCycles: number;
  proWritten: number;
  teamsWritten: number;
  /** Live-match count seen on the most recent cycle. */
  liveNow: number;
  /** Completed count the brackets reported on the most recent cycle. */
  completedNow: number;
  /** Completed count on the first cycle of the hour, for the delta. */
  completedAtStart: number | null;
  /** Distinct error messages seen this hour, capped. */
  errors: string[];
}

export function emptyDigest(hourKey: string): DigestState {
  return {
    hourKey,
    cycles: 0,
    errorCycles: 0,
    proWritten: 0,
    teamsWritten: 0,
    liveNow: 0,
    completedNow: 0,
    completedAtStart: null,
    errors: [],
  };
}

/** UTC hour bucket key, e.g. "2026-09-01T08". */
export function hourKeyOf(now: Date): string {
  return now.toISOString().slice(0, 13);
}

/** "15:00–16:00" in Vietnam time, from a UTC hour key. */
export function vnHourRange(hourKey: string): string {
  const utcHour = Number(hourKey.slice(11, 13));
  const start = (utcHour + 7) % 24;
  const end = (start + 1) % 24;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(start)}:00–${p(end)}:00`;
}

/**
 * The hourly message. Numbers first — someone glancing at a phone wants to know
 * the scraper is alive and how much moved, not to read prose.
 */
export function formatDigest(d: DigestState, storedTotal: number | null): string {
  const gained =
    d.completedAtStart == null ? null : Math.max(0, d.completedNow - d.completedAtStart);
  const lines = [
    `📊 ${vnHourRange(d.hourKey)} giờ VN`,
    `Quét ${d.cycles} lượt${d.errorCycles ? `, ${d.errorCycles} lượt lỗi` : ", không lỗi"}.`,
    `Đang thi đấu: ${d.liveNow}${gained == null ? "" : ` · kết thúc trong giờ: ${gained}`}`,
    `Đã ghi: ${d.proWritten} dòng Pro${d.teamsWritten ? `, ${d.teamsWritten} dòng đội tuyển` : ""}`,
  ];
  if (storedTotal != null) lines.push(`Tổng đã lưu: ${storedTotal} trận`);
  if (d.errors.length) lines.push(`Lỗi trong giờ: ${d.errors.join(" | ")}`);
  return lines.join("\n");
}

/** The immediate message when a cycle fails. */
export function formatAlert(error: string, d: Diagnosis, suppressedFor: number): string {
  return [
    `🔴 Lỗi: ${error}`,
    ``,
    `Tầng: ${d.layer}`,
    `Nguyên nhân khả dĩ: ${d.cause}`,
    `Ảnh hưởng: ${d.impact}`,
    `Cách kiểm tra/sửa:`,
    d.fix,
    ``,
    `(Lỗi lặp lại sẽ im trong ${suppressedFor} phút tới để không spam.)`,
  ].join("\n");
}
