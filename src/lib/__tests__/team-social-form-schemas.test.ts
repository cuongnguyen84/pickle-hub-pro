import { describe, expect, it } from "vitest";
import { z } from "zod/v4";
import { zodResolver } from "@hookform/resolvers/zod";
import { buildTeamSchema, buildTeamMemberSchema, buildVenueSchema, buildGhostProfileSchema } from "../team-social-form-schemas";
import { DuprSubmitResponseSchema } from "@/contracts/duprMatchSubmit";

// Classic schemas are test-only references to the pre-optimization contracts.
const classicTeam = z.object({
  team_name: z.string().min(2, "Team required").max(50),
  captain_name: z.string().min(2, "Captain required").max(50),
  captain_gender: z.enum(["male", "female"]),
  captain_skill_level: z.number().min(1).max(8).optional(),
});
const classicMember = z.object({
  player_name: z.string().min(2, "Name required").max(50),
  gender: z.enum(["male", "female"]),
  skill_level: z.number().min(1).max(8).optional(),
});
const classicVenue = (language: "vi" | "en") => z.object({
  name: z.string().min(2, language === "vi" ? "Tên sân tối thiểu 2 ký tự" : "Venue name needs at least 2 characters").max(100),
  name_vi: z.string().max(100).optional(),
  city: z.string().min(1, language === "vi" ? "Chọn thành phố" : "Pick a city"),
  district: z.string().max(60).optional(),
  address: z.string().max(200).optional(),
  num_courts: z.coerce.number().int().min(0).max(50).optional(),
  surface_type: z.string().optional(),
  is_indoor: z.boolean().default(false),
});
const classicGhost = (language: "vi" | "en") => z.object({
  display_name: z.string().min(2, language === "vi" ? "Tên tối thiểu 2 ký tự" : "Name needs at least 2 characters").max(50),
  phone: z.string().regex(/^(0\d{9}|\+84\d{9})$/, language === "vi" ? "Số điện thoại VN: 0xxxxxxxxx hoặc +84xxxxxxxxx" : "VN phone format: 0xxxxxxxxx or +84xxxxxxxxx"),
  city: z.string().min(1, language === "vi" ? "Chọn thành phố" : "Pick a city"),
});

function outcome(schema: { safeParse: (value: unknown) => { success: boolean; data?: unknown; error?: { issues: unknown[] } } }, value: unknown) {
  const parsed = schema.safeParse(value);
  return parsed.success ? { data: parsed.data } : { issues: parsed.error?.issues };
}
const invalidValues = [undefined, null, "", "x", "x".repeat(201), -1, 0, 1, 1.5, 8, 9, 50, 51, Infinity, NaN, true, false, [], {}, "4", "0", "50", "1.5", "not-a-number"];

describe("tree-shaken form schema compatibility", () => {
  const team = { team_name: "Dragons", captain_name: "Captain", captain_gender: "male", captain_skill_level: 4 };
  const member = { player_name: "Player", gender: "female", skill_level: 4 };
  it("preserves team and roster acceptance, limits, optionality, and exact field errors", () => {
    for (const [schema, reference, valid] of [
      [buildTeamSchema("Team required", "Captain required"), classicTeam, team],
      [buildTeamMemberSchema("Name required"), classicMember, member],
    ] as const) {
      expect(outcome(schema, { ...valid, extra: "stripped" })).toEqual(outcome(reference, { ...valid, extra: "stripped" }));
      for (const key of Object.keys(valid)) for (const value of invalidValues) {
        expect(outcome(schema, { ...valid, [key]: value })).toEqual(outcome(reference, { ...valid, [key]: value }));
      }
    }
  });
  for (const language of ["vi", "en"] as const) {
    it(`preserves venue coercion/defaults and ghost phone rules in ${language}`, () => {
      const venue = { name: "City courts", city: "Hanoi", num_courts: "4", name_vi: "Sân", district: "Tay Ho", address: "1 Main", surface_type: "wood", is_indoor: true };
      const ghost = { display_name: "Player", phone: "0912345678", city: "Hanoi" };
      for (const [schema, reference, valid] of [
        [buildVenueSchema(language), classicVenue(language), venue],
        [buildGhostProfileSchema(language), classicGhost(language), ghost],
      ] as const) {
        expect(outcome(schema, { ...valid, extra: "stripped" })).toEqual(outcome(reference, { ...valid, extra: "stripped" }));
        for (const key of Object.keys(valid)) for (const value of invalidValues) {
          expect(outcome(schema, { ...valid, [key]: value })).toEqual(outcome(reference, { ...valid, [key]: value }));
        }
      }
      expect(buildVenueSchema(language).parse({ name: "Courts", city: "Hanoi" })).toEqual({ name: "Courts", city: "Hanoi", is_indoor: false });
      for (const phone of ["0912345678", "+84912345678"]) expect(buildGhostProfileSchema(language).safeParse({ ...ghost, phone }).success).toBe(true);
    });
  }
  it("keeps react-hook-form async validation errors and coerced submission values", async () => {
    const options = { fields: {}, shouldUseNativeValidation: false };
    const schema = buildVenueSchema("en");
    const resolve = zodResolver(schema);
    const invalid = await resolve({ name: "", city: "", num_courts: "51" }, undefined, options);
    expect(invalid.values).toEqual({});
    expect(invalid.errors.name?.message).toBe("Venue name needs at least 2 characters");
    expect(invalid.errors.city?.message).toBe("Pick a city");
    expect(invalid.errors.num_courts).toBeDefined();
    const valid = await resolve({ name: "Courts", city: "Hanoi", num_courts: "4" }, undefined, options);
    expect(valid.errors).toEqual({});
    expect(valid.values).toEqual({ name: "Courts", city: "Hanoi", num_courts: 4, is_indoor: false });
  });
});

describe("DUPR response contract", () => {
  const create = z.object({ created: z.literal(true), match_code: z.string().min(1), hashed_match_code: z.string().nullable().optional(), identifier: z.string(), club_id: z.string().nullable().optional(), match_source: z.enum(["CLUB", "PARTNER"]), persist_warning: z.string().optional() });
  const update = z.object({ updated: z.literal(true), match_code: z.string().min(1) });
  const remove = z.object({ deleted: z.literal(true), match_code: z.string().optional() });
  const error = z.object({ error: z.string(), code: z.string().optional(), details: z.unknown().optional() });
  const reference = z.union([z.union([create, update, remove]), error]);
  it("preserves all success/error envelopes and exact rejection issues", () => {
    for (const valid of [
      { created: true, match_code: "M1", identifier: "I1", match_source: "CLUB", hashed_match_code: null, club_id: null, persist_warning: "Retry" },
      { updated: true, match_code: "M1" }, { deleted: true }, { error: "Denied", code: "FORBIDDEN", details: { reason: "missing" } },
    ]) {
      expect(outcome(DuprSubmitResponseSchema, { ...valid, extra: "stripped" })).toEqual(outcome(reference, { ...valid, extra: "stripped" }));
      for (const key of Object.keys(valid)) for (const value of invalidValues) {
        expect(outcome(DuprSubmitResponseSchema, { ...valid, [key]: value })).toEqual(outcome(reference, { ...valid, [key]: value }));
      }
    }
  });
});
