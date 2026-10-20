import { describe, expect, it } from "vitest";
import { uniquePlayoffMatches } from "@/lib/quick-table-playoff-dedupe";

describe("uniquePlayoffMatches", () => {
  it("keeps match 1 of a later round", () => {
    const rows = uniquePlayoffMatches([
      { playoff_division: 0, playoff_round: 1, playoff_match_number: 1, id: "qf" },
      { playoff_division: 0, playoff_round: 2, playoff_match_number: 1, id: "sf" },
      { playoff_division: 0, playoff_round: 1, playoff_match_number: 1, id: "dup" },
    ]);
    expect(rows.map((r) => r.id)).toEqual(["qf", "sf"]);
  });
});
