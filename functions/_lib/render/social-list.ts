// ============================================================================
// renderSocialList + renderClubList — PR73 Phase 2B (SEO audit I-1 + I-2).
// ----------------------------------------------------------------------------
// Bot-prerender for the four hub pages that used to fall through to the
// generic renderDefault shell:
//   /social     /vi/social   /clubs      /vi/clubs
//
// Both pages publish:
//   - Bilingual title + meta description
//   - Server-rendered <ul>/<ol> of the top 20 entries so a text-only
//     crawler still sees real anchor text + venue/club info (no JS
//     execution required)
//   - JSON-LD ItemList covering the same entries (richer SERP card)
//   - hreflang vi / en / x-default — single canonical pattern matches
//     renderFeed; the SPA toggles locale on the same URL
//   - Breadcrumb + cross-discovery nav at the bottom
//
// KV cache: middleware applies a 5-minute TTL override for these paths
// (`pathCacheTtl` in functions/_middleware.ts) — registration counts and
// new-event publishes shouldn't be stuck behind a 6h crawler cache.
// ============================================================================

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import { escapeHtml, type Lang } from "../utils";

const LIST_LIMIT = 20;

interface SocialListRow {
  slug: string;
  title_vi: string;
  title_en: string | null;
  start_at: string;
  end_at: string;
  location_text: string | null;
  price_vnd: number;
  max_players: number;
  court_count: number;
  club: { slug: string; name: string } | null;
}

interface ClubListRow {
  id: string;
  slug: string;
  name: string;
  location_text: string | null;
  logo_url: string | null;
}

function fmtDateVN(iso: string, lang: Lang): string {
  try {
    return new Date(iso).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return "";
  }
}

function fmtPrice(vnd: number, lang: Lang): string {
  if (vnd <= 0) return lang === "vi" ? "Miễn phí" : "Free";
  return `${vnd.toLocaleString("vi-VN")}₫`;
}

/**
 * Pick the locale-appropriate title for an event listing, with safe
 * fallback when the English title is null, undefined, an empty string,
 * or whitespace-only.
 *
 * PR75 Codex P2 follow-up on PR #73: the ItemList JSON-LD branch
 * originally used `title_en ?? title_vi`. The `??` operator only falls
 * back on null/undefined, so an event with `title_en = ""` (a common
 * data-entry shape — the organizer left the EN field blank in the
 * editor and the SQL persisted "" instead of NULL) emitted
 * `"name": ""` into structured data. Google's Rich Results parser
 * treats that as an invalid ItemList element and may suppress the
 * whole card.
 *
 * Centralising the policy in one helper keeps the HTML body heading
 * (line ~130) and the JSON-LD name (line ~155) on the same fallback
 * rule, so the next caller can't accidentally re-introduce the same
 * `??` bug.
 */
function pickListingTitle(
  lang: Lang,
  title_vi: string,
  title_en: string | null | undefined,
): string {
  if (lang === "vi") return title_vi;
  return title_en && title_en.trim().length > 0 ? title_en : title_vi;
}

// ─── /social + /vi/social ────────────────────────────────────────────────

