/**
 * SSR render handlers — home pages (/ and /vi).
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import { escapeHtml, DEFAULT_OG_IMAGE } from "../utils";

// ─── Home ───────────────────────────���─────────────────────

/**
 * CTR-03 (2026-08-25) — the court count, floored to the nearest 50.
 *
 * Both home descriptions used to be claims ("the only bilingual pickleball
 * platform built for Asia") rather than facts, and a claim is the weakest
 * thing to put in front of a searcher deciding which of ten results to open.
 * The court count is the largest concrete number the site holds — 896 on
 * 2026-08-25 — so it goes in the snippet instead.
 *
 * Floored to 50 and phrased as "hơn X" / "X+" so the string stays true between
 * deploys as venues are added, and so the copy doesn't churn on every import.
 * Returns null when the count is unavailable; callers then fall back to a
 * number-free sentence rather than printing "hơn 0 sân". A meta description is
 * not worth failing a page render over.
 */
async function flooredVenueCount(supabase: SupabaseClient): Promise<number | null> {
  try {
    const { count, error } = await supabase
      .from("venues")
      .select("slug", { count: "exact", head: true });
    if (error || count == null || count < 50) return null;
    return Math.floor(count / 50) * 50;
  } catch {
    return null;
  }
}

export async function renderHome(supabase: SupabaseClient, siteUrl: string): Promise<Response> {
  const [liveRes, videoRes, viBlogRes, venueCount] = await Promise.all([
    supabase.from("public_livestreams").select("id, title, status").in("status", ["live", "scheduled"]).order("created_at", { ascending: false }).limit(10),
    supabase.from("videos").select("id, title").eq("status", "published").order("published_at", { ascending: false }).limit(10),
    supabase.from("vi_blog_posts").select("slug, title, excerpt").eq("status", "published").order("published_at", { ascending: false }).limit(3),
    flooredVenueCount(supabase),
  ]);

  const liveItems = (liveRes.data || []).map((l) => `<li><a href="${siteUrl}/live/${l.id}">${escapeHtml(l.title)}</a> (${l.status})</li>`).join("");
  const videoItems = (videoRes.data || []).map((v) => `<li><a href="${siteUrl}/watch/${v.id}">${escapeHtml(v.title)}</a></li>`).join("");
  const viBlogItems = (viBlogRes.data || []).map((b) => `<li><a href="${siteUrl}/vi/blog/${b.slug}" hreflang="vi">${escapeHtml(b.title)}</a></li>`).join("");

  const viBlogSection = viBlogItems
    ? `<h2>Pickleball in Vietnam</h2><p>Vietnamese pickleball content from our local team:</p><ul>${viBlogItems}</ul><p><a href="${siteUrl}/vi" hreflang="vi">Visit Vietnamese site</a></p>`
    : "";

  // 2026-08-14 (approved by Cuong): bare "ThePickleHub" title left the EN home
  // with zero keyword signal (GSC: pos 8.3, CTR 1.2% on 244 impressions).
  // Brand name still leads VERBATIM for the OAuth reviewer's literal
  // app-name comparison — same pattern /vi has shipped since launch with
  // no OAuth issue. Mirrors the VI title for hreflang-pair consistency.
  const title = "ThePickleHub – Pickleball Asia: Live & Tournaments";
  // CTR-03 (2026-08-25) — description rewritten; title deliberately untouched.
  //
  // GSC 16–22/08: this page took 381 impressions at avg position 8.4 for 4
  // clicks (1.05% CTR). The old snippet spent its whole budget on a
  // self-description ("The only bilingual pickleball platform built for Asia")
  // and named not one thing a searcher could be looking for. Replaced with the
  // four surfaces people actually arrive for — streams, schedules, rankings,
  // courts — leading with the count.
  //
  // The TITLE is left exactly as it was. It was changed on 2026-08-14 and 11
  // days is not enough signal to judge it; changing both at once would mean
  // never learning which one moved the number.
  const description = venueCount
    ? `Live pickleball streams, PPA Tour Asia schedules, DUPR rankings and ${venueCount}+ courts across Vietnam — updated daily on ThePickleHub.`
    : "Live pickleball streams, PPA Tour Asia schedules, DUPR rankings and pickleball courts across Vietnam — updated daily on ThePickleHub.";

  return htmlResponse(buildHtml({
    title,
    description,
    url: siteUrl,
    siteUrl,
    lang: "en",
    // SEO audit 2026-08-11 — buildHtml auto-generates an <h1> from `title`,
    // and bodyContent already carries its own <h1>ThePickleHub</h1>, so the
    // page shipped two H1s. Omit the auto header and keep the body H1 as the
    // single H1 (same pattern as venues.ts / social-event.ts).
    omitAutoHeader: true,
    // PR73 Phase 2D (audit I-12) — canonical (set via `url: siteUrl` above)
    // has no trailing slash, but the hreflang en + x-default previously
    // pointed at `${siteUrl}/` (with slash). Mismatched canonical and
    // hreflang values are a Google "invalid signal" — fixed by dropping
    // the trailing slash from hreflang en + x-default so all three refer
    // to the same URL string.
    extraMeta: `<link rel="alternate" hreflang="en" href="${siteUrl}"/>\n<link rel="alternate" hreflang="vi" href="${siteUrl}/vi"/>\n<link rel="alternate" hreflang="x-default" href="${siteUrl}"/>`,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${siteUrl}#org`,
          name: "ThePickleHub",
          // Brand-entity consolidation: spaced/variant brand searches
          // ("the pickle hub", "pickle hub") rank ~pos 9 on / because the
          // entity name has no space. alternateName binds those variants to
          // this entity so Google surfaces the homepage for the brand query.
          alternateName: ["The Pickle Hub", "Pickle Hub", "Picklehub"],
          url: siteUrl,
          logo: DEFAULT_OG_IMAGE,
          description: "Editorial coverage of professional pickleball — PPA, APP, MLP, European Open, Asia Pacific Series. Bilingual Vietnamese-English. Headquartered in Ho Chi Minh City.",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Ho Chi Minh City",
            addressCountry: "VN",
          },
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            email: "tapickleballvn@gmail.com",
            url: `${siteUrl}/contact`,
            availableLanguage: ["vi", "en"],
          },
          // sameAs must only ever list profiles that resolve AND that are ours.
          // A 404 here is a dirty signal on the exact entity these blocks exist
          // to consolidate ("the pickle hub" ranks ~pos 8 on its own name) —
          // and, per BRAND-01 below, a 200 that belongs to someone else is
          // worse than a 404, because it asserts we ARE the other company.
          //
          // The App Store listing is verified live: apps.apple.com/app/id6759968026
          // returns 200 as "ThePickleHub: Tournaments", developer NGUYEN THE CUONG.
          //
          // No Play Store entry on purpose. The 2026-07-24 SEO brief asked for
          // play.google.com/store/apps/details?id=net.thepicklehub.app — that URL
          // 404s on every locale and app-id variant tried (hl=vi&gl=VN, hl=en&gl=US,
          // com.thepicklehub.app, net.thepicklehub). The Android app is not
          // published. Add it here when it is.
          // BRAND-01, 2026-08-18 — the Facebook entry used to be
          // facebook.com/ThePickleHub. That vanity URL is NOT ours: Facebook
          // resolves it to facebook.com/thepicklehub/, whose og:title is
          // Pickle Hub | Guntur — an unrelated business in Andhra Pradesh,
          // India. The one block written to consolidate the brand entity was
          // instead asserting sameAs identity with a different company that
          // shares the name, which is the confusion behind the spaced query
          // sitting at position 8. Ours is facebook.com/thepicklehubnet —
          // confirmed by Cuong 2026-08-18, page ID 61579261671499, and by
          // og:title = thepicklehub.net. (Facebook's own og:url appends a
          // trailing slash; both forms serve the same page.)
          //
          // Instagram and YouTube both removed 2026-08-18: Cuong confirmed
          // neither presence exists. instagram.com/thepicklehub and
          // youtube.com/@thepicklehub (channel UC00BA7NxlshRE9ik9ssTYiw, 15
          // subscribers, og:title "ThePickleHub") are somebody else's.
          //
          // All three bad entries got in the same way, and it is worth naming
          // the pattern: a handle matched the brand name, the URL returned
          // 200, and that was treated as proof of ownership. It is not. Only
          // Cuong can confirm a profile is ours — verify with him before
          // adding anything to this list.
          //
          // X added 2026-08-18, and unlike the Facebook entry it is evidenced
          // rather than guessed: workers/social-poster/wrangler.toml documents
          // X_CLIENT_ID as "console.x.com, @thepicklehub", the account the
          // poster authenticates as. x.com/thepicklehub returns 200 while a
          // nonsense handle returns 404, so the 200 is meaningful here.
          //
          // NB: keep prose out of this array — brand-sameas.test.ts extracts
          // every quoted string inside it and asserts each one is a URL.
          sameAs: [
            "https://www.facebook.com/thepicklehubnet",
            "https://x.com/thepicklehub",
            "https://apps.apple.com/app/id6759968026",
          ],
        },
        {
          "@type": "WebSite",
          "@id": `${siteUrl}#website`,
          url: siteUrl,
          name: "ThePickleHub",
          publisher: { "@id": `${siteUrl}#org` },
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${siteUrl}/search?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        },
      ],
    },
    bodyContent: `
      <h1>Everything a pickleball player needs, in one place.</h1>
      <p>ThePickleHub is a pickleball platform for players to follow news and livestreams, find players and courts, and create or join tournaments and community events.</p>
      <p>Google Sign-In uses only your name, email address, and profile photo to create, secure, and personalize your account. Read our <a href="${siteUrl}/privacy">Privacy Policy</a>.</p>
      <p>Our editorial team is headquartered in Ho Chi Minh City and reports from PPA, APP, MLP, European Open, and Asia Pacific Series venues worldwide.</p>
      <ul>
        <li><a href="${siteUrl}/live">Live courts</a> — Watch matches streaming right now</li>
        <li><a href="${siteUrl}/tournaments">Tournaments</a> — Schedules, brackets, results across PPA Asia and beyond</li>
        <li><a href="${siteUrl}/social">Community events</a> — Open pickleball events you can register for by phone</li>
        <li><a href="${siteUrl}/clubs">Clubs</a> — Pickleball clubs across Vietnam with schedules + events</li>
        <li><a href="${siteUrl}/san">Courts</a> — Pickleball court directory: 690+ courts across Vietnam, browsable by city</li>
        <li><a href="${siteUrl}/feed">Match feed</a> — Latest community matches, scores, and DUPR ratings</li>
        <li><a href="${siteUrl}/tools">Bracket Lab</a> — Free tournament tools (round robin, single/double elimination, MLP)</li>
        <li><a href="${siteUrl}/rankings">Rankings</a> — Player rankings (placeholder, coming soon)</li>
        <li><a href="${siteUrl}/blog">Stories</a> — Match reports and longform coverage</li>
        <li><a href="${siteUrl}/news">News</a> — Daily pickleball updates</li>
        <li><a href="${siteUrl}/videos">Videos</a> — Match highlights (Courtside)</li>
        <li><a href="${siteUrl}/forum">Forum</a> — Community discussions</li>
        <li><a href="${siteUrl}/openapi.json">API specification</a> — Machine-readable OpenAPI 3.1 contract</li>
      </ul>
      <h2>Find pickleball courts by city</h2>
      <ul>
        <li><a href="${siteUrl}/san/khu-vuc/tp-hcm">Pickleball courts in TP.HCM</a></li>
        <li><a href="${siteUrl}/san/khu-vuc/ha-noi">Pickleball courts in Hà Nội</a></li>
        <li><a href="${siteUrl}/san/khu-vuc/da-nang">Pickleball courts in Đà Nẵng</a></li>
        <li><a href="${siteUrl}/san/khu-vuc/bac-ninh">Pickleball courts in Bắc Ninh</a></li>
        <li><a href="${siteUrl}/san/khu-vuc/ha-long">Pickleball courts in Hạ Long</a></li>
        <li><a href="${siteUrl}/san/khu-vuc/vinh">Pickleball courts in Vinh</a></li>
      </ul>
      ${liveItems ? `<h2>Currently streaming</h2><ul>${liveItems}</ul>` : ""}
      ${videoItems ? `<h2>Latest videos</h2><ul>${videoItems}</ul>` : ""}
      ${viBlogSection}
    `,
  }));
}

