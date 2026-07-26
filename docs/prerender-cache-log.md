# Prerender cache-key version changelog (pr:vN) — moved verbatim from functions/_middleware.ts (SEO-04)


## pr:v31 → pr:v32 — 2026-07-26 (EN blog posts finally have a body)

renderBlogPost now emits the post's own sections + FAQ + HowTo schema instead of
breadcrumb-and-related-links only, so every cached EN /blog/<slug> entry is
stale by ~10 KB of missing content.


## pr:v30 → pr:v31 — 2026-07-26 (SEO cluster Sprint 1, steps 2–4)

Blog SSR meta changed (bracket-templates merged into
`how-to-create-pickleball-bracket`, round robin guide re-angled) and the
/tools hub changed title, description, body copy and JSON-LD (FAQPage node
added). Bumping invalidates the stale HTML for every prerendered path in one
go; per-path `?nocache=1` was used only for the spot checks.

Cache key version bumped pr:v3 → pr:v4 on 2026-05-11 (second bump
same day) to invalidate cached responses with the broken nested
SportsEvent superEvent that produced two Rich Results errors —
missing startDate, missing location. New schema uses SportsSeries
for the parent (no required dates/location). Same TTL-skip
rationale as the previous v2→v3 bump.
PR (2026-05-18 Ahrefs Site Audit fix) — bumped v4→v5 to invalidate
cached responses with stale hreflang en+vi+x-default-all-to-same-URL
pattern on /clb/{slug}, /clubs, /social, /social/{id}. Same TTL-skip
rationale as v3→v4 bump (commit `52ba628`).
2026-05-20 — bumped v6→v7 to invalidate cached /social/{slug}
responses now that renderSocialEvent emits split EN/VI canonicals
+ reciprocal hreflang (new /vi/social/{slug} mirror). Old cache
would have served single-canonical VI-only HTML to bots hitting
either path.
2026-05-20 — bumped v7→v8 to invalidate cached social list + detail
HTML after surfacing court_count on /social and /social/{slug}.
2026-05-28 — Sprint SEO-1/2/3/4 bumped v8→v9 to invalidate cached
HTML for: locale-aware list-page meta (Tournaments/Videos/News/
Forum/Live), hreflang triplets added to 6 detail handlers, ItemList
JSON-LD on list pages, BreadcrumbList @graph on detail handlers.
2026-05-28 (batch 5) — bumped v9→v10 to invalidate cached HTML
that still carries the long pre-truncation titles + meta
descriptions. SEOnaut measures len() in UTF-8 bytes (Vietnamese
diacritics encode to 2-3 bytes each) so the byte-aware
truncateForSeo() in functions/_lib/html.ts needs the cache to
drop stale entries or bots keep seeing the long copy until the
6h TTL rolls over.
2026-05-28 (batch 6) — bumped v10→v11 to invalidate cached HTML
that still emits bilingualHreflang(X, X) on /watch /live /forum/post
/tran-dau. The byte-aware truncation in batch 5 also still needs
to settle in on routes whose v10 cache slot was already filled
immediately after the v9→v10 bump.
2026-05-28 (batch 7) — bumped v11→v12 to invalidate cached HTML
carrying the old /livestream + /vi/(watch|live|tournament|org) body
links and the renderTournamentDetail / renderOrgDetail
bilingualHreflang output. New singleCanonicalHreflang versions
need the cache to drop, otherwise bots get the v11 entries until
the natural 6h TTL elapses.
2026-05-28 (batch 8) — bumped v12→v13 to invalidate cached news
/ live / match HTML that doesn't yet include the new Related
sections. Without the bump, bots keep seeing the v12 cached
shells until the 6h TTL elapses.
2026-06-02 — bumped v15→v16 to invalidate cached /san HTML after SSR
output changes: split EN/VI canonical + hreflang, clean hub H1, enriched
detail pages (intro + "other courts in city" links) and address dedup.
2026-06-04 — bumped v16→v17 to invalidate cached /vi/blog HTML after
adding reciprocal hreflang (renderViBlogIndex now mirrors renderBlog).
2026-06-09 — bumped v17->v18 to invalidate cached /san/khu-vuc/* HTML
after enriching thin city hubs (intro + other-cities nav + discover
links) to clear Google soft-404 on 1-2 venue regions.
2026-06-16 — bumped v18->v19 to invalidate cached /rankings + /vi/rankings
HTML after adding reciprocal hreflang en/vi/x-default (renderRankings
previously emitted zero hreflang on both bilingual routes).
2026-06-29 — bumped v19->v20 to invalidate cached / + /vi (homepage
Organization alternateName for brand-query consolidation) and /san,
/san/{slug}, /san/khu-vuc/{city} (venue CTR title+meta + blog/news
interlinks). Without the bump bots keep the v19 HTML until the 6h TTL.
2026-07-06 — bumped v20->v21 (security) to purge cached /vi/blog/* HTML
that was rendered with UNSANITIZED vi_blog_posts.content_html. SSR now
runs sanitizeBlogHtml() over the stored HTML (defense-in-depth against
stored XSS); old cached entries must be invalidated so no pre-fix HTML
survives the TTL.
2026-07-08 — bumped v22->v23 to invalidate cached / and /vi HTML after
adding bot-visible internal links from the homepage to /san (court
directory) and the top-6 /san/khu-vuc/{city} hubs. The venue cluster is
the main non-brand growth engine (GSC 28d) but previously received no
homepage link equity in prerendered HTML.
2026-07-08 — bumped v23->v24 to invalidate /tools, /vi/tools (organizer
guide interlinks → budget/calendar posts) and /san/{slug} (booking phone
added to meta description for venue-name navigational CTR).
2026-07-08 — v24->v25: venue detail enrichment (maps/directions links,
hours, amenities, cover image) + city hub court totals & per-venue facts.
2026-07-11 — v25->v26: venue title/meta de-dup — 95% of venue names already
embed "Pickleball", so drop the redundant "Sân pickleball"/"pickleball court"
label; append city for local intent instead. CTR fix (rank was fine).
2026-07-13 — v26->v27: /vi/tools full Vietnamese SSR variant (title/meta/
body/JSON-LD targeting "tạo bảng đấu pickleball", "chia cặp vòng tròn",
"phần mềm quản lý giải pickleball") + reciprocal hreflang en/vi/x-default
on BOTH /tools and /vi/tools (previously neither emitted hreflang and
/vi/tools served English title/meta).
2026-07-13 — v27->v28: shorten /vi/tools VI title+meta to fit the 60/160
UTF-8 byte SEO budget (diacritics = 2-3 bytes/char); v27 cached HTML has
an ellipsis-truncated title/h1 ("…Vòng…").
2026-07-17 — v28->v29: SEO-02 full — BLOG_POST_META + EN_BLOG_SLUGS now
GENERATED from src/content/blog/metadata.ts (single source). 28 EN blog
<title>s switch from the hand-dict full title to metaTitleEn (the
SEO-optimized field, Cuong's call 2026-07-17); 1 description reconciled
(ppa-tour-asia-2026-complete-guide); 7 posts gain real dateModified from
updatedDate; pickleball-rules-complete-guide gains its hero og:image.
2026-07-18 — v29->v30: sanitizeBlogHtml now loops tag/handler strips to a
fixpoint and normalizeImageUrl uses a hostname check (CodeQL #45/46/47,
#22). Output identical for well-formed content; bump purges any cached
page whose HTML a single-pass strip under-sanitized.