export async function renderSocialList(
  supabase: SupabaseClient,
  siteUrl: string,
  lang: Lang,
): Promise<Response> {
  const canonical = `${siteUrl}/social`;
  const nowIso = new Date().toISOString();

  let rows: SocialListRow[] = [];
  try {
    const { data, error } = await supabase
      .from("social_events")
      .select(
        `slug, title_vi, title_en, start_at, end_at, location_text,
         price_vnd, max_players, court_count,
         club:clubs!social_events_club_id_fkey ( slug, name )`,
      )
      .eq("status", "published")
      .eq("visibility", "public")
      .gte("end_at", nowIso)
      .order("start_at", { ascending: true })
      .limit(LIST_LIMIT);
    if (error) {
      console.error("renderSocialList: query error", error);
    } else {
      rows = (data ?? []) as unknown as SocialListRow[];
    }
  } catch (err) {
    console.error("renderSocialList: fatal", err);
  }

  const titleVi = "Sự kiện pickleball cộng đồng | ThePickleHub";
  const titleEn = "Pickleball Community Events | ThePickleHub";
  const descVi = rows.length > 0
    ? `Đăng ký ${rows.length} sự kiện pickleball cộng đồng đang mở trên ThePickleHub — tìm CLB, sân chơi, ngày giờ và phí tham gia ở Hà Nội, TP.HCM và toàn quốc.`
    : "Khám phá sự kiện pickleball cộng đồng trên ThePickleHub — đăng ký nhanh bằng số điện thoại, ghép trận theo trình độ và theo dõi lịch CLB Việt Nam.";
  const descEn = rows.length > 0
    ? `Browse ${rows.length} open pickleball community events on ThePickleHub — find the club, court, schedule and fee for matches across Vietnam.`
    : "Discover pickleball community events on ThePickleHub — phone-number signup, level-matched play, and club schedules across Vietnam.";

  const title = lang === "vi" ? titleVi : titleEn;
  const description = lang === "vi" ? descVi : descEn;

  const itemsHtml = rows
    .map((e) => {
      const evTitle = pickListingTitle(lang, e.title_vi, e.title_en);
      const dateStr = fmtDateVN(e.start_at, lang);
      const startTime = fmtTime(e.start_at);
      const venue = e.location_text ?? "";
      const venueText = venue ? ` · ${escapeHtml(venue)}` : "";
      const clubLink = e.club
        ? ` — <a href="${siteUrl}/clb/${escapeHtml(e.club.slug)}">${escapeHtml(e.club.name)}</a>`
        : "";
      const priceLabel = fmtPrice(e.price_vnd, lang);
      // 2026-05-20 — surface court_count alongside venue + price so the
      // bot-readable summary line mirrors the new visual card.
      const courtsLabel =
        lang === "vi"
          ? `${e.court_count} sân`
          : `${e.court_count} court${e.court_count > 1 ? "s" : ""}`;
      return `<li><a href="${siteUrl}/social/${escapeHtml(e.slug)}">${escapeHtml(evTitle)}</a> — <strong>${escapeHtml(dateStr)}${startTime ? ` ${escapeHtml(startTime)}` : ""}</strong>${venueText}${clubLink} · ${escapeHtml(courtsLabel)} · ${escapeHtml(priceLabel)}</li>`;
    })
    .join("");

  const itemListJsonLd =
    rows.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: title,
          itemListOrder: "https://schema.org/ItemListOrderAscending",
          numberOfItems: rows.length,
          itemListElement: rows.map((e, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${siteUrl}/social/${e.slug}`,
            name: pickListingTitle(lang, e.title_vi, e.title_en),
          })),
        }
      : undefined;

  const headingMore =
    lang === "vi" ? "Khám phá thêm" : "Discover more";
  const moreLinks = [
    `<li><a href="${siteUrl}/clubs">${lang === "vi" ? "Danh sách câu lạc bộ" : "Browse clubs"}</a></li>`,
    `<li><a href="${siteUrl}/feed">${lang === "vi" ? "Bảng tin trận đấu" : "Match feed"}</a></li>`,
    `<li><a href="${siteUrl}/tournaments">${lang === "vi" ? "Giải đấu lớn" : "Pro tournaments"}</a></li>`,
  ].join("");

  const emptyMsg =
    lang === "vi"
      ? "Hiện chưa có sự kiện công khai sắp diễn ra."
      : "No upcoming public events right now.";

  const breadcrumbHtml =
    lang === "vi"
      ? `<nav aria-label="breadcrumb"><ol><li><a href="${siteUrl}/vi">Trang chủ</a></li> &gt; <li>Sự kiện</li></ol></nav>`
      : `<nav aria-label="breadcrumb"><ol><li><a href="${siteUrl}/">Home</a></li> &gt; <li>Events</li></ol></nav>`;

  const bodyContent = `${breadcrumbHtml}
<section>
<h2>${escapeHtml(lang === "vi" ? "Sự kiện sắp diễn ra" : "Upcoming events")}</h2>
${rows.length > 0 ? `<ol>${itemsHtml}</ol>` : `<p>${escapeHtml(emptyMsg)}</p>`}
</section>
<nav><h2>${escapeHtml(headingMore)}</h2><ul>${moreLinks}</ul></nav>`;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url: canonical,
      siteUrl,
      lang,
      type: "website",
      // PR (2026-05-18 Ahrefs Site Audit fix) — Ahrefs flagged
      // "One page is linked for more than one language" because previous
      // emit had en+vi+x-default all pointing to the same canonical URL.
      // Google's hreflang spec requires DIFFERENT URLs for different
      // languages; same-URL pattern is "invalid signal." Since this
      // page serves a single canonical for both locales (the SPA
      // toggles language client-side), we omit hreflang entirely —
      // safer than wrong signal.
      jsonLd: itemListJsonLd,
      bodyContent,
    }),
  );
}

// ─── /clubs + /vi/clubs ───────────────────────────────────────────────────

export async function renderClubList(
  supabase: SupabaseClient,
  siteUrl: string,
  lang: Lang,
): Promise<Response> {
  const canonical = `${siteUrl}/clubs`;

  // Prefer the club_listing view (sorted by upcoming_events DESC then
  // created_at DESC) when it exists — that's what the SPA's ClubsList page
  // uses. Fall back to the base clubs table if the view ever drops.
  let rows: ClubListRow[] = [];
  try {
    const { data, error } = await supabase
      .from("club_listing")
      .select("id, slug, name, location_text, logo_url")
      .order("upcoming_events", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT);
    if (error || !data) {
      // Soft fallback — keep prerender alive if the view is unreachable.
      console.warn("renderClubList: club_listing view miss, falling back", error);
      const { data: base } = await supabase
        .from("clubs")
        .select("id, slug, name, location_text, logo_url")
        .order("created_at", { ascending: false })
        .limit(LIST_LIMIT);
      rows = (base ?? []) as ClubListRow[];
    } else {
      rows = data as ClubListRow[];
    }
  } catch (err) {
    console.error("renderClubList: fatal", err);
  }

  const titleVi = "Câu lạc bộ pickleball Việt Nam | ThePickleHub";
  const titleEn = "Vietnam Pickleball Clubs | ThePickleHub";
  const descVi = rows.length > 0
    ? `${rows.length} câu lạc bộ pickleball tại Hà Nội, TP.HCM, Đà Nẵng và nhiều tỉnh thành — xem lịch sinh hoạt, đăng ký event, kết nối cộng đồng trên ThePickleHub.`
    : "Tìm câu lạc bộ pickleball Việt Nam — lịch sinh hoạt, sân chơi và sự kiện cộng đồng trên ThePickleHub. Tạo CLB miễn phí và đăng ký bằng số điện thoại.";
  const descEn = rows.length > 0
    ? `${rows.length} pickleball clubs across Hanoi, Ho Chi Minh City and beyond — browse schedules, register for events and find your community on ThePickleHub.`
    : "Find pickleball clubs across Vietnam — schedules, courts, community events on ThePickleHub. Create a club free, register by phone number.";

  const title = lang === "vi" ? titleVi : titleEn;
  const description = lang === "vi" ? descVi : descEn;

  const itemsHtml = rows
    .map((c) => {
      const locationText = c.location_text ? ` — ${escapeHtml(c.location_text)}` : "";
      return `<li><a href="${siteUrl}/clb/${escapeHtml(c.slug)}">${escapeHtml(c.name)}</a>${locationText}</li>`;
    })
    .join("");

  const itemListJsonLd =
    rows.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: title,
          numberOfItems: rows.length,
          itemListElement: rows.map((c, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${siteUrl}/clb/${c.slug}`,
            item: {
              "@type": "SportsOrganization",
              name: c.name,
              url: `${siteUrl}/clb/${c.slug}`,
              ...(c.location_text
                ? {
                    address: {
                      "@type": "PostalAddress",
                      addressLocality: c.location_text,
                      addressCountry: "VN",
                    },
                  }
                : {}),
            },
          })),
        }
      : undefined;

  const headingMore = lang === "vi" ? "Khám phá thêm" : "Discover more";
  const moreLinks = [
    `<li><a href="${siteUrl}/social">${lang === "vi" ? "Sự kiện cộng đồng" : "Community events"}</a></li>`,
    `<li><a href="${siteUrl}/feed">${lang === "vi" ? "Bảng tin trận đấu" : "Match feed"}</a></li>`,
    `<li><a href="${siteUrl}/tournaments">${lang === "vi" ? "Giải đấu lớn" : "Pro tournaments"}</a></li>`,
  ].join("");

  const emptyMsg =
    lang === "vi" ? "Chưa có câu lạc bộ nào." : "No clubs yet.";

  const breadcrumbHtml =
    lang === "vi"
      ? `<nav aria-label="breadcrumb"><ol><li><a href="${siteUrl}/vi">Trang chủ</a></li> &gt; <li>Câu lạc bộ</li></ol></nav>`
      : `<nav aria-label="breadcrumb"><ol><li><a href="${siteUrl}/">Home</a></li> &gt; <li>Clubs</li></ol></nav>`;

  const bodyContent = `${breadcrumbHtml}
<section>
<h2>${escapeHtml(lang === "vi" ? "Câu lạc bộ nổi bật" : "Featured clubs")}</h2>
${rows.length > 0 ? `<ul>${itemsHtml}</ul>` : `<p>${escapeHtml(emptyMsg)}</p>`}
</section>
<nav><h2>${escapeHtml(headingMore)}</h2><ul>${moreLinks}</ul></nav>`;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url: canonical,
      siteUrl,
      lang,
      type: "website",
      // PR (2026-05-18 Ahrefs Site Audit fix) — Ahrefs flagged
      // "One page is linked for more than one language" because previous
      // emit had en+vi+x-default all pointing to the same canonical URL.
      // Google's hreflang spec requires DIFFERENT URLs for different
      // languages; same-URL pattern is "invalid signal." Since this
      // page serves a single canonical for both locales (the SPA
      // toggles language client-side), we omit hreflang entirely —
      // safer than wrong signal.
      jsonLd: itemListJsonLd,
      bodyContent,
    }),
  );
}
