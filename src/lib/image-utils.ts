import { normalizeImageUrl } from "./url-utils";

/**
 * Optimizes Supabase Storage image URLs using the built-in image transformation API.
 * Adds width, height, and format parameters to serve properly sized WebP images.
 * Mux thumbnail URLs (image.mux.com) get native resize params appended.
 * Other URLs are returned unchanged.
 */
export function optimizeImageUrl(
  url: string | undefined,
  options: { width?: number; height?: number; quality?: number } = {}
): string | undefined {
  if (!url) return url;

  const { width, height, quality = 75 } = options;

  // Mux thumbnails support width/height natively (same pattern as
  // streamThumb in LiveSection.tsx). fit_mode=smartcrop requires BOTH
  // dimensions — with width only, Mux resizes preserving aspect ratio.
  // Hostname is checked via URL parsing, not substring — a crafted URL like
  // https://evil.test/image.mux.com must not match (CodeQL js/incomplete-
  // url-substring-sanitization).
  if (width || height) {
    try {
      const muxUrl = new URL(url);
      if (muxUrl.hostname === 'image.mux.com') {
        if (width) muxUrl.searchParams.set('width', String(width));
        if (height) muxUrl.searchParams.set('height', String(height));
        if (width && height) muxUrl.searchParams.set('fit_mode', 'smartcrop');
        return muxUrl.toString();
      }
    } catch {
      // Relative/invalid URL — fall through to the Supabase path below.
    }
  }

  // Only transform Supabase Storage public URLs
  const supabasePublicPath = '/storage/v1/object/public/';
  if (!url.includes(supabasePublicPath)) return url;

  // Convert /object/public/ to /object/public/ with render/image/
  // Format: /storage/v1/render/image/public/{bucket}/{path}?width=X&height=Y&format=webp
  const transformedUrl = url.replace(
    '/storage/v1/object/public/',
    '/storage/v1/render/image/public/'
  );

  const params = new URLSearchParams();
  if (width) params.set('width', String(width));
  if (height) params.set('height', String(height));
  params.set('quality', String(quality));
  params.set('format', 'webp');

  const separator = transformedUrl.includes('?') ? '&' : '?';
  return `${transformedUrl}${separator}${params.toString()}`;
}

/**
 * Responsive variants for local blog hero images. Every committed
 * /images/blog/<name>.webp has a <name>-768.webp sibling (generated in
 * PERF-04), so mobile gets the ~768w file and desktop the ≤1600w original.
 * Returns undefined for remote/non-blog URLs — caller falls back to plain src.
 */
export function blogHeroSrcSet(
  src: string | null | undefined
): { srcSet: string; small: string } | undefined {
  if (!src) return undefined;
  // Tolerate ?v=N cache-busters (see blog-image-assets.test.ts)
  const [path, query] = src.split('?');
  if (!/^\/images\/blog\/[\w.-]+\.webp$/.test(path) || path.endsWith('-768.webp')) {
    return undefined;
  }
  const small = path.replace(/\.webp$/, '-768.webp') + (query ? `?${query}` : '');
  return { srcSet: `${small} 768w, ${src} 1600w`, small };
}

/**
 * Build responsive candidates for a CMS-managed hero image. Vietnamese blog
 * covers commonly live in Supabase Storage or Google Drive, so serving the
 * original 1500px+ asset to a 390px phone needlessly delays LCP. Unknown
 * origins are left alone because appending resize parameters without a known
 * CDN contract can break the image.
 */
export function cmsHeroImageSources(
  source: string | null | undefined,
): { src: string; srcSet?: string } | undefined {
  if (!source) return undefined;

  const normalized = normalizeImageUrl(source);
  const local = blogHeroSrcSet(normalized);
  if (local) return { src: local.small, srcSet: local.srcSet };

  const widths = [480, 768, 1200];
  const transformed = widths.map((width) => optimizeImageUrl(normalized, { width, quality: 78 }));
  if (transformed.every((url) => url && url !== normalized)) {
    return {
      src: transformed[1]!,
      srcSet: transformed.map((url, index) => `${url} ${widths[index]}w`).join(", "),
    };
  }

  try {
    const url = new URL(normalized);
    if (url.hostname === "googleusercontent.com" || url.hostname.endsWith(".googleusercontent.com")) {
      const base = url.toString().replace(/=w\d+(?:-h\d+)?(?:-[a-z]+)?$/i, "");
      return {
        src: `${base}=w768`,
        srcSet: widths.map((width) => `${base}=w${width} ${width}w`).join(", "),
      };
    }
  } catch {
    // A relative non-blog path has no known resizing contract.
  }

  return { src: normalized };
}

/**
 * Return a bounded thumbnail URL that is safe to use on high-traffic listing
 * surfaces. Remote publishers frequently expose multi-megabyte originals for
 * images that render at 84–224px; loading those originals on the homepage was
 * responsible for ~5MB per visit.
 *
 * Sources with a proven resize contract are transformed. Unknown remote
 * origins deliberately return undefined so callers render their existing
 * lightweight placeholder instead of hotlinking an unbounded original.
 */
export function homepageThumbnailUrl(
  source: string | null | undefined,
  options: { width: number; height: number; quality?: number; fit?: "cover" | "contain" },
): string | undefined {
  if (!source) return undefined;

  const normalized = normalizeImageUrl(source);
  // Hero artwork often contains copy or subjects close to the edge. In
  // `contain` mode, request a width-bounded derivative without asking the CDN
  // to crop it to the destination ratio; CSS then letterboxes it if needed.
  const transformOptions = options.fit === "contain"
    ? { width: options.width, quality: options.quality }
    : options;
  const transformed = optimizeImageUrl(normalized, transformOptions);
  if (transformed && transformed !== normalized) return transformed;

  // Committed/local assets already have a controlled byte budget.
  if (normalized.startsWith("/")) return normalized;

  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();

    // Google Drive direct images use the Google Photos CDN transform suffix.
    if (host === "googleusercontent.com" || host.endsWith(".googleusercontent.com")) {
      const base = url.toString().replace(/=w\d+(?:-h\d+)?(?:-[a-z]+)?$/i, "");
      if (options.fit === "contain") return `${base}=w${options.width}`;
      return `${base}=w${options.width}-h${options.height}-c`;
    }

    // YouTube's maxres image is often 100–200KB for an 84px news thumb.
    // hqdefault is a bounded 480px derivative and remains crisp at 2x DPR.
    if (host === "img.youtube.com" || host === "i.ytimg.com") {
      const match = url.pathname.match(/^\/vi\/([^/]+)\/[^/]+$/);
      if (!match) return undefined;
      return `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
    }

    // Same-origin absolute URLs are as controlled as root-relative assets.
    if (host === "thepicklehub.net" || host === "www.thepicklehub.net") {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return undefined;
  }

  return undefined;
}
