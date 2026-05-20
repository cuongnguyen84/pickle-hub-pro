// ============================================================================
// renderSocialEvent + renderClub — Social Events MVP prerender targets.
// ----------------------------------------------------------------------------
// Cloudflare Pages bot-prerender for /social/:slug and /clb/:slug.
// PR69 — renamed from /su-kien; legacy path still served via the
// middleware regex /^\/(?:social|su-kien)\/([^/]+)$/.
// Mirrors the renderMatch / renderProfile pattern — service-role Supabase
// query, build SportsEvent JSON-LD, hand off to buildHtml.
// ============================================================================

import type { SupabaseClient } from "../supabase";
import { buildHtml, htmlResponse } from "../html";
import {
  escapeHtml,
  buildTitle,
  breadcrumb,
  type Lang,
} from "../utils";
import { pickMetaDescription } from "../seo-helpers";
import { render404 } from "./index";

interface SocialEventRow {
  id: string;
  slug: string;
  title_vi: string;
  title_en: string | null;
  description_vi: string | null;
  description_en: string | null;
  start_at: string;
  end_at: string;
  location_text: string | null;
  location_lat: number | null;
  location_lng: number | null;
  max_players: number;
  price_vnd: number;
  status: "draft" | "published" | "cancelled" | "completed";
  visibility: "public" | "club_only";
  club: { slug: string; name: string } | null;
}

interface ClubRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  location_text: string | null;
}

interface ClubEventRow {
  slug: string;
  title_vi: string;
  start_at: string;
  end_at: string;
  status: string;
  visibility: string;
}

