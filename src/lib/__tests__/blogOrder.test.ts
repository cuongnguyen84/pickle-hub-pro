// Ordering contract for blog listings. The regression these guard is concrete:
// on 2026-08-31 the World Cup Group A article was rewritten that morning but
// stayed at position 8 behind a publishedDate sort, with the homepage slicing
// the top 6 — so the freshest post on the site was the one readers couldn't see.

import { describe, it, expect } from "vitest";
import {
  effectiveDateMs,
  effectiveDateIso,
  isRefreshed,
  byEffectiveDateDesc,
} from "../blogOrder";

type P = { slug: string; pub: string | null; upd: string | null };
const sorted = (posts: P[]) =>
  [...posts]
    .sort(byEffectiveDateDesc((p) => p.pub, (p) => p.upd))
    .map((p) => p.slug);

describe("blogOrder", () => {
  it("ranks a refreshed old post above a newer untouched one", () => {
    // The real 2026-08-31 shape: Group A published Aug 17, updated Aug 31;
    // the men's-doubles piece published Aug 26 and never touched since.
    expect(
      sorted([
        { slug: "mens-doubles", pub: "2026-08-26", upd: "2026-08-26" },
        { slug: "group-a", pub: "2026-08-17", upd: "2026-08-31" },
        { slug: "schedule", pub: "2026-08-24", upd: "2026-08-31" },
      ]),
    ).toEqual(["group-a", "schedule", "mens-doubles"]);
  });

  it("leaves never-updated posts in publish order", () => {
    expect(
      sorted([
        { slug: "old", pub: "2026-08-01", upd: "2026-08-01" },
        { slug: "new", pub: "2026-08-20", upd: "2026-08-20" },
      ]),
    ).toEqual(["new", "old"]);
  });

  it("displays the date it sorted on, not the publish date", () => {
    // Showing publishedDate while ranking on updatedDate is what makes a
    // listing look broken: an item dated Aug 17 sitting above one dated Aug 26.
    expect(effectiveDateIso("2026-08-17", "2026-08-31")).toBe("2026-08-31");
    expect(effectiveDateIso("2026-08-26", "2026-08-26")).toBe("2026-08-26");
  });

  it("does not label a same-day tweak as refreshed", () => {
    expect(isRefreshed("2026-08-26", "2026-08-26")).toBe(false);
    expect(isRefreshed("2026-08-17", "2026-08-31")).toBe(true);
  });

  it("survives null and malformed dates instead of sorting them to the top", () => {
    expect(effectiveDateMs(null, null)).toBe(0);
    expect(effectiveDateMs("not-a-date", null)).toBe(0);
    expect(isRefreshed(null, "2026-08-31")).toBe(false);
    expect(
      sorted([
        { slug: "broken", pub: null, upd: null },
        { slug: "real", pub: "2026-08-01", upd: null },
      ]),
    ).toEqual(["real", "broken"]);
  });

  it("never reports an update older than the publish date", () => {
    // A backdated updated_at must not drag a post below its own publish date.
    expect(effectiveDateIso("2026-08-20", "2026-08-01")).toBe("2026-08-20");
    expect(isRefreshed("2026-08-20", "2026-08-01")).toBe(false);
  });
});
