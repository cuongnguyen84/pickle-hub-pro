import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// The SPA shell must never be cacheable by browsers: after a deploy the old
// hashed chunks 404 on the production origin, so a cached index.html means a
// chunk-error reload loop ("Đang tải lại..." on the homepage, 2026-09-08).
describe("public/_headers — SPA shell cache policy", () => {
  it("homepage `/` ships max-age=0, must-revalidate like every other route", () => {
    const headers = readFileSync(path.resolve(__dirname, "../../public/_headers"), "utf8");
    const homeBlock = headers.split(/\n(?=\S)/).find((b) => b.startsWith("/\n"));
    expect(homeBlock).toBeDefined();
    expect(homeBlock).toMatch(/Cache-Control:\s*public,\s*max-age=0,\s*must-revalidate/);
    expect(homeBlock).not.toMatch(/max-age=[1-9]/);
  });
});
