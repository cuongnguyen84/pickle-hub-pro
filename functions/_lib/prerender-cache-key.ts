// v160 invalidates cached bot/human heads containing unguarded analytics tags.
// v159 added the AI-chat landing pages and tools hub; retain those routes.
// v158 introduced parser sanitization. Old entries expire naturally; no purge.
export function prerenderCacheKey(pathname: string, human = false): string {
  return `pr:v160:${human ? "human:" : ""}${pathname}`;
}
