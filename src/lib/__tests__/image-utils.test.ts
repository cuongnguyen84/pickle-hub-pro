import { describe, it, expect } from "vitest";
import {
  optimizeImageUrl,
  blogHeroSrcSet,
  cmsHeroImageSources,
  homepageThumbnailUrl,
} from "../image-utils";

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

describe("cmsHeroImageSources", () => {
  it("creates responsive Supabase transforms for CMS covers", () => {
    const out = cmsHeroImageSources(
      "https://example.supabase.co/storage/v1/object/public/blog/cover.jpg",
    )!;
    expect(out.src).toContain("/render/image/public/");
    expect(out.src).toContain("width=768");
    expect(out.srcSet).toContain("width=480");
    expect(out.srcSet).toContain("1200w");
  });

  it("normalizes and resizes Google Drive covers", () => {
    const out = cmsHeroImageSources("https://drive.google.com/file/d/abc_123/view")!;
    expect(out.src).toBe("https://lh3.googleusercontent.com/d/abc_123=w768");
    expect(out.srcSet).toContain("=w480 480w");
  });

  it("reuses committed local variants and leaves unknown hosts unchanged", () => {
    expect(cmsHeroImageSources("/images/blog/example-hero.webp")?.src).toBe(
      "/images/blog/example-hero-768.webp",
    );
    expect(cmsHeroImageSources("https://cdn.example.com/cover.jpg")).toEqual({
      src: "https://cdn.example.com/cover.jpg",
    });
  });
});

describe("homepageThumbnailUrl", () => {
  it("uses bounded Supabase and Mux transforms", () => {
    expect(
      homepageThumbnailUrl(
        "https://example.supabase.co/storage/v1/object/public/thumbs/a.jpg",
        { width: 168, height: 168 },
      ),
    ).toContain("/storage/v1/render/image/public/");

    const mux = homepageThumbnailUrl(
      "https://image.mux.com/abc/thumbnail.jpg",
      { width: 224, height: 126 },
    )!;
    expect(new URL(mux).searchParams.get("width")).toBe("224");
    expect(new URL(mux).searchParams.get("height")).toBe("126");
  });

  it("bounds Google Drive and YouTube thumbnails", () => {
    expect(
      homepageThumbnailUrl("https://drive.google.com/file/d/abc_123/view", {
        width: 224,
        height: 126,
      }),
    ).toBe("https://lh3.googleusercontent.com/d/abc_123=w224-h126-c");

    expect(
      homepageThumbnailUrl("https://img.youtube.com/vi/video123/maxresdefault.jpg", {
        width: 168,
        height: 168,
      }),
    ).toBe("https://i.ytimg.com/vi/video123/hqdefault.jpg");
  });

  it("preserves the full image when contain mode is requested", () => {
    const mux = homepageThumbnailUrl(
      "https://image.mux.com/abc/thumbnail.jpg",
      { width: 768, height: 432, fit: "contain" },
    )!;
    expect(new URL(mux).searchParams.get("width")).toBe("768");
    expect(new URL(mux).searchParams.has("height")).toBe(false);
    expect(new URL(mux).searchParams.has("fit_mode")).toBe(false);

    expect(
      homepageThumbnailUrl("https://drive.google.com/file/d/abc_123/view", {
        width: 768,
        height: 432,
        fit: "contain",
      }),
    ).toBe("https://lh3.googleusercontent.com/d/abc_123=w768");
  });

  it("rejects unbounded third-party originals and keeps controlled local assets", () => {
    expect(
      homepageThumbnailUrl("https://storage.ghost.io/content/images/huge.png", {
        width: 168,
        height: 168,
      }),
    ).toBeUndefined();
    expect(
      homepageThumbnailUrl("/images/blog/local.webp", { width: 168, height: 168 }),
    ).toBe("/images/blog/local.webp");
  });

  it("uses Pickleball.com's bounded image optimizer", () => {
    const result = homepageThumbnailUrl(
      "https://cdn.pickleball.com/news/example.jpg?width=1320&height=528&optimizer=image",
      { width: 168, height: 168 },
    )!;

    expect(new URL(result).searchParams.get("width")).toBe("168");
    expect(new URL(result).searchParams.get("height")).toBe("168");
  });

  it("allows APP Webflow AVIF assets but rejects other Webflow originals", () => {
    const thumbnail =
      "https://cdn.prod.website-files.com/site/asset_MaddoxBatesWin-Thumb.avif";

    expect(
      homepageThumbnailUrl(thumbnail, { width: 168, height: 168 }),
    ).toBe(thumbnail);
    expect(
      homepageThumbnailUrl(
        "https://cdn.prod.website-files.com/site/asset_MaddoxBatesWin.png",
        { width: 168, height: 168 },
      ),
    ).toBeUndefined();
  });

  it("allows generated WordPress images from trusted news publishers only", () => {
    const pickleballUnion =
      "https://pickleballunion.com/wp-content/uploads/2026/08/inside-foot-in-pickleball-1024x731.jpg";
    const majorLeaguePickleball =
      "https://majorleaguepickleball.co/wp-content/uploads/MLP-FINALS-1024x427.png";

    expect(
      homepageThumbnailUrl(pickleballUnion, { width: 168, height: 168 }),
    ).toBe(pickleballUnion);
    expect(
      homepageThumbnailUrl(majorLeaguePickleball, { width: 168, height: 168 }),
    ).toBe(majorLeaguePickleball);
    expect(
      homepageThumbnailUrl(
        "https://unknown.example/wp-content/uploads/2026/08/news.jpg",
        { width: 168, height: 168 },
      ),
    ).toBeUndefined();
  });
});
