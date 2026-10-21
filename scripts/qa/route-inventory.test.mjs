// ============================================================================
// The route inventory cannot fall behind src/App.tsx.
// ----------------------------------------------------------------------------
// An inventory is only worth having if it is complete, and the way an
// inventory stops being complete is that somebody adds a route. So this reads
// the ACTUAL route table — the thing React Router renders from — and fails
// when it and the inventory disagree in either direction.
//
// Red-proof: add `<Route path="/shop/wishlist" …>` to App.tsx and this goes
// red, naming the uncovered path. Deleting an entry from the inventory does
// the same. Neither is caught by any other test on this branch.
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SHOP_ROUTES } from "./p2b-routes.mjs";

const app = readFileSync(resolve(import.meta.dirname, "../../src/App.tsx"), "utf8");

/** Shop-owned paths, whichever table they are declared in. */
const OWNED = /^\/(?:shop|seller|admin\/shop)(?:\/|$)/;

/** `<Route path="…"` — the explicitly declared routes. */
const declared = [...app.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1]);

/** The MIRRORED table, which App.tsx renders twice (EN + /vi). */
const mirroredBlock = app.slice(
  app.indexOf("const MIRRORED: MirroredRoute[] = ["),
  app.indexOf("];", app.indexOf("const MIRRORED: MirroredRoute[] = [")),
);
const mirrored = [...mirroredBlock.matchAll(/\{\s*path:\s*"([^"]+)"/g)].map((m) => m[1]);

const appPaths = [...new Set([...declared, ...mirrored])].filter((p) => OWNED.test(p));
const mirroredShopPaths = new Set(mirrored.filter((p) => OWNED.test(p)));

const inventory = new Map(SHOP_ROUTES.map((r) => [r.pattern, r]));

describe("P2b.7.1 route inventory", () => {
  it("found the route tables at all", () => {
    // A regex that silently matches nothing would make every assertion below
    // vacuously true — which is the failure mode this whole checkpoint is
    // about.
    expect(appPaths.length).toBeGreaterThan(10);
    expect(mirroredShopPaths.size).toBeGreaterThan(3);
  });

  it.each(appPaths)("%s is in the inventory", (path) => {
    expect(inventory.has(path), `${path} has no inventory entry`).toBe(true);
  });

  it("has no entry for a route that no longer exists", () => {
    const stale = SHOP_ROUTES
      .filter((r) => !r.audience.startsWith("control"))
      .map((r) => r.pattern)
      .filter((p) => !appPaths.includes(p));
    expect(stale).toEqual([]);
  });

  it("agrees with App.tsx about which routes have a /vi twin", () => {
    for (const r of SHOP_ROUTES) {
      if (r.audience.startsWith("control")) continue;
      expect(!!r.mirrored, `${r.pattern}`).toBe(mirroredShopPaths.has(r.pattern));
    }
  });

  it("gives every route both a heading and a body marker", () => {
    // Either alone has already let a false PASS through on this branch: the
    // admin gate passed on an MFA error screen that rendered a heading, and
    // the buyer gate passed on an empty catalogue that rendered everything
    // except data.
    for (const r of SHOP_ROUTES) {
      expect(r.h1, r.key).toBeInstanceOf(RegExp);
      expect(r.marker, r.key).toBeInstanceOf(RegExp);
      expect(r.states.length, r.key).toBeGreaterThan(0);
    }
  });

  it("expects noindex on every Shop surface during the pilot", () => {
    for (const r of SHOP_ROUTES) {
      if (r.audience.startsWith("control")) continue;
      expect(r.noindex, `${r.pattern} must be noindex during the closed pilot`).toBe(true);
    }
  });

  it("requires aal2 for every admin route", () => {
    for (const r of SHOP_ROUTES.filter((x) => x.audience === "admin")) {
      expect(r.aal, r.pattern).toBe("aal2");
      expect(r.auth, r.pattern).toBe("admin");
    }
  });
});
