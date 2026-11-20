// v159 invalidates both bot HTML and human public-page parts after the
// AI-chat landing pages (/tools/create-by-chat, /vi/tools/tao-giai-bang-chat)
// and the /tools hub feature block shipped. Old KV entries expire naturally;
// no purge API required.
export function prerenderCacheKey(pathname: string, human = false): string {
  return `pr:v159:${human ? "human:" : ""}${pathname}`;
}
