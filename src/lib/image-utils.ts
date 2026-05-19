/**
 * Optimizes Supabase Storage image URLs using the built-in image transformation API.
 * Adds width, height, and format parameters to serve properly sized WebP images.
 * Non-Supabase URLs are returned unchanged.
 */
export function optimizeImageUrl(
  url: string | undefined,
  options: { width?: number; height?: number; quality?: number } = {}
): string | undefined {
  if (!url) return url;

  const { width, height, quality = 75 } = options;

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
