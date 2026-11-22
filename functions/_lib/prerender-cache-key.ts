// v162 /feed EN lists English posts, drops quick-table semifinal copies, and the footer no longer says realtime or 30 days.
// v161 feed SSR interleaves finished match results onto /feed.
// v160 invalidates cached bot/human heads containing unguarded analytics tags.
// v159 added the AI-chat landing pages and tools hub; retain those routes.
export function prerenderCacheKey(pathname: string, human = false): string {
  return `pr:v162:${human ? "human:" : ""}${pathname}`;
}
