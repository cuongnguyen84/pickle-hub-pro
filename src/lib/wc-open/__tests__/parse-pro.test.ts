// Parser contract for the five Pro individual events. The fixture is built from
// real /pwc2026/live match objects (men's singles in progress, doubles
// scheduled, one Vietnamese and one not each) plus a synthetic amateur match
// that must be filtered out — scope is pro_* only.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import {
  parseWcProLive,
  matchesToStore,
  isVietnameseName,
  PRO_CATEGORIES,
} from "../parse-pro";
import { ParseGuardError } from "../parse";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(
  resolve(here, "../../../../workers/wc-open-scraper/__fixtures__/live-pro-matches.html"),
  "utf8",
);

describe("isVietnameseName", () => {
  it("recognizes Vietnamese diacritics", () => {
    expect(isVietnameseName("Nguyễn Văn Linh")).toBe(true);
    expect(isVietnameseName("Trịnh Linh Giang")).toBe(true);
    expect(isVietnameseName("Đỗ Minh Quân")).toBe(true);
  });
  it("catches Vietnamese names written without diacritics, via surname", () => {
    expect(isVietnameseName("Nguyen Hoang Minh")).toBe(true);
    expect(isVietnameseName("Le Quoc Khanh")).toBe(true);
    expect(isVietnameseName("Tran Thanh Thien")).toBe(true);
  });
  it("does not match other Latin-script or CJK names, incl. shared accents", () => {
    expect(isVietnameseName("Emilien Burnel")).toBe(false);
    expect(isVietnameseName("Patrick Kawka")).toBe(false);
    expect(isVietnameseName("Yuta Yoshida")).toBe(false);
    expect(isVietnameseName("Josep C. Fabregas")).toBe(false);
    // the false positive the earlier "any accent" heuristic produced:
    expect(isVietnameseName("García Malbrán")).toBe(false);
    expect(isVietnameseName("Patricio Bertero")).toBe(false);
    expect(isVietnameseName("José Ramírez")).toBe(false);
    expect(isVietnameseName(null)).toBe(false);
  });
  it("still catches a doubles pair where one partner is Vietnamese", () => {
    expect(isVietnameseName("Chun Yu Liu / Nguyễn Văn Linh")).toBe(true);
  });
});

describe("parseWcProLive", () => {
  const result = parseWcProLive(fixture);

  it("keeps only the five pro_* events, dropping amateur/junior", () => {
    for (const m of result.matches) {
      expect(PRO_CATEGORIES).toContain(m.categoryId);
    }
    expect(result.matches.some((m) => m.categoryId.startsWith("amateur"))).toBe(false);
  });

  it("flags the Vietnamese entrant and not the foreign one", () => {
    const linh = result.matches.find((m) => (m.entryAName ?? "").includes("Nguyễn Văn Linh"));
    expect(linh?.isVietnam).toBe(true);
    const burnel = result.matches.find(
      (m) => (m.entryAName ?? "").includes("Emilien Burnel") || (m.entryBName ?? "").includes("Emilien Burnel"),
    );
    if (burnel) expect(burnel.isVietnam).toBe(false);
  });

  it("reads the live score and picks a leader for an in-progress match", () => {
    const live = result.matches.find((m) => m.status === "in_progress");
    expect(live).toBeTruthy();
    expect(live!.currentA).not.toBeNull();
    expect(live!.currentB).not.toBeNull();
    // leader matches the higher current score when no finished games decide it
    if (live!.games.length === 0 && live!.currentA !== live!.currentB) {
      expect(live!.leaderSide).toBe(live!.currentA! > live!.currentB! ? "A" : "B");
    }
  });

  it("leaves scheduled matches without a leader", () => {
    const sched = result.matches.find((m) => m.status === "scheduled");
    if (sched) expect(sched.leaderSide).toBeNull();
  });
});

describe("matchesToStore", () => {
  it("keeps in-progress and Vietnamese matches, drops foreign scheduled ones", () => {
    const store = matchesToStore(parseWcProLive(fixture).matches);
    expect(store.every((m) => m.status === "in_progress" || m.isVietnam)).toBe(true);
    // a foreign scheduled match must not be stored
    expect(store.some((m) => m.status === "scheduled" && !m.isVietnam)).toBe(false);
  });
});

describe("parseWcProLive guard", () => {
  it("throws when there are no flight chunks", () => {
    expect(() => parseWcProLive("<html><body>shell</body></html>")).toThrow(ParseGuardError);
  });
  it("throws when no pro category is present", () => {
    const payload = "2:" + JSON.stringify({ matches: [{ id: "amateur_x__m1", status: "in_progress", categoryId: "amateur_singles_mens" }] }) + "\n";
    const html = `<body><script>self.__next_f.push([1,${JSON.stringify(payload)}])</script></body>`;
    expect(() => parseWcProLive(html)).toThrow(/no Pro individual matches/);
  });
});
