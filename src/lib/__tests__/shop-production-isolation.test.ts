// Production Shop code must never import the prototype.
//
// The prototype stays alive until parity sign-off, which makes an accidental
// import easy and invisible: fixtures render fine, so a screen wired to
// `PRODUCTS` would look correct in review and show made-up paddles to a real
// buyer. Grep is cheap; that failure is not.

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = resolve(__dirname, "../..");

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === "__tests__" ? [] : walk(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });

const PRODUCTION_DIRS = [
  "pages/shop",
  "pages/admin/shop",
  "components/shop",
  "hooks/shop",
  "lib/shop",
  "integrations/supabase",
];

const FILES = PRODUCTION_DIRS.flatMap((d) => {
  try {
    return walk(join(SRC, d));
  } catch {
    return [];
  }
});

describe("shop production isolation", () => {
  it("has production files to check", () => {
    expect(FILES.length).toBeGreaterThan(8);
  });

  it("never imports from the prototype", () => {
    const offenders = FILES.filter((f) => {
      const src = readFileSync(f, "utf8");
      return /from\s+["'][^"']*proto\/shop/.test(src) || /@\/proto\//.test(src);
    }).map((f) => f.slice(SRC.length + 1));
    expect(offenders).toEqual([]);
  });

  it("never imports a fixture module", () => {
    const offenders = FILES.filter((f) =>
      /from\s+["'][^"']*fixtures["']/.test(readFileSync(f, "utf8")),
    ).map((f) => f.slice(SRC.length + 1));
    expect(offenders).toEqual([]);
  });

  it("never references the prototype's scenario switch", () => {
    // ?scenario= is a review affordance. In production it would be a way to
    // ask the app to lie about its own state.
    const offenders = FILES.filter((f) => /readScenario|\?scenario=/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(SRC.length + 1));
    expect(offenders).toEqual([]);
  });

  it("routes seller/admin surfaces through an auth gate", () => {
    const app = readFileSync(join(SRC, "App.tsx"), "utf8");
    for (const path of [
      "/seller",
      "/seller/application",
      "/seller/application/status",
      "/seller/settings",
      "/seller/products",
      "/seller/products/new",
      "/seller/products/:id/edit",
      "/admin/shop/applications",
    ]) {
      const line = app.split("\n").find((l) => l.includes(`path="${path}"`));
      expect(line, `${path} must have a route`).toBeTruthy();
      expect(line, `${path} must be wrapped in RequireAuth`).toContain("RequireAuth");
    }
  });

  it("gates every /admin/shop route on the admin role", () => {
    const app = readFileSync(join(SRC, "App.tsx"), "utf8");
    const adminShopLines = app.split("\n").filter((l) => l.includes('path="/admin/shop'));
    expect(adminShopLines.length).toBeGreaterThan(0);
    for (const line of adminShopLines) {
      expect(line).toContain('requiredRole="admin"');
    }
  });

  it("keeps seller surfaces out of search indexes", () => {
    const mw = readFileSync(resolve(SRC, "../functions/_middleware.ts"), "utf8");
    expect(mw).toMatch(/\\\/\(\?:vi\\\/\)\?seller/);
    for (const robots of ["../public/robots.txt", "../functions/robots.txt.ts"]) {
      expect(readFileSync(resolve(SRC, robots), "utf8")).toContain("Disallow: /seller");
    }
  });
});
