import { describe, it, expect } from "vitest";
import {
  describeUnimportableSlots,
  isPlaceholderExternalId,
  normalizeExternalId,
} from "../placeholder-slots";

// Regression cover for the 2026-09-08 production failure: the PPA Asia 1000
// Leapmotor Kuala Lumpur Cup bracket published an undrawn round, every
// undecided slot came back as external_id "tbd", both slots on one side
// resolved to the SAME ghost profile, and the second match_participants row
// hit UNIQUE (match_id, player_id). All 5 watchlist rows returned 500 and the
// event imported nothing.

describe("normalizeExternalId", () => {
  it("lowercases and collapses separators", () => {
    expect(normalizeExternalId("T.B.D.")).toBe("t-b-d");
    expect(normalizeExternalId("Ryan_Ng")).toBe("ryan-ng");
    expect(normalizeExternalId("  Ryan-Ng  ")).toBe("ryan-ng");
  });

  it("strips leading and trailing separators", () => {
    expect(normalizeExternalId("--tbd--")).toBe("tbd");
  });
});

describe("isPlaceholderExternalId", () => {
  it.each(["tbd", "TBD", " tbd ", "tbd-tbd", "tbd_tbd", "TBD TBD", "bye", "BYE", "tba", "n/a"])(
    "%s is a placeholder",
    (id) => {
      expect(isPlaceholderExternalId(id)).toBe(true);
    },
  );

  it("treats empty, whitespace-only and non-string ids as placeholders", () => {
    expect(isPlaceholderExternalId("")).toBe(true);
    expect(isPlaceholderExternalId("   ")).toBe(true);
    expect(isPlaceholderExternalId("---")).toBe(true);
    expect(isPlaceholderExternalId(null)).toBe(true);
    expect(isPlaceholderExternalId(undefined)).toBe(true);
  });

  it("catches a repeated placeholder token", () => {
    expect(isPlaceholderExternalId("tbd-tbd-tbd")).toBe(true);
    expect(isPlaceholderExternalId("bye-bye")).toBe(true);
  });

  it.each([
    "park-seong-yong",
    "syed-uzair-sufi",
    "he-phoenix",
    "ryan-ng",
    "luc-pham",
    "george-wall",
    // Real slugs that merely start with the placeholder letters must survive.
    "tbdurand",
    "tbd-nguyen-van-a",
    "byeong-ho-kim",
  ])("%s is a real player", (id) => {
    expect(isPlaceholderExternalId(id)).toBe(false);
  });
});

describe("describeUnimportableSlots", () => {
  it("passes a fully drawn doubles match", () => {
    expect(
      describeUnimportableSlots(
        ["park-seong-yong", "syed-uzair-sufi"],
        ["he-phoenix", "ryan-ng"],
      ),
    ).toBeNull();
  });

  it("passes a singles match", () => {
    expect(describeUnimportableSlots(["luc-pham"], ["george-wall"])).toBeNull();
  });

  it("rejects the exact KL Cup shape — team two is ['tbd','tbd']", () => {
    const reason = describeUnimportableSlots(
      ["luc-pham", "george-wall"],
      ["tbd", "tbd"],
    );
    expect(reason).toContain("undecided slot");
  });

  it("rejects a half-drawn team", () => {
    expect(
      describeUnimportableSlots(["luc-pham", "tbd"], ["he-phoenix", "ryan-ng"]),
    ).toContain("undecided slot");
  });

  it("rejects a bye", () => {
    expect(describeUnimportableSlots(["luc-pham", "george-wall"], ["bye", "bye"])).toContain(
      "undecided slot",
    );
  });

  it("rejects the same player twice on one team", () => {
    expect(
      describeUnimportableSlots(["luc-pham", "luc-pham"], ["he-phoenix", "ryan-ng"]),
    ).toContain("duplicate player slot");
  });

  it("rejects the same player on both teams, however it is spelled", () => {
    expect(
      describeUnimportableSlots(["luc-pham", "george-wall"], ["Luc_Pham", "ryan-ng"]),
    ).toContain("duplicate player slot");
  });

  it("rejects an empty side", () => {
    expect(describeUnimportableSlots([], ["he-phoenix", "ryan-ng"])).toBe("empty team");
    expect(describeUnimportableSlots(["luc-pham"], [])).toBe("empty team");
  });
});
