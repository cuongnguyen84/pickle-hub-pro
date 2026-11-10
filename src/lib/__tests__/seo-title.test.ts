// AUDIT-01 (2026-11-10) — <title> is budgeted in CHARACTERS, not UTF-8 bytes.
// The 60-byte budget cut every VI news title at ~40-50 chars, often mid-name.
import { describe, expect, it } from "vitest";
import { buildTitle, truncateForSeo, truncateTitleForSeo } from "../seo-title";

const chars = (s: string) => Array.from(s).length;
const bytes = (s: string) => new TextEncoder().encode(s).length;

// Live Googlebot h1s, 2026-11-10 17:16 ICT — prod served the byte-cut titles.
const LIVE_H1 = [
  "MLP Asia mùa đầu tiên khởi tranh: Viet Panthers ra quân tại Hong Kong, chờ ngày sân nhà 21/11 ở TP.HCM",
  "APP Asia Tour lần đầu đến Việt Nam: Ho Chi Minh City Open khởi tranh 10–13/12",
  "VTV Cup 2026: Giải pickleball truyền hình lớn cuối năm khởi tranh tại Hà Nội ngày 11–13/12",
  "Opendoor Pickleball World Championships Thời trang ấn tượng",
  "Đánh giá vợt pickleball Mizuno Acrostrike SX có độ ổn định cao nhất",
];

describe("truncateTitleForSeo", () => {
  it("returns short strings unchanged", () => {
    expect(truncateTitleForSeo("Lịch giải pickleball 2026")).toBe("Lịch giải pickleball 2026");
    expect(truncateTitleForSeo("")).toBe("");
  });

  it("cuts long VI strings at a word boundary within 60 chars", () => {
    const t = truncateTitleForSeo(LIVE_H1[0]);
    expect(t.endsWith("…")).toBe(true);
    expect(chars(t)).toBeLessThanOrEqual(60);
    const body = t.slice(0, -1);
    expect(LIVE_H1[0].startsWith(body)).toBe(true);
    expect(LIVE_H1[0][body.length]).toBe(" ");
  });

  it.each(LIVE_H1)("live h1 fixture: %s", (h1) => {
    const t = truncateTitleForSeo(h1);
    expect(chars(t)).toBeLessThanOrEqual(60);
    if (chars(h1) <= 60) {
      expect(t).toBe(h1);
      return;
    }
    expect(t.endsWith("…")).toBe(true);
    const body = t.slice(0, -1);
    expect(h1.startsWith(body)).toBe(true);
    // Ends on a whole word: the next source char is whitespace.
    expect(/\s/.test(h1[body.length])).toBe(true);
  });

  it("keeps whole names the byte budget used to cut", () => {
    const t1 = truncateTitleForSeo(LIVE_H1[0]);
    expect(t1).toContain("Viet Panthers");
    expect(t1.length).toBeGreaterThan(LIVE_H1[0].indexOf("Panthers") + "Panthers".length + 1);
    expect(t1).not.toMatch(/Panth…$/);
    const t2 = truncateTitleForSeo(LIVE_H1[1]);
    expect(t2).toContain("Ho Chi Minh");
    expect(t2).not.toMatch(/Ho Chi…$/);
  });

  it("counts code points, not UTF-16 units", () => {
    const t = truncateTitleForSeo("🏓".repeat(80));
    expect(chars(t)).toBe(60);
  });
});

describe("buildTitle character budget", () => {
  it("appends the brand suffix when the total fits 60 chars", () => {
    const raw = "Thể thức MLP Pickleball | Luật đồng đội"; // 39 chars, 51 bytes
    expect(buildTitle(raw)).toBe(raw + " | ThePickleHub");
  });

  it("never returns more than 60 chars", () => {
    for (const h1 of LIVE_H1) expect(chars(buildTitle(h1))).toBeLessThanOrEqual(60);
  });
});

describe("truncateForSeo stays byte-budgeted for descriptions", () => {
  it("clamps to 160 UTF-8 bytes", () => {
    const d = truncateForSeo("Giải pickleball đồng đội ".repeat(20), 160);
    expect(bytes(d)).toBeLessThanOrEqual(160);
  });
});
