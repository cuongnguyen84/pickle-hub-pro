import { describe, expect, it } from "vitest";
import { isPagesApiPath } from "../_middleware";

describe("Pages API middleware bypass", () => {
  it.each([
    "/api",
    "/api/",
    "/api/rum-context",
    "/api/indexnow",
    "/api/future/nested-endpoint",
  ])("recognizes %s as a Pages API path", (pathname) => {
    expect(isPagesApiPath(pathname)).toBe(true);
  });

  it.each(["/", "/apis", "/api-docs", "/tools/api"]) (
    "does not bypass normal route handling for %s",
    (pathname) => {
      expect(isPagesApiPath(pathname)).toBe(false);
    },
  );
});
