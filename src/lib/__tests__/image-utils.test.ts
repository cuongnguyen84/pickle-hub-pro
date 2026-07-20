import { describe, it, expect } from "vitest";
import { optimizeImageUrl, blogHeroSrcSet } from "../image-utils";

describe("optimizeImageUrl", () => {
  it("transforms Supabase storage URLs to render/image with params", () => {
    const url =
      "https://ajvlcamxemgbxduhiqrl.supabase.co/storage/v1/object/public/thumbs/a.jpg";
    const out = optimizeImageUrl(url, { width: 640 })!;
    expect(out).toContain("/storage/v1/render/image/public/");
    expect(out).toContain("width=640");
    expect(out).toContain("format=webp");
  });

  it("resizes Mux thumbnails via native width param (no smartcrop without height)", () => {
    const out = optimizeImageUrl("https://image.mux.com/abc123/thumbnail.jpg", {
      width: 640,
    })!;
    expect(out).toContain("width=640");
    expect(out).not.toContain("fit_mode");
  });

  it("adds fit_mode=smartcrop when both dimensions given, idempotently", () => {
    const url =
      "https://image.mux.com/abc123/thumbnail.jpg?width=1280&height=720&fit_mode=smartcrop";
    const out = optimizeImageUrl(url, { width: 640, height: 360 })!;
    const params = new URL(out).searchParams;
    expect(params.get("width")).toBe("640");
    expect(params.get("height")).toBe("360");
    expect(params.get("fit_mode")).toBe("smartcrop");
  });

  it("leaves other URLs and empty input unchanged", () => {
    expect(optimizeImageUrl("https://example.com/x.png", { width: 640 })).toBe(
      "https://example.com/x.png"
    );
    expect(optimizeImageUrl(undefined)).toBeUndefined();
  });
});

describe("blogHeroSrcSet", () => {
  it("builds 768w/1600w srcset for local blog images", () => {
    expect(blogHeroSrcSet("/images/blog/how-to-play-pickleball-hero.webp")).toEqual({
      srcSet:
        "/images/blog/how-to-play-pickleball-hero-768.webp 768w, /images/blog/how-to-play-pickleball-hero.webp 1600w",
      small: "/images/blog/how-to-play-pickleball-hero-768.webp",
    });
  });

  it("tolerates ?v=N cache-busters", () => {
    const out = blogHeroSrcSet("/images/blog/x-hero.webp?v=2")!;
    expect(out.small).toBe("/images/blog/x-hero-768.webp?v=2");
    expect(out.srcSet).toContain("/images/blog/x-hero.webp?v=2 1600w");
  });

  it("returns undefined for remote URLs, -768 variants, and null", () => {
    expect(blogHeroSrcSet("https://cdn.example.com/hero.webp")).toBeUndefined();
    expect(blogHeroSrcSet("/images/blog/x-hero-768.webp")).toBeUndefined();
    expect(blogHeroSrcSet(null)).toBeUndefined();
  });
});
