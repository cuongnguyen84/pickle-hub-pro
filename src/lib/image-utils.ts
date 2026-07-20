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
  if (url.includes('image.mux.com') && (width || height)) {
    try {
      const muxUrl = new URL(url);
      if (width) muxUrl.searchParams.set('width', String(width));
      if (height) muxUrl.searchParams.set('height', String(height));
      if (width && height) muxUrl.searchParams.set('fit_mode', 'smartcrop');
      return muxUrl.toString();
    } catch {
      return url;
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
