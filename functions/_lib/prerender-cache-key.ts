// v159 invalidates cached bot/human heads containing unguarded analytics tags.
// v158 introduced parser sanitization. Old entries expire naturally; no purge.
export function prerenderCacheKey(pathname: string, human = false): string {
  return `pr:v159:${human ? "human:" : ""}${pathname}`;
}
