/**
 * SSR render functions for bot prerendering.
 * Ported from supabase/functions/prerender/index.ts
 *
 * SEO-04 (2026-07-16) — split by domain. Handlers live in the sibling
 * domain files; this barrel re-exports every public symbol so importers
 * (functions/_middleware.ts, ./social-event.ts, ./venues.ts) need no
 * changes.
 */

export { renderHome, renderHomeVi } from "./home";
export { renderLive, renderVideo, renderVideos, renderLivestreamList } from "./live-video";
export {
  renderTournamentDetail,
  renderTournaments,
  renderQuickTable,
  renderTeamMatch,
  renderDoublesElimination,
  renderFlexTournament,
} from "./tournaments";
export { renderNews, renderNewsPost, renderViNewsPost } from "./news";
export { renderForum, renderForumCategory, renderForumPost } from "./forum";
export { renderOrgDetail } from "./org";
export { renderTools, renderToolPage, renderToolNewPage } from "./tools";
export { renderBlogPost, renderBlog, renderViBlogPost, renderViBlogIndex } from "./blog";
export { renderRankings } from "./rankings";
export { renderProfile } from "./profile";
export { renderMatch } from "./match-page";
export { renderFeed } from "./feed";
export {
  renderPrivacy,
  renderTerms,
  renderNotificationsShell,
  renderNoindexShell,
  renderDefault,
  render404,
} from "./static-pages";

// ─── Social Events MVP (Sprint 1 PR2) ─────────────────────
// Re-export the dedicated render module so functions/_middleware.ts can
// import { renderSocialEvent, renderClub } from "./_lib/render" alongside
// the other handlers. Implementation lives in ./social-event.ts to keep
// this file from sprawling further.
export { renderSocialEvent, renderClub } from "./social-event";
export { renderVenuesList, renderVenueDetail, renderVenuesCity } from "./venues";

// PR73 Phase 2B (audit I-1 + I-2): hub list pages for /social + /clubs.
// Previously fell through to renderDefault → bot saw generic "ThePickleHub
// - Pickleball Community" with no upcoming-event content or schema.
export { renderSocialList, renderClubList } from "./social-list";
