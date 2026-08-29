import { describe, expect, it } from "vitest";
import { SHOP_PUBLIC_OPEN } from "../shopGate";

describe("Shop public launch gate", () => {
  it("keeps the buyer catalogue open in the production source", () => {
    expect(SHOP_PUBLIC_OPEN).toBe(true);
  });
});
