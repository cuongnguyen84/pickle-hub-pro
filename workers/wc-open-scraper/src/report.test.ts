// The reporting layer's job is to be readable on a phone during a tournament.
// What is worth pinning: a repeating outage collapses to one fingerprint (so
// the cooldown actually suppresses it), every known failure yields an
// actionable fix rather than a restatement of the error, and the hourly digest
// converts UTC buckets to Vietnam hours — the reader is in Da Nang, not UTC.

import { describe, expect, it } from "vitest";
import {
  diagnose,
  emptyDigest,
  fingerprint,
  formatAlert,
  formatDigest,
  hourKeyOf,
  vnHourRange,
} from "./report";

describe("fingerprint", () => {
  it("collapses the same outage across differing status codes", () => {
    expect(fingerprint("brackets: pro_mixed fetch 503")).toBe(
      fingerprint("brackets: pro_singles_mens fetch 502"),
    );
  });

  it("keeps different layers apart", () => {
    const seen = new Set(
      [
        "pro parse guard: too few categories",
        "live fetch 503",
        "brackets: pro_mixed fetch 503",
        "select pro 401",
        "upsert pro 500",
        "delegations fetch 404",
        "network timeout",
      ].map(fingerprint),
    );
    // Supabase select and upsert are separate problems; so is everything else.
    expect(seen.size).toBe(7);
  });
});

describe("diagnose", () => {
  it("tells the reader nothing is lost when the parse guard trips", () => {
    const d = diagnose("pro parse guard: only 1 of 5 categories covered");
    expect(d.layer).toContain("Nguồn");
    expect(d.impact).toContain("Không mất dữ liệu");
    expect(d.fix).toContain("curl");
  });

  it("says a bracket failure blocks pruning rather than deleting anything", () => {
    const d = diagnose("brackets: pro_mixed fetch 503");
    expect(d.impact).toContain("KHÔNG prune");
  });

  it("reads a 401 from Supabase as a rotated key and names the command", () => {
    const d = diagnose("select pro 401");
    expect(d.cause).toContain("xoay vòng");
    expect(d.fix).toContain("wrangler secret put SUPABASE_SERVICE_ROLE_KEY");
  });

  it("does not claim a 500 is an auth problem", () => {
    const d = diagnose("upsert pro 500");
    expect(d.cause).not.toContain("xoay vòng");
    expect(d.fix).toContain("curl");
  });

  it("still returns something actionable for an unrecognised error", () => {
    const d = diagnose("something nobody wrote a branch for");
    expect(d.fix).toContain("wrangler tail");
    expect(d.impact).not.toBe("");
  });
});

describe("vnHourRange", () => {
  it("shifts a UTC bucket into Vietnam hours", () => {
    expect(vnHourRange("2026-09-01T08")).toBe("15:00–16:00");
  });

  it("wraps past midnight without producing hour 24", () => {
    expect(vnHourRange("2026-09-01T17")).toBe("00:00–01:00");
  });
});

describe("formatDigest", () => {
  const base = {
    ...emptyDigest("2026-09-01T03"),
    cycles: 60,
    proWritten: 41,
    teamsWritten: 0,
    liveNow: 4,
    completedNow: 512,
    completedAtStart: 475,
  };

  it("leads with the numbers and reports the hour's gain", () => {
    const text = formatDigest(base, 604);
    expect(text).toContain("10:00–11:00 giờ VN");
    expect(text).toContain("Quét 60 lượt, không lỗi.");
    expect(text).toContain("Đang thi đấu: 4");
    expect(text).toContain("kết thúc trong giờ: 37");
    expect(text).toContain("Tổng đã lưu: 604 trận");
  });

  it("never reports a negative gain when the source revises a count down", () => {
    const text = formatDigest({ ...base, completedNow: 470, completedAtStart: 475 }, null);
    expect(text).toContain("kết thúc trong giờ: 0");
    expect(text).not.toContain("-5");
  });

  it("surfaces the hour's errors instead of hiding them behind a count", () => {
    const text = formatDigest({ ...base, errorCycles: 3, errors: ["live fetch 503"] }, null);
    expect(text).toContain("3 lượt lỗi");
    expect(text).toContain("live fetch 503");
  });

  it("omits the stored total rather than printing a placeholder", () => {
    expect(formatDigest(base, null)).not.toContain("Tổng đã lưu");
  });
});

describe("formatAlert", () => {
  it("carries the error, the layer, the impact and a command", () => {
    const text = formatAlert("live fetch 503", diagnose("live fetch 503"), 30);
    expect(text).toContain("live fetch 503");
    expect(text).toContain("Tầng:");
    expect(text).toContain("Ảnh hưởng:");
    expect(text).toContain("curl");
    expect(text).toContain("30 phút");
  });
});

describe("hourKeyOf", () => {
  it("buckets by UTC hour", () => {
    expect(hourKeyOf(new Date("2026-09-01T08:59:59Z"))).toBe("2026-09-01T08");
    expect(hourKeyOf(new Date("2026-09-01T09:00:00Z"))).toBe("2026-09-01T09");
  });
});
