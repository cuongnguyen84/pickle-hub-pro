import { describe, expect, it, vi } from "vitest";
import { detectCountryFromEdge } from "../geo";

describe("detectCountryFromEdge", () => {
  it("normalizes a Cloudflare country code", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ country: "vn" }), { status: 200 }),
      );

    await expect(detectCountryFromEdge(fetchImpl)).resolves.toBe("VN");
    expect(fetchImpl).toHaveBeenCalledWith("/api/rum-context", {
      method: "GET",
      credentials: "omit",
      headers: { Accept: "application/json" },
    });
  });

  it("returns null when the edge response has no usable country", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ country: null }), { status: 200 }),
      );

    await expect(detectCountryFromEdge(fetchImpl)).resolves.toBeNull();
  });

  it("returns null for a non-success response", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 503 }));

    await expect(detectCountryFromEdge(fetchImpl)).resolves.toBeNull();
  });
});
