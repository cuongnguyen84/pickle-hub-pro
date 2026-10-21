/** Strip a leading /vi so route checks and links share one path shape. */
export function withoutLocale(path: string): string {
  if (path === "/vi") return "/";
  if (path.startsWith("/vi/")) return path.slice(3) || "/";
  return path;
}

/** Keep the user on /vi when the UI language is Vietnamese. */
export function localePath(path: string, lang: "vi" | "en"): string {
  const [bare, suffix] = splitSuffix(path);
  const normalized = withoutLocale(bare.startsWith("/") ? bare : `/${bare}`);
  const prefixed = lang === "vi" ? (normalized === "/" ? "/vi" : `/vi${normalized}`) : normalized;
  return prefixed + suffix;
}

function splitSuffix(path: string): [string, string] {
  const q = path.search(/[?#]/);
  if (q < 0) return [path, ""];
  return [path.slice(0, q), path.slice(q)];
}
