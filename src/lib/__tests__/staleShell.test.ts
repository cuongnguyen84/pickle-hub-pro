import { describe, expect, it } from "vitest";
import { isNewerBuild } from "../staleShell";

describe("isNewerBuild", () => {
  it("id khác → build mới", () => {
    expect(isNewerBuild("mda1b2c3", "mcz9x8y7")).toBe(true);
    expect(isNewerBuild("  mda1b2c3\n", "mcz9x8y7")).toBe(true); // trim
  });

  it("id trùng → không stale", () => {
    expect(isNewerBuild("mda1b2c3", "mda1b2c3")).toBe(false);
  });

  it("body không phải token (routing sai) → fail open", () => {
    expect(isNewerBuild("<!doctype html><html>...</html>", "mda1b2c3")).toBe(false);
    expect(isNewerBuild("", "mda1b2c3")).toBe(false);
    expect(isNewerBuild("Not Found", "mda1b2c3")).toBe(false); // chữ hoa + space
  });
});
