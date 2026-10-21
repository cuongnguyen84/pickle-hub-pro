// Parser contract for the World Cup OPEN draw. The fixture is generated in the
// organizers' real RSC-flight shape (self.__next_f.push chunks, escaped JSON,
// bilingual name table) but carries the real 16-group / 64-team draw so a pass
// proves the parser survives both the format and the actual content. The guard
// tests use tiny synthetic pages because their whole point is a BROKEN shape.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { parseWcOpenDelegations, decodeFlight, ParseGuardError } from "../parse";

const here = dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(
  resolve(here, "../../../../workers/wc-open-scraper/__fixtures__/delegations-open-draw.html"),
  "utf8",
);

// A minimal well-formed flight page with a chosen group/team count, for guards.
const synth = (groups: Array<{ key: string; blocks: string[] }>, names = "") => {
  const namesJson = names || groups.flatMap((g) => g.blocks).map((s) => `"${s}":{"vi":"${s}","countryCode":"XX","en":"${s}"}`).join(",");
  const payload = `3:{"names":{${namesJson}},"tierDraws":{"vi":[{"tier":"open","categoryId":"open_team_coed","groups":${JSON.stringify(groups)}}]}}\n`;
  const chunk = `self.__next_f.push([1,${JSON.stringify(payload)}])`;
  return `<body><script>${chunk}</script></body>`;
};
const fullGroups = () =>
  Array.from({ length: 16 }, (_, i) => ({
    key: String.fromCharCode(65 + i),
    blocks: Array.from({ length: 4 }, (_, j) => `team_${i}_${j}`),
  }));

describe("parseWcOpenDelegations — real draw", () => {
  const result = parseWcOpenDelegations(fixture);

  it("extracts exactly 16 groups and 64 teams", () => {
    expect(result.groupCount).toBe(16);
    expect(result.teamCount).toBe(64);
  });

  it("reads Group A as Vietnam, Colombia, Cayman Islands, Chile", () => {
    const a = result.teams.filter((t) => t.group === "A").map((t) => t.slug);
    expect(a).toEqual(["viet_nam", "colombia", "cayman_islands", "chile"]);
  });

  it("carries bilingual names straight from the source, untranslated", () => {
    const vn = result.teams.find((t) => t.slug === "viet_nam");
    expect(vn?.nameVi).toBe("Việt Nam");
    expect(vn?.nameEn).toBe("Viet Nam");
    expect(vn?.countryCode).toBe("VN");
  });

  it("reads a seed when the source provides one", () => {
    expect(result.teams.find((t) => t.slug === "viet_nam")?.seed).toBe(1);
    // teams without a seed entry are null, not 0
    expect(result.teams.find((t) => t.slug === "chile")?.seed).toBeNull();
  });

  it("assigns every team to exactly one group of four", () => {
    const byGroup = new Map<string, number>();
    for (const t of result.teams) byGroup.set(t.group, (byGroup.get(t.group) ?? 0) + 1);
    expect(byGroup.size).toBe(16);
    expect([...byGroup.values()].every((n) => n === 4)).toBe(true);
  });
});

describe("decodeFlight", () => {
  it("returns empty string when there are no flight chunks", () => {
    expect(decodeFlight("<html><body>nothing here</body></html>")).toBe("");
  });
  it("unescapes chunk bodies the way Next.js does", () => {
    const html = `<script>self.__next_f.push([1,"hello \\"world\\""])</script>`;
    expect(decodeFlight(html)).toBe('hello "world"');
  });
});

describe("parseWcOpenDelegations — guards fire on a changed source", () => {
  it("throws when there are no flight chunks at all", () => {
    expect(() => parseWcOpenDelegations("<html><body>SPA shell</body></html>")).toThrow(ParseGuardError);
  });

  it("throws when the OPEN tier marker is gone", () => {
    const html = `<body><script>self.__next_f.push([1,${JSON.stringify('3:{"tierDraws":{"vi":[{"tier":"juniors","groups":[]}]}}\n')}])</script></body>`;
    expect(() => parseWcOpenDelegations(html)).toThrow(/OPEN tier marker/);
  });

  it("throws when the group count is not 16", () => {
    expect(() => parseWcOpenDelegations(synth(fullGroups().slice(0, 15)))).toThrow(/expected 16 OPEN groups, parsed 15/);
  });

  it("throws when a group has the wrong team count", () => {
    const g = fullGroups();
    g[0].blocks = ["only_one"];
    expect(() => parseWcOpenDelegations(synth(g))).toThrow(/expected 64 OPEN teams, parsed 61/);
  });

  it("does not throw on the exact 16×4 shape", () => {
    expect(() => parseWcOpenDelegations(synth(fullGroups()))).not.toThrow();
  });
});
