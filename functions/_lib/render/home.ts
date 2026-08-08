/**
 * SSR render handlers — home pages (/ and /vi).
 * SEO-04 — split from index.ts, code moved verbatim.
 */

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import { escapeHtml, DEFAULT_OG_IMAGE } from "../utils";

// ─── Home ───────────────────────────���─────────────────────

export async function renderHome(supabase: SupabaseClient, siteUrl: string): Promise<Response> {
  const [liveRes, videoRes, viBlogRes] = await Promise.all([
    supabase.from("public_livestreams").select("id, title, status").in("status", ["live", "scheduled"]).order("created_at", { ascending: false }).limit(10),
    supabase.from("videos").select("id, title").eq("status", "published").order("published_at", { ascending: false }).limit(10),
    supabase.from("vi_blog_posts").select("slug, title, excerpt").eq("status", "published").order("published_at", { ascending: false }).limit(3),
  ]);

  const liveItems = (liveRes.data || []).map((l) => `<li><a href="${siteUrl}/live/${l.id}">${escapeHtml(l.title)}</a> (${l.status})</li>`).join("");
  const videoItems = (videoRes.data || []).map((v) => `<li><a href="${siteUrl}/watch/${v.id}">${escapeHtml(v.title)}</a></li>`).join("");
  const viBlogItems = (viBlogRes.data || []).map((b) => `<li><a href="${siteUrl}/vi/blog/${b.slug}" hreflang="vi">${escapeHtml(b.title)}</a></li>`).join("");

  const viBlogSection = viBlogItems
    ? `<h2>Pickleball in Vietnam</h2><p>Vietnamese pickleball content from our local team:</p><ul>${viBlogItems}</ul><p><a href="${siteUrl}/vi" hreflang="vi">Visit Vietnamese site</a></p>`
    : "";

  const title = "ThePickleHub – Pickleball Asia: Live, Brackets & News";
  const description = "The only bilingual pickleball platform built for Asia. Tournaments, livestream, and news in Vietnamese and English — free for organizers and players.";

  return htmlResponse(buildHtml({
    title,
    description,
    url: siteUrl,
    siteUrl,
    lang: "en",
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
          // sameAs must only ever list profiles that resolve. A 404 here is a
          // dirty signal on the exact entity these blocks exist to consolidate
          // ("the pickle hub" ranks ~pos 8 on its own name).
          //
          // The App Store listing is verified live: apps.apple.com/app/id6759968026
          // returns 200 as "ThePickleHub: Tournaments", developer NGUYEN THE CUONG.
          //
          // No Play Store entry on purpose. The 2026-07-24 SEO brief asked for
          // play.google.com/store/apps/details?id=net.thepicklehub.app — that URL
          // 404s on every locale and app-id variant tried (hl=vi&gl=VN, hl=en&gl=US,
          // com.thepicklehub.app, net.thepicklehub). The Android app is not
          // published. Add it here when it is.
          sameAs: [
            "https://www.facebook.com/ThePickleHub",
            "https://www.instagram.com/thepicklehub",
            "https://www.youtube.com/@thepicklehub",
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
  const [liveRes, videoRes, blogRes] = await Promise.all([
    supabase.from("public_livestreams").select("id, title, status").in("status", ["live", "scheduled"]).order("created_at", { ascending: false }).limit(10),
    supabase.from("videos").select("id, title").eq("status", "published").order("published_at", { ascending: false }).limit(10),
    supabase.from("vi_blog_posts").select("slug, title, excerpt").eq("status", "published").order("published_at", { ascending: false }).limit(6),
  ]);

  const liveItems = (liveRes.data || []).map((l) => `<li><a href="${siteUrl}/live/${l.id}">${escapeHtml(l.title)}</a> (${l.status})</li>`).join("");
  const videoItems = (videoRes.data || []).map((v) => `<li><a href="${siteUrl}/watch/${v.id}">${escapeHtml(v.title)}</a></li>`).join("");
  const blogItems = (blogRes.data || []).map((b) => `<li><a href="${siteUrl}/vi/blog/${b.slug}"><h3>${escapeHtml(b.title)}</h3><p>${escapeHtml(b.excerpt || "")}</p></a></li>`).join("");

  const blogSection = blogItems ? `<h2>Bài viết mới nhất</h2><ul>${blogItems}</ul><p><a href="${siteUrl}/vi/blog">Xem tất cả bài viết</a></p>` : "";

  return htmlResponse(buildHtml({
    title: "ThePickleHub – Pickleball Châu Á: Live & Giải đấu",
    description: "Nền tảng pickleball song ngữ duy nhất xây cho châu Á. Giải đấu, livestream và tin tức bằng tiếng Việt và tiếng Anh — miễn phí cho BTC và người chơi.",
    url: `${siteUrl}/vi`,
    siteUrl,
    lang: "vi",
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
          // sameAs must only ever list profiles that resolve. A 404 here is a
          // dirty signal on the exact entity these blocks exist to consolidate
          // ("the pickle hub" ranks ~pos 8 on its own name).
          //
          // The App Store listing is verified live: apps.apple.com/app/id6759968026
          // returns 200 as "ThePickleHub: Tournaments", developer NGUYEN THE CUONG.
          //
          // No Play Store entry on purpose. The 2026-07-24 SEO brief asked for
          // play.google.com/store/apps/details?id=net.thepicklehub.app — that URL
          // 404s on every locale and app-id variant tried (hl=vi&gl=VN, hl=en&gl=US,
          // com.thepicklehub.app, net.thepicklehub). The Android app is not
          // published. Add it here when it is.
          sameAs: [
            "https://www.facebook.com/ThePickleHub",
            "https://www.instagram.com/thepicklehub",
            "https://www.youtube.com/@thepicklehub",
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