function fmtDateVN(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function fmtTimeVN(iso: string): string {
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

export async function renderSocialEvent(
  supabase: SupabaseClient,
  slug: string,
  siteUrl: string,
  lang: Lang = "vi",
): Promise<Response> {
  const { data, error } = await supabase
    .from("social_events")
    .select(
      `id, slug, title_vi, title_en, description_vi, description_en,
       start_at, end_at, location_text, location_lat, location_lng,
       max_players, price_vnd, status, visibility,
       club:clubs!social_events_club_id_fkey ( slug, name )`,
    )
    .eq("slug", slug)
    .eq("status", "published")
    .eq("visibility", "public")
    .maybeSingle();

  if (error) {
    console.error("renderSocialEvent: lookup error", { slug, error });
  }

  if (!data) return render404(`/social/${slug}`, siteUrl);

  const ev = data as unknown as SocialEventRow;
  // 2026-05-20 — Bilingual canonical pattern (mirrors /feed). The EN canonical
  // is /social/{slug}; the VI canonical is /vi/social/{slug}. Cross-emitted
  // hreflang lets Google connect the two locales instead of collapsing them.
  const titleVi = ev.title_vi;
  const titleEn = ev.title_en && ev.title_en.trim().length > 0 ? ev.title_en : ev.title_vi;
  const enUrl = `${siteUrl}/social/${ev.slug}`;
  const viUrl = `${siteUrl}/vi/social/${ev.slug}`;
  const url = lang === "vi" ? viUrl : enUrl;

  // Registered count for offers.availability ("InStock" / "SoldOut").
  let registeredCount = 0;
  try {
    const { count } = await supabase
      .from("event_registrations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", ev.id)
      .neq("status", "cancelled");
    registeredCount = count ?? 0;
  } catch {
    // non-fatal
  }

  const dateStr = fmtDateVN(ev.start_at);
  const startTime = fmtTimeVN(ev.start_at);
  const endTime = fmtTimeVN(ev.end_at);
  const venueLabel = ev.location_text ?? "";
  const displayTitle = lang === "vi" ? titleVi : titleEn;
  const rawTitle = `${displayTitle} — ${dateStr}${venueLabel ? ` · ${venueLabel}` : ""}`;
  const title = buildTitle(rawTitle, " | ThePickleHub");

  // Description: club + date + capacity + price short sentence per locale.
  const priceLabel =
    ev.price_vnd > 0
      ? `${ev.price_vnd.toLocaleString("vi-VN")}₫`
      : lang === "vi"
        ? "Miễn phí"
        : "Free";
  const hostLabelVi = ev.club ? `${ev.club.name} tổ chức` : "Sự kiện pickleball";
  const hostLabelEn = ev.club ? `Hosted by ${ev.club.name}` : "Pickleball community event";
  const fallbackDescVi =
    `${hostLabelVi} ngày ${dateStr} ${startTime ? `lúc ${startTime}` : ""}` +
    `${venueLabel ? ` tại ${venueLabel}` : ""}.` +
    ` Tối đa ${ev.max_players} người · ${priceLabel}.` +
    ` Đăng ký bằng số điện thoại trên ThePickleHub.`;
  const fallbackDescEn =
    `${hostLabelEn} on ${dateStr}${startTime ? ` at ${startTime}` : ""}` +
    `${venueLabel ? ` · ${venueLabel}` : ""}.` +
    ` Up to ${ev.max_players} players · ${priceLabel}.` +
    ` Register by phone number on ThePickleHub.`;
  // PR73 Phase 2C (audit I-3) — pickMetaDescription returns the
  // event-specific date/venue/capacity/price fallback when the organizer
  // hasn't written a description. The previous wiring used
  // buildMetaDescription's generic-platform fallback which made the
  // `|| fallbackDesc` branch dead code (same Codex P2 issue as PR #19).
  const description =
    lang === "vi"
      ? pickMetaDescription(ev.description_vi, fallbackDescVi)
      : pickMetaDescription(ev.description_en ?? ev.description_vi, fallbackDescEn);

  // PR73 Phase 2D (audit I-13) — breadcrumb label = actual club name
  // (e.g. "175 Định Công") instead of the generic literal "Sự kiện CLB"
  // that previously pointed at the same club page. When there is no
  // club we fall back to the generic "Sự kiện" / "Events" hub link.
  const homeLabel = lang === "vi" ? "Trang chủ" : "Home";
  const homeHref = lang === "vi" ? `${siteUrl}/vi` : siteUrl;
  const eventsLabel = lang === "vi" ? "Sự kiện" : "Events";
  const clubCrumb = ev.club
    ? { label: ev.club.name, href: `${siteUrl}/clb/${ev.club.slug}` }
    : { label: eventsLabel, href: `${siteUrl}/social` };
  const bc = breadcrumb([
    { label: homeLabel, href: homeHref },
    clubCrumb,
    { label: displayTitle },
  ]);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: displayTitle,
    description,
    url,
    sport: "Pickleball",
    startDate: ev.start_at,
    endDate: ev.end_at,
    eventStatus:
      ev.status === "cancelled"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    organizer: ev.club
      ? {
          "@type": "SportsOrganization",
          name: ev.club.name,
          url: `${siteUrl}/clb/${ev.club.slug}`,
        }
      : { "@type": "Organization", name: "ThePickleHub", url: siteUrl },
    location: ev.location_text
      ? {
          "@type": "Place",
          name: ev.location_text,
          address: ev.location_text,
          ...(ev.location_lat != null && ev.location_lng != null
            ? {
                geo: {
                  "@type": "GeoCoordinates",
                  latitude: ev.location_lat,
                  longitude: ev.location_lng,
                },
              }
            : {}),
        }
      : { "@type": "VirtualLocation", url },
    offers: {
      "@type": "Offer",
      url,
      price: ev.price_vnd,
      priceCurrency: "VND",
      availability:
        registeredCount >= ev.max_players
          ? "https://schema.org/SoldOut"
          : "https://schema.org/InStock",
      validFrom: ev.start_at,
    },
  };

  const lbl = lang === "vi"
    ? { time: "Thời gian", venue: "Địa điểm", max: "Số người tối đa", fee: "Phí" }
    : { time: "When", venue: "Where", max: "Max players", fee: "Fee" };
  const descBody = lang === "vi"
    ? (ev.description_vi ?? "")
    : (ev.description_en && ev.description_en.trim().length > 0
        ? ev.description_en
        : (ev.description_vi ?? ""));

  const bodyParts: string[] = [bc];
  bodyParts.push(`<h1>${escapeHtml(displayTitle)}</h1>`);
  bodyParts.push(`<p><strong>${lbl.time}:</strong> ${escapeHtml(dateStr)} · ${escapeHtml(startTime)} – ${escapeHtml(endTime)}</p>`);
  if (ev.location_text) {
    bodyParts.push(`<p><strong>${lbl.venue}:</strong> ${escapeHtml(ev.location_text)}</p>`);
  }
  bodyParts.push(`<p><strong>${lbl.max}:</strong> ${ev.max_players}</p>`);
  bodyParts.push(`<p><strong>${lbl.fee}:</strong> ${escapeHtml(priceLabel)}</p>`);
  if (descBody) {
    bodyParts.push(`<p>${escapeHtml(descBody).replace(/\n/g, "<br>")}</p>`);
  }

  return htmlResponse(
    buildHtml({
      title,
      description,
      url,
      siteUrl,
      // PR79 Phase 2E (audit I-6) — event-specific OG image generated by
      // /og/social/{slug}.png (CF Pages proxy in front of the
      // og-image-social-event Supabase function). Falls back to
      // DEFAULT_OG_IMAGE when the proxy is unreachable.
      image: `${siteUrl}/og/social/${encodeURIComponent(ev.slug)}.png`,
      jsonLd,
      bodyContent: bodyParts.join("\n"),
      lang,
      // 2026-05-20 — Bilingual canonical for social event detail.
      // Mirrors the /feed pattern: each locale gets its own canonical
      // URL (/social/{slug} for EN, /vi/social/{slug} for VI) and the
      // cross-emitted hreflang links pair them. Previous single-
      // canonical design (PR73 Phase 2D) was rolled back here because
      // the SPA only forced VI inside /vi/* routes, so non-VN visitors
      // landing on /social/{slug} saw English UI without any
      // discoverable VI URL.
      alternates: [
        { hreflang: "en", href: enUrl },
        { hreflang: "vi", href: viUrl },
        { hreflang: "x-default", href: enUrl },
      ],
      // PR73 Phase 2D (audit I-11) — bodyContent already opens with a
      // clean `<h1>${displayTitle}</h1>`, so skip buildHtml's auto h1
      // (which would have emitted the decorated full page-title as a
      // second h1, the duplicate flagged by Ahrefs).
      omitAutoHeader: true,
    }),
  );
}

export async function renderClub(
  supabase: SupabaseClient,
  slug: string,
  siteUrl: string,
): Promise<Response> {
  const { data, error } = await supabase
    .from("clubs")
    .select("id, slug, name, description, location_text")
    .eq("slug", slug)
    .maybeSingle();

  if (error) {
    console.error("renderClub: lookup error", { slug, error });
  }
  if (!data) return render404(`/clb/${slug}`, siteUrl);

  const club = data as unknown as ClubRow;
  const url = `${siteUrl}/clb/${club.slug}`;
  const title = buildTitle(club.name, " | CLB Pickleball · ThePickleHub");
  const fallbackDesc =
    `${club.name}${club.location_text ? ` tại ${club.location_text}` : ""} — ` +
    "lịch sự kiện pickleball, đăng ký, kết quả. Tổ chức trên ThePickleHub.";
  // PR73 Phase 2C (audit I-3) — see renderSocialEvent above. Same dead
  // fallback pattern: clubs without a description ended up with the
  // generic platform copy instead of the location/CTA-specific
  // fallbackDesc built right above. pickMetaDescription routes to
  // fallback when the description is empty/too-short.
  const description = pickMetaDescription(club.description, fallbackDesc);

  // List a snapshot of upcoming events as bot-readable links.
  const { data: events } = await supabase
    .from("social_events")
    .select("slug, title_vi, start_at, end_at, status, visibility")
    .eq("club_id", club.id)
    .eq("status", "published")
    .eq("visibility", "public")
    .gte("end_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(20);

  const upcoming = (events ?? []) as ClubEventRow[];
  const itemListJsonLd =
    upcoming.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: `${club.name} — sự kiện sắp diễn ra`,
          itemListElement: upcoming.map((e, i) => ({
            "@type": "ListItem",
            position: i + 1,
            url: `${siteUrl}/social/${e.slug}`,
            name: e.title_vi,
          })),
        }
      : undefined;

  // PR73 Phase 2D (audit I-13) — "CLB" crumb now links to the /clubs hub
  // list instead of the homepage (it was pointing at siteUrl, identical
  // to the Trang-chủ crumb — duplicate-link signal). Phase 2B added the
  // /clubs prerender so the link now resolves to real content.
  const bc = breadcrumb([
    { label: "Trang chủ", href: siteUrl },
    { label: "Câu lạc bộ", href: `${siteUrl}/clubs` },
    { label: club.name },
  ]);

  const eventList = upcoming
    .map(
      (e) =>
        `<li><a href="${siteUrl}/social/${escapeHtml(e.slug)}">${escapeHtml(e.title_vi)}</a> — ${escapeHtml(fmtDateVN(e.start_at))}</li>`,
    )
    .join("");
  const eventListBlock =
    upcoming.length > 0
      ? `<h2>Sự kiện sắp diễn ra</h2><ul>${eventList}</ul>`
      : "<p>Chưa có sự kiện công khai.</p>";

  const bodyContent =
    `${bc}<h1>${escapeHtml(club.name)}</h1>` +
    (club.location_text ? `<p><strong>Địa điểm:</strong> ${escapeHtml(club.location_text)}</p>` : "") +
    (club.description ? `<p>${escapeHtml(club.description).replace(/\n/g, "<br>")}</p>` : "") +
    eventListBlock;

  return htmlResponse(
    buildHtml({
      title,
      description,
      url,
      siteUrl,
      // PR79 Phase 2E (audit I-6) — club-specific OG image generated by
      // /og/clb/{slug}.png (CF Pages proxy in front of the og-image-club
      // Supabase function). Falls back to DEFAULT_OG_IMAGE when the
      // proxy is unreachable.
      image: `${siteUrl}/og/clb/${encodeURIComponent(club.slug)}.png`,
      jsonLd: itemListJsonLd,
      bodyContent,
      lang: "vi",
      // PR73 Phase 2D (audit I-5) — reciprocal hreflang on the single-
      // canonical /clb/{slug} URL.
      // PR (2026-05-18 Ahrefs Site Audit fix) — same as social-list:
      // single-canonical /clb/{slug} can't emit en+vi hreflang to the
      // same URL (Ahrefs / Google flag as conflicting). Omit instead.
      // PR73 Phase 2D (audit I-11) — bodyContent already emits its own
      // `<h1>${club.name}</h1>`. Skip the auto h1 to avoid double-h1.
      omitAutoHeader: true,
    }),
  );
}
