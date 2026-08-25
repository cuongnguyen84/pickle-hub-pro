import { describe, expect, it } from "vitest";
import { resolveNewVenueSlugs } from "./import-alobo-venues.mjs";

/**
 * 2026-08-25 site audit — the duplicate /san pages.
 *
 * Running the alobo importer three times on 2026-08-24 (07:33, 07:34, 07:51)
 * created six venues twice, each pair a set of /san pages with identical
 * titles and identical meta descriptions, both in sitemap-venues.xml.
 *
 * The "slug already exists" guard tested only the FINAL slug, while the
 * disambiguation step rewrote that slug based on within-batch collisions. A
 * venue listed once in one export and twice in the next therefore arrived under
 * two different slugs and the guard saw neither as a repeat.
 */
const venue = (over = {}) => ({
  name: "Lakeside Pickleball",
  slug: "lakeside-pickleball",
  city: "Đà Nẵng",
  phone: "0931944886",
  address: "KĐT Lakeside",
  latitude: 16.09759,
  price_min_vnd: 100000,
  ...over,
});

const existingMap = (rows) => new Map(rows.map((r) => [r.slug, r]));

describe("resolveNewVenueSlugs", () => {
  it("does not re-insert a venue we already hold under its unsuffixed slug", () => {
    // The exact 2026-08-24 shape: the export lists this venue twice, and the
    // previous run already created it without a suffix.
    const held = existingMap([
      { slug: "lakeside-pickleball", city: "Đà Nẵng", name: "Lakeside Pickleball" },
    ]);
    const out = resolveNewVenueSlugs([venue(), venue()], held);

    expect(out.rows).toEqual([]);
    expect(out.heldBack).toHaveLength(1);
    expect(out.heldBack[0].why[0]).toContain("lakeside-pickleball already exists");
  });

  it("still creates a same-named venue in a DIFFERENT city", () => {
    // "Go Pickleball" is a real pair: Nha Trang and Vũng Tàu, different
    // addresses, different phones. A bare base-slug guard would swallow one.
    const held = existingMap([
      { slug: "go-pickleball", city: "Nha Trang", name: "Go Pickleball" },
    ]);
    const out = resolveNewVenueSlugs(
      [
        venue({ name: "Go Pickleball", slug: "go-pickleball", city: "Nha Trang" }),
        venue({ name: "Go Pickleball", slug: "go-pickleball", city: "Vũng Tàu" }),
      ],
      held,
    );

    expect(out.rows.map((r) => r.slug)).toEqual(["go-pickleball-vung-tau"]);
    expect(out.heldBack.map((h) => h.name)).toEqual(["go-pickleball-nha-trang"]);
  });

  it("suffixes a within-batch collision by city when we hold nothing yet", () => {
    const out = resolveNewVenueSlugs(
      [
        venue({ name: "Go Pickleball", slug: "go-pickleball", city: "Nha Trang" }),
        venue({ name: "Go Pickleball", slug: "go-pickleball", city: "Vũng Tàu" }),
      ],
      new Map(),
    );

    expect(out.rows.map((r) => r.slug).sort()).toEqual([
      "go-pickleball-nha-trang",
      "go-pickleball-vung-tau",
    ]);
    expect(out.heldBack).toEqual([]);
  });

  it("collapses a true duplicate within one batch and keeps the fuller copy", () => {
    const thin = venue({ phone: null, price_min_vnd: null, latitude: null, address: null });
    const full = venue();
    const out = resolveNewVenueSlugs([thin, full], new Map());

    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].phone).toBe("0931944886");
    expect(out.rows[0].price_min_vnd).toBe(100000);
  });

  it("holds back an exact slug we already have", () => {
    const held = existingMap([{ slug: "lakeside-pickleball", city: "Đà Nẵng" }]);
    const out = resolveNewVenueSlugs([venue()], held);

    expect(out.rows).toEqual([]);
    expect(out.heldBack[0].why[0]).toContain("slug already exists");
  });

  it("is idempotent — running twice over its own output creates nothing new", () => {
    const first = resolveNewVenueSlugs([venue(), venue()], new Map());
    expect(first.rows).toHaveLength(1);

    const held = existingMap(first.rows);
    const second = resolveNewVenueSlugs([venue(), venue()], held);
    expect(second.rows).toEqual([]);
  });

  it("does not leak the internal baseSlug field into rows destined for insert", () => {
    const out = resolveNewVenueSlugs([venue()], new Map());
    expect(out.rows[0]).not.toHaveProperty("baseSlug");
  });
});
