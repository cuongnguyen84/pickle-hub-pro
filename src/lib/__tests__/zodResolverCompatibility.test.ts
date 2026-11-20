import { describe, expect, it } from "vitest";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { DuprSubmitResponseSchema } from "@/contracts/duprMatchSubmit";

describe("Zod 4 resolver and API contract compatibility", () => {
  it("returns field errors instead of throwing a ZodError for invalid form input", async () => {
    const schema = z.object({ name: z.string().min(2, "Name required"), courts: z.coerce.number().int().min(0).max(50) });
    const resolve = zodResolver(schema);
    const options = { fields: {}, shouldUseNativeValidation: false };
    const invalid = await resolve({ name: "", courts: "51" }, undefined, options);
    expect(invalid.errors.name?.message).toBe("Name required");
    expect(invalid.errors.courts).toBeDefined();
    expect(invalid.values).toEqual({});
    const valid = await resolve({ name: "Venue", courts: "4" }, undefined, options);
    expect(valid.errors).toEqual({});
    expect(valid.values).toEqual({ name: "Venue", courts: 4 });
  });

  it("preserves flat DUPR success/error parsing and rejects incomplete success", () => {
    expect(DuprSubmitResponseSchema.parse({ updated: true, match_code: "abc" })).toEqual({ updated: true, match_code: "abc" });
    expect(DuprSubmitResponseSchema.parse({ error: "Denied", code: "FORBIDDEN" })).toEqual({ error: "Denied", code: "FORBIDDEN" });
    expect(DuprSubmitResponseSchema.safeParse({ updated: true }).success).toBe(false);
  });
});