export async function renderHomeVi(supabase: SupabaseClient, siteUrl: string): Promise<Response> {
  const [liveRes, videoRes, blogRes, venueCount] = await Promise.all([
    supabase.from("public_livestreams").select("id, title, status").in("status", ["live", "scheduled"]).order("created_at", { ascending: false }).limit(10),
    supabase.from("videos").select("id, title").eq("status", "published").order("published_at", { ascending: false }).limit(10),
    supabase.from("vi_blog_posts").select("slug, title, excerpt").eq("status", "published").order("published_at", { ascending: false }).limit(6),
    flooredVenueCount(supabase),
  ]);

  const liveItems = (liveRes.data || []).map((l) => `<li><a href="${siteUrl}/live/${l.id}">${escapeHtml(l.title)}</a> (${l.status})</li>`).join("");
  const videoItems = (videoRes.data || []).map((v) => `<li><a href="${siteUrl}/watch/${v.id}">${escapeHtml(v.title)}</a></li>`).join("");
  const blogItems = (blogRes.data || []).map((b) => `<li><a href="${siteUrl}/vi/blog/${b.slug}"><h3>${escapeHtml(b.title)}</h3><p>${escapeHtml(b.excerpt || "")}</p></a></li>`).join("");

  const blogSection = blogItems ? `<h2>Bài viết mới nhất</h2><ul>${blogItems}</ul><p><a href="${siteUrl}/vi/blog">Xem tất cả bài viết</a></p>` : "";

  return htmlResponse(buildHtml({
    title: "ThePickleHub – Pickleball Châu Á: Live & Giải đấu",
    // CTR-03 (2026-08-25) — this description was being TRUNCATED in production.
    // At 186 UTF-8 bytes it blew pickMetaDescription's 160-byte budget, and the
    // live page was serving "…miễn…" — the sentence stopped mid-word. Nobody
    // noticed because the string is 148 characters, which looks safely inside
    // 160 until you remember Vietnamese diacritics cost 2-3 bytes each. Same
    // unit confusion as buildTitle #468 and the venue snippets in CTR-01.
    //
    // The replacement is 156 bytes with the count, 146 without, and it leads
    // with what VI searchers actually query — lịch giải, xem trực tiếp, bảng
    // xếp hạng, sân — instead of a claim about the platform. Byte budget is
    // enforced by functions/_lib/render/__tests__/home-meta.test.ts; do not
    // edit this string without running it.
    description: venueCount
      ? `Lịch giải pickleball, link xem trực tiếp, bảng xếp hạng DUPR và hơn ${venueCount} sân khắp Việt Nam. Cập nhật hằng ngày trên ThePickleHub.`
      : "Lịch giải pickleball, link xem trực tiếp, bảng xếp hạng DUPR và sân chơi khắp Việt Nam. Cập nhật hằng ngày trên ThePickleHub.",
    url: `${siteUrl}/vi`,
    siteUrl,
    lang: "vi",
    // SEO audit 2026-08-11 — see renderHome: drop the auto <h1> (title) so the
    // body <h1> is the single H1. The VI page was doubly wrong here — the auto
    // H1 was the full 58-char title AND the body had its own H1.
    omitAutoHeader: true,
    // PR73 Phase 2D (audit I-12) — see renderHome above. Same trailing-
    // slash mismatch (canonical without slash vs hreflang en/x-default
    // with slash). Aligned to the no-trailing-slash convention.
    extraMeta: `<link rel="alternate" hreflang="vi" href="${siteUrl}/vi"/>\n<link rel="alternate" hreflang="en" href="${siteUrl}"/>\n<link rel="alternate" hreflang="x-default" href="${siteUrl}"/>`,
    jsonLd: {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${siteUrl}#org`,
          name: "ThePickleHub",
          // Brand-entity consolidation (see renderHome): bind spaced/variant
          // brand searches to this entity so the homepage wins the brand query.
          alternateName: ["The Pickle Hub", "Pickle Hub", "Picklehub"],
          url: siteUrl,
          logo: DEFAULT_OG_IMAGE,
          description: "Đưa tin pickleball chuyên nghiệp toàn cầu — PPA, APP, MLP, European Open, Asia Pacific Series. Song ngữ Việt-Anh. Trụ sở tại TP.HCM.",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Ho Chi Minh City",
            addressCountry: "VN",
          },
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            email: "tapickleballvn@gmail.com",
            url: `${siteUrl}/contact`,
            availableLanguage: ["vi", "en"],
          },
          // sameAs must only ever list profiles that resolve AND that are ours.
          // A 404 here is a dirty signal on the exact entity these blocks exist
          // to consolidate ("the pickle hub" ranks ~pos 8 on its own name) —
          // and, per BRAND-01 below, a 200 that belongs to someone else is
          // worse than a 404, because it asserts we ARE the other company.
          //
          // The App Store listing is verified live: apps.apple.com/app/id6759968026
          // returns 200 as "ThePickleHub: Tournaments", developer NGUYEN THE CUONG.
          //
          // No Play Store entry on purpose. The 2026-07-24 SEO brief asked for
          // play.google.com/store/apps/details?id=net.thepicklehub.app — that URL
          // 404s on every locale and app-id variant tried (hl=vi&gl=VN, hl=en&gl=US,
          // com.thepicklehub.app, net.thepicklehub). The Android app is not
          // published. Add it here when it is.
          // BRAND-01, 2026-08-18 — the Facebook entry used to be
          // facebook.com/ThePickleHub. That vanity URL is NOT ours: Facebook
          // resolves it to facebook.com/thepicklehub/, whose og:title is
          // Pickle Hub | Guntur — an unrelated business in Andhra Pradesh,
          // India. The one block written to consolidate the brand entity was
          // instead asserting sameAs identity with a different company that
          // shares the name, which is the confusion behind the spaced query
          // sitting at position 8. Ours is facebook.com/thepicklehubnet —
          // confirmed by Cuong 2026-08-18, page ID 61579261671499, and by
          // og:title = thepicklehub.net. (Facebook's own og:url appends a
          // trailing slash; both forms serve the same page.)
          //
          // Instagram and YouTube both removed 2026-08-18: Cuong confirmed
          // neither presence exists. instagram.com/thepicklehub and
          // youtube.com/@thepicklehub (channel UC00BA7NxlshRE9ik9ssTYiw, 15
          // subscribers, og:title "ThePickleHub") are somebody else's.
          //
          // All three bad entries got in the same way, and it is worth naming
          // the pattern: a handle matched the brand name, the URL returned
          // 200, and that was treated as proof of ownership. It is not. Only
          // Cuong can confirm a profile is ours — verify with him before
          // adding anything to this list.
          //
          // X added 2026-08-18, and unlike the Facebook entry it is evidenced
          // rather than guessed: workers/social-poster/wrangler.toml documents
          // X_CLIENT_ID as "console.x.com, @thepicklehub", the account the
          // poster authenticates as. x.com/thepicklehub returns 200 while a
          // nonsense handle returns 404, so the 200 is meaningful here.
          //
          // NB: keep prose out of this array — brand-sameas.test.ts extracts
          // every quoted string inside it and asserts each one is a URL.
          sameAs: [
            "https://www.facebook.com/thepicklehubnet",
            "https://x.com/thepicklehub",
            "https://apps.apple.com/app/id6759968026",
          ],
        },
        {
          "@type": "WebSite",
          "@id": `${siteUrl}#website`,
          url: siteUrl,
          name: "ThePickleHub",
          publisher: { "@id": `${siteUrl}#org` },
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${siteUrl}/search?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        },
      ],
    },
    bodyContent: `
      <h1>Mọi thứ người chơi pickleball cần, trong một điểm đến.</h1>
      <p>ThePickleHub là nền tảng pickleball dành cho người chơi trên toàn thế giới theo dõi tin tức và livestream, tìm bạn chơi và sân, đồng thời tạo hoặc tham gia giải đấu và sự kiện cộng đồng.</p>
      <p>Đội ngũ biên tập đặt tại TP.HCM và tường thuật từ PPA, APP, MLP, European Open cùng Asia Pacific Series trên toàn thế giới.</p>
      <ul>
        <li><a href="${siteUrl}/vi/live">Sân trực tiếp</a> — Xem trận đấu đang diễn ra</li>
        <li><a href="${siteUrl}/vi/tournaments">Giải đấu</a> — Lịch, bracket, kết quả</li>
        <li><a href="${siteUrl}/social">Sự kiện cộng đồng</a> — Đăng ký sự kiện pickleball mở bằng số điện thoại</li>
        <li><a href="${siteUrl}/clubs">Câu lạc bộ</a> — CLB pickleball khắp Việt Nam, lịch sinh hoạt và sự kiện</li>
        <li><a href="${siteUrl}/vi/san">Sân pickleball</a> — Danh bạ 690+ sân pickleball khắp Việt Nam, tìm theo khu vực</li>
        <li><a href="${siteUrl}/vi/feed">Bảng tin trận đấu</a> — Trận đấu cộng đồng mới nhất + rating DUPR</li>
        <li><a href="${siteUrl}/vi/tools">Bracket Lab</a> — Công cụ tổ chức miễn phí</li>
        <li><a href="${siteUrl}/vi/rankings">Bảng xếp hạng</a> — Sắp ra mắt</li>
        <li><a href="${siteUrl}/vi/blog">Bài viết</a> — Tường thuật và bài chuyên sâu</li>
        <li><a href="${siteUrl}/vi/news">Tin tức</a> — Cập nhật pickleball hàng ngày</li>
        <li><a href="${siteUrl}/vi/videos">Video</a> — Highlights trận đấu</li>
        <li><a href="${siteUrl}/vi/forum">Diễn đàn</a> — Thảo luận cộng đồng</li>
        <li><a href="${siteUrl}/openapi.json">Đặc tả API</a> — Hợp đồng OpenAPI 3.1 dành cho máy đọc</li>
      </ul>
      <h2>Tìm sân pickleball theo khu vực</h2>
      <ul>
        <li><a href="${siteUrl}/vi/san/khu-vuc/tp-hcm">Sân pickleball TP.HCM</a></li>
        <li><a href="${siteUrl}/vi/san/khu-vuc/ha-noi">Sân pickleball Hà Nội</a></li>
        <li><a href="${siteUrl}/vi/san/khu-vuc/da-nang">Sân pickleball Đà Nẵng</a></li>
        <li><a href="${siteUrl}/vi/san/khu-vuc/bac-ninh">Sân pickleball Bắc Ninh</a></li>
        <li><a href="${siteUrl}/vi/san/khu-vuc/ha-long">Sân pickleball Hạ Long</a></li>
        <li><a href="${siteUrl}/vi/san/khu-vuc/vinh">Sân pickleball Vinh</a></li>
      </ul>
      ${blogSection}
      ${liveItems ? `<h2>Livestream</h2><ul>${liveItems}</ul>` : ""}
      ${videoItems ? `<h2>Video mới</h2><ul>${videoItems}</ul>` : ""}
    `,
  }));
}
