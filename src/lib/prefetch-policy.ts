/** Home data is expensive and includes a high-priority image preload. */
export function shouldPrefetchHomeData(pathname: string) {
  const normalized = pathname.replace(/\/+$/, "") || "/";
  return normalized === "/" || normalized === "/vi";
}
