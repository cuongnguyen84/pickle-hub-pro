import { describe, it, expect } from "vitest";
import { cityEventLink } from "../render/venues";

// City hubs carry a link to that city's 2026 tournament. The link is time-boxed
// so it disappears on its own — a hardcoded event link that outlives its event
// is the failure nobody comes back to fix. This locks the expiry: if the date
// check regresses, the hub keeps advertising a tournament that already happened.
const SITE = "https://www.thepicklehub.net";

describe("cityEventLink", () => {
  it("links Da Nang to the World Cup article while the event is ahead", () => {
    const html = cityEventLink("da-nang", "vi", SITE, "2026-07-27");
    expect(html).toContain(`${SITE}/vi/blog/cam-nang-xem-pickleball-world-cup-2026-da-nang`);
    expect(html).toContain("World Cup");
  });

  it("uses the EN slug on the EN hub — the VI post has a different slug entirely", () => {
    const vi = cityEventLink("tp-hcm", "vi", SITE, "2026-07-27");
    const en = cityEventLink("tp-hcm", "en", SITE, "2026-07-27");
    expect(vi).toContain("/vi/blog/hcmc-open-2026\"");
    expect(en).toContain("/blog/hcmc-open-2026-preview");
    // The EN slug must not be served under /vi — that only works via a redirect.
    expect(vi).not.toContain("hcmc-open-2026-preview");
  });

  it("goes quiet after the event ends, on its own", () => {
    // HCMC Open finishes Aug 9.
    expect(cityEventLink("tp-hcm", "vi", SITE, "2026-08-10")).not.toBe("");
    expect(cityEventLink("tp-hcm", "vi", SITE, "2026-08-11")).toBe("");
    // World Cup finishes Sep 6.
    expect(cityEventLink("da-nang", "vi", SITE, "2026-09-07")).not.toBe("");
    expect(cityEventLink("da-nang", "vi", SITE, "2026-09-08")).toBe("");
    // Well past both.
    expect(cityEventLink("da-nang", "vi", SITE, "2027-01-01")).toBe("");
  });

  it("renders nothing for a city with no event", () => {
    expect(cityEventLink("hai-phong", "vi", SITE, "2026-07-27")).toBe("");
    expect(cityEventLink("", "vi", SITE, "2026-07-27")).toBe("");
  });

  it("escapes the label — it lands inside HTML", () => {
    const html = cityEventLink("da-nang", "en", SITE, "2026-07-27");
    expect(html).toMatch(/^<p><a href="[^"]+">[^<]*<\/a><\/p>$/);
  });
});
