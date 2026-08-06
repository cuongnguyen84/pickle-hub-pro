# UX review brief — "PPA Tour rankings tab" on ThePickleHub

You are reviewing a proposed change to a live product. You cannot see the repo; everything you need is below.

## The product

ThePickleHub (thepicklehub.net) — a bilingual Vietnamese/English pickleball platform, solo-built.
Tournaments, livestream, replay, news, community feed, rankings.

Audience reality:
- ~95% of users are Vietnamese pickleball players in Vietnam. Vietnamese is the primary language; English is a small secondary track.
- Mobile-dominant, including a Capacitor native shell (iOS/Android). Mid-tier Android on 4G is the reference device.
- Perf targets, Vietnam p75: LCP <= 2.5s, INP <= 200ms, CLS <= 0.1.
- Users usually arrive from a Facebook link straight onto one deep page. They do not browse the IA.
- Typical context: standing courtside, one hand, noisy, 60 seconds before the next game.

## The page today: /rankings and /vi/rankings

Design language is a custom system called "TheLine": near-monochrome, Geist + Geist Mono, one green accent, thin 1px borders, pill-shaped tabs, dense data tables.

Current structure top to bottom on a 390px viewport:

1. Breadcrumb: `Trang chủ / Bảng xếp hạng`
2. Kicker line: `◆ DUPR · Cập nhật 20 thg 7, 2026`
3. H1 (large editorial type, 2 lines):
   VI: "Ai đang **đứng top.** / Toàn cầu, tính theo DUPR."
   EN: "Where *everyone* / actually stands."
4. Intro paragraph explaining what DUPR is.
5. **Scope selector** — three stacked rows of pill buttons, each row prefixed by an uppercase mono micro-label. On <=640px the micro-label takes a full line of its own (flex-basis:100%), then the pills wrap below it:
   - `QUỐC GIA` (NATIONAL): [Việt Nam]
   - `TOÀN CẦU` (GLOBAL): [Mở rộng] [Trẻ]
   - `CHÂU LỤC` (CONTINENT): [Châu Á] [Bắc Mỹ] [Nam Mỹ] [Úc / Châu Đại Dương] [Châu Âu]
   Pills: 12px font, 5px 10px padding on mobile (so roughly 26-28px tall — already under the 44px touch target minimum), border-radius 999px, active state = inverted (solid foreground bg, background-colour text). Rows wrap, they do not scroll horizontally.
6. **Format sub-tabs** — a second, visually different pill row (`.tl-filter`, includes a numeric count badge per pill), horizontally scrollable. For Vietnam scope: [Đôi 12] [Đơn 4]. For every other scope: [Đơn nam 25] [Đơn nữ 25] [Đôi nam 25] [Đôi nữ 25].
7. **The table** — a bordered panel. Panel head shows `Việt Nam · Đôi · Top 12` on the left and `Nguồn: ThePickleHub · DUPR` on the right. Table columns: `#` / `Vận động viên` (Player) / `Thành phố` (City, hidden below 640px) / `DUPR`. Rank is mono, rating is mono green 16px. Vietnam rows link to the player profile `/nguoi-choi/:username`. Below the table, a CTA row: "→ Kết nối DUPR để có tên trong bảng này" ("Link your DUPR to appear on this board").
8. Attribution/disclaimer box, mono-ish, 12px, muted grey: "Về dữ liệu này / About this data" + source links.

Scope and format are URL-backed: `?scope=` and `?format=`. On mount the resolved value is written back into the URL with `history.replace`. Deep links honoured, back/refresh consistent, filter clicks do not pile up history entries.

SEO/SSR: bots get a server-rendered version of this page from a Cloudflare Pages Function. It currently **hardcodes the Vietnam board**: title "Bảng xếp hạng DUPR Pickleball Việt Nam | ThePickleHub", an `<ol>` of the top 25 Vietnamese players each linking to their profile page, plus ItemList JSON-LD. The prerender cache key is the pathname only — **query strings are not part of the cache key**, so `?scope=x` deep links all return the same cached bot HTML.

## Hard fact about the current default tab (measured today on production)

The Vietnam board — the current default tab, the one every visitor sees first — contains **12 players in doubles and 4 in singles**. Several display names are raw usernames or joke names: "CM11", "trungnguyen0706", "Chồng Thanh Hoà", "Khánh Trắng". Most rows have no city. It looks empty and unserious. This is why the owner wants to change the default.

## The proposal being reviewed

Add a new scope, "PPA Tour", built from an automated scraper of ppatour.com/rankings, and **make it the default tab** — replacing Vietnam as what you see when you open /rankings or /vi/rankings with no query params. Rationale given: more data, looks fuller, serves an SEO landing page for pro-tour searches.

## What is actually at ppatour.com/rankings (I fetched it today — the proposal's assumption is wrong)

- It is **one composite ranking**, the World Pickleball Ranking (WPR): doubles 50% + mixed 35% + singles 15%, weighted over the trailing 52 weeks of PPA Tour points.
- There are **exactly two boards: Men and Women.** There is no Men's-Singles / Women's-Doubles / Mixed split on this page. The proposal's "5-6 format tabs" does not exist at the source.
- Columns available: rank `#`, player name, points (e.g. "19,295", "12,212.5"). Nothing else. No country, no age, no rating.
- The men's board is 1,324 players deep, paginated 50 at a time, client-hydrated (Next.js streaming; first 50 present in initial HTML, "Loading the rest of the board…" after).
- The source page has a **region filter**: All Regions / USA / Asia / Australia / Europe / Canada / Rest of World.
- Names visible in the men's top 50 that a Vietnamese audience would recognise: Jonathan Truong (#21), HT Hien Truong (#38), Luc Pham (#42), Hong Kit Wong (#20, Hong Kong), plus Japanese/Korean/Taiwanese pros. Women's top 20 includes Alix Truong (#14), Chao Yi Wang (#12).
- Top of both boards: Ben Johns 19,295 pts (men), Anna Leigh Waters 22,255 pts (women).

## Questions I want answered specifically

1. **Should PPA Tour be the default tab** for an audience that is 95% Vietnamese recreational players? Argue it properly — do not just agree with me. Note the counter-evidence above: the Vietnam board really is nearly empty. If not "make PPA default", what is the correct fix for "my default tab looks empty"?
2. **The scope selector is already 8 pills in 3 labelled rows.** Adding a 9th on a 390px screen. Does this need a different control entirely (segmented control, dropdown, horizontal scroller, grouping change)? Give a concrete layout, with what goes on which row.
3. A **points-only table of 50-100 American pros** — what columns, what row height, how deep before pagination/"load more", and where does the "Nguồn: PPA Tour" attribution go so it is honest but not shouting? Note the number format collision: Vietnamese uses `.` as thousands separator and `,` as decimal, so "12,212.5" points reads wrong to a VI user.
4. **Changing the default breaks the URL-less deep link.** Anyone who bookmarked or shared `/rankings` gets a different page than before. Anyone who arrives from the existing Google result (which is indexed as the Vietnam board, title "Bảng xếp hạng DUPR Pickleball Việt Nam") lands on a PPA table. How bad is this, and what mitigations?
5. **Accessibility**: pill rows are implemented as plain `<button>`s, not a tablist. Long table (up to 100 rows). Touch targets currently ~26-28px tall on mobile. What is the minimum correct fix?
6. **Vietnamese copy.** Give me real strings, not descriptions: scope label, format labels, panel head, attribution sentence, empty/loading/error states. Vietnamese runs ~20-30% longer than English and these pills are narrow.

Be concrete. Name the exact element and the exact fix. No generic design advice.
