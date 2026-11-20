// v158 invalidates both bot HTML and human public-page parts after the HTML5
// sanitizer rollout. Old KV entries expire naturally; no purge API required.
export function prerenderCacheKey(pathname: string, human = false): string {
  return `pr:v158:${human ? "human:" : ""}${pathname}`;
}
