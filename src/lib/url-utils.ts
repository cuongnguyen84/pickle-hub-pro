/**
 * Convert Google Drive share link to direct image URL.
 * Supports:
 * - https://drive.google.com/file/d/{ID}/view?usp=sharing
 * - https://drive.google.com/open?id={ID}
 * - https://docs.google.com/uc?id={ID}
 *
 * Returns: https://lh3.googleusercontent.com/d/{ID}
 */
export function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  // Hostname check, not substring — `evil.com/googleusercontent.com` must not
  // short-circuit (CodeQL js/incomplete-url-substring-sanitization).
  try {
    const host = new URL(url).hostname;
    if (host === "googleusercontent.com" || host.endsWith(".googleusercontent.com")) {
      return url;
    }
  } catch {
    // not an absolute URL — fall through to the Drive-ID extraction below
  }

  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch) {
    return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
  }

  const idParamMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idParamMatch) {
    return `https://lh3.googleusercontent.com/d/${idParamMatch[1]}`;
  }

  return url;
}

/**
 * Normalize all image src URLs in an HTML string.
 * Converts Google Drive share links to direct image URLs.
 */
export function normalizeImagesInHtml(html: string): string {
  if (!html) return html;

  return html.replace(
    /<img([^>]*)\ssrc=["']([^"']+)["']/gi,
    (_match, beforeSrc: string, src: string) => {
      const normalized = normalizeImageUrl(src);
      return `<img${beforeSrc} src="${normalized}"`;
    },
  );
}
