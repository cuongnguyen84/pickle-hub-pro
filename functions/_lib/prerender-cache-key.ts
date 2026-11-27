// v164 (2026-11-27): National Games pickleball dates corrected to Dec 5-9, 2026 in three blog posts (medal-debut, Sophia Phuong Anh, Ly Hoang Nam); cached v163 HTML still shows the superseded Dec 3 start.
// v163 (2026-11-25): PPA WPR snapshot fetched-at 2026-11-25. Women #25 is
// Kiora Kunimoto (Layne Sleeth drops to #26); cached v162 HTML would keep
// the 2026-11-17 table.
// v162 /feed EN lists English posts, drops quick-table semifinal copies, and the footer no longer says realtime or 30 days.
// v161 feed SSR interleaves finished match results onto /feed.
// v160 invalidates cached bot/human heads containing unguarded analytics tags.
// v159 added the AI-chat landing pages and tools hub; retain those routes.
export function prerenderCacheKey(pathname: string, human = false): string {
  return `pr:v164:${human ? "human:" : ""}${pathname}`;
}
