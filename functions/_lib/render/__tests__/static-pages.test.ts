import { describe, expect, it } from "vitest";
import { renderAdvertise, render404 } from "../static-pages";

const SITE = "https://www.thepicklehub.net";

describe("static bot pages", () => {
  it("renders the Vietnamese advertise route as an indexable bilingual page", async () => {
    const response = renderAdvertise(SITE, "/vi/advertise", "vi");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain(`<link rel="canonical" href="${SITE}/vi/advertise"/>`);
    expect(html).toContain(`hreflang="en" href="${SITE}/advertise"`);
    expect(html).toContain(`hreflang="vi" href="${SITE}/vi/advertise"`);
    expect(html).toContain("Hợp tác cùng chúng tôi");
  });

  it("does not link Vietnamese 404 pages through the redirecting /vi/ alias", async () => {
    const response = render404("/vi/missing", SITE);
    const html = await response.text();

    expect(response.status).toBe(404);
    expect(html).toContain(`href="${SITE}/vi"`);
    expect(html).not.toContain(`href="${SITE}/vi/"`);
  });
});
