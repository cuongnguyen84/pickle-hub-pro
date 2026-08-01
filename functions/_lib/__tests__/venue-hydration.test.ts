import { describe, expect, it } from "vitest";
import { injectVenuePayload, serializeVenuePayload } from "../venue-hydration";

describe("venue initial-data hydration", () => {
  it("escapes script terminators and HTML-significant characters", () => {
    const json = serializeVenuePayload({ name: "</script><img src=x>&\u2028" });
    expect(json).not.toContain("</script>");
    expect(json).not.toContain("<img");
    expect(json).toContain("\\u003c/script\\u003e");
    expect(JSON.parse(json).name).toBe("</script><img src=x>&\u2028");
  });

  it("injects one non-executing JSON node before body close", () => {
    const html = injectVenuePayload("<html><body><div id=\"root\"></div></body></html>", "court-a", {
      slug: "court-a",
    });
    expect(html).toContain('type="application/json"');
    expect(html.indexOf("__TPH_VENUE_DATA__")).toBeLessThan(html.indexOf("</body>"));
    expect(html.match(/__TPH_VENUE_DATA__/g)).toHaveLength(1);
  });
});
