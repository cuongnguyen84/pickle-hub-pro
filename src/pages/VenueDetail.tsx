// ============================================================================
// VenueDetail (`/san/:slug`) — single pickleball court page.
// ----------------------------------------------------------------------------
// Public page. Shows cover image, name, address, a feature row (court count,
// indoor/outdoor, surface, verified), an OpenStreetMap embed (no API key) when
// coordinates exist, contact links (call / website), opening hours, and a
// "Chỉ đường" (directions) CTA that falls back to a Google Maps address
// search for ungeocoded venues. The SSR mirror lives in
// functions/_lib/render/venues.ts (SportsActivityLocation JSON-LD).
// ============================================================================

import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  MapPin,
  Navigation,
  Phone,
  Globe,
  Share2,
  BadgeCheck,
  Plus,
} from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import { VenueCard } from "@/components/venues/VenueCard";
import {
  type Venue,
  VENUE_DETAIL_COLUMNS,
  venueDisplayName,
  venueFullAddress,
  venueDirectionsUrl,
  venueOsmEmbedUrl,
  courtsLabel,
  indoorLabel,
  surfaceLabel,
  citySlugFromName,
  VENUE_LIST_COLUMNS,
  type VenueListItem,
} from "@/lib/venues";

const DAY_ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const DAY_LABELS: Record<string, { vi: string; en: string }> = {
  mon: { vi: "Thứ 2", en: "Mon" },
  tue: { vi: "Thứ 3", en: "Tue" },
  wed: { vi: "Thứ 4", en: "Wed" },
  thu: { vi: "Thứ 5", en: "Thu" },
  fri: { vi: "Thứ 6", en: "Fri" },
  sat: { vi: "Thứ 7", en: "Sat" },
  sun: { vi: "Chủ nhật", en: "Sun" },
};

export default function VenueDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { language } = useI18n();

  const { data: venue, isLoading } = useQuery<Venue | null>({
    queryKey: ["venue", slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from("venues")
        .select(VENUE_DETAIL_COLUMNS)
        .eq("slug", slug)
        .maybeSingle();
      if (error) {
        console.error("VenueDetail: fetch error", error);
        return null;
      }
      return (data as Venue | null) ?? null;
    },
    staleTime: 60_000,
  });

  const { data: nearby } = useQuery<VenueListItem[]>({
    queryKey: ["venue-nearby", venue?.city ?? null, slug],
    queryFn: async () => {
      if (!venue?.city || !slug) return [];
      const { data } = await supabase
        .from("venues")
        .select(VENUE_LIST_COLUMNS)
        .eq("city", venue.city)
        .neq("slug", slug)
        .order("is_verified", { ascending: false })
        .order("num_courts", { ascending: false })
        .limit(8);
      return (data as VenueListItem[]) ?? [];
    },
    enabled: Boolean(venue?.city && slug),
    staleTime: 60_000,
  });

  const hours = useMemo(() => {
    if (!venue?.hours_json) return [];
    return DAY_ORDER.filter((d) => venue.hours_json?.[d]).map((d) => ({
      day: language === "vi" ? DAY_LABELS[d].vi : DAY_LABELS[d].en,
      value: venue.hours_json![d],
    }));
  }, [venue, language]);

  if (isLoading) {
    return (
      <TheLineLayout title="…" active="venues">
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }

  if (!venue) {
    return (
      <TheLineLayout
        title={language === "vi" ? "Không tìm thấy sân | ThePickleHub" : "Court not found | ThePickleHub"}
        active="venues"
        noindex
      >
        <div className="tl-shell" style={{ padding: "60px 16px", maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <h1 className="mb-3 font-serif text-3xl italic" style={{ fontFamily: "'Instrument Serif', serif" }}>
            {language === "vi" ? "Không tìm thấy sân này" : "Court not found"}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {language === "vi"
              ? "Sân bạn tìm có thể đã bị xoá hoặc đường dẫn không đúng."
              : "This court may have been removed or the link is incorrect."}
          </p>
          <Link to="/san" className="tl-btn">
            ← {language === "vi" ? "Về danh sách sân" : "Back to courts"}
          </Link>
        </div>
      </TheLineLayout>
    );
  }

  const name = venueDisplayName(venue, language);
  const fullAddress = venueFullAddress(venue);
  const osmUrl = venueOsmEmbedUrl(venue);
  const directionsUrl = venueDirectionsUrl(venue);
  const surface = surfaceLabel(venue.surface_type, language);
  const citySlug = citySlugFromName(venue.city);
  const typeWord =
    venue.is_indoor == null ? "" : language === "vi" ? (venue.is_indoor ? "trong nhà" : "ngoài trời") : venue.is_indoor ? "indoor" : "outdoor";
  const courtsWord =
    venue.num_courts && venue.num_courts > 0
      ? language === "vi"
        ? `${venue.num_courts} sân`
        : `${venue.num_courts} court${venue.num_courts > 1 ? "s" : ""}`
      : "";
  const intro =
    language === "vi"
      ? `${name} là sân pickleball${typeWord ? ` ${typeWord}` : ""}${fullAddress ? ` tại ${fullAddress}` : ""}${courtsWord ? ` với ${courtsWord}` : ""}${surface ? `, mặt sân ${surface}` : ""}. Xem địa chỉ, bản đồ, chỉ đường và các sân pickleball khác${venue.city ? ` tại ${venue.city}` : ""} bên dưới.`
      : `${name} is a pickleball court${fullAddress ? ` at ${fullAddress}` : ""}${courtsWord ? ` with ${courtsWord}` : ""}${typeWord ? ` (${typeWord})` : ""}${surface ? `, ${surface} surface` : ""}. See the address, map, directions and other pickleball courts${venue.city ? ` in ${venue.city}` : ""} below.`;

  const metaDesc =
    (language === "vi"
      ? `Sân pickleball ${name}${fullAddress ? ` tại ${fullAddress}` : ""} — ${courtsLabel(venue.num_courts, "vi")}${
          venue.is_indoor != null ? `, ${indoorLabel(venue.is_indoor, "vi")}` : ""
        }. Xem địa chỉ, giờ mở cửa và chỉ đường trên ThePickleHub.`
      : `${name} pickleball court${fullAddress ? ` at ${fullAddress}` : ""} — ${courtsLabel(venue.num_courts, "en")}${
          venue.is_indoor != null ? `, ${indoorLabel(venue.is_indoor, "en")}` : ""
        }. Address, hours and directions on ThePickleHub.`);

  async function handleShare() {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: name, url });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast({ title: language === "vi" ? "Đã sao chép liên kết" : "Link copied" });
      }
    } catch {
      // user cancelled share sheet — ignore
    }
  }

  return (
    <TheLineLayout title={`${name} | ThePickleHub`} description={metaDesc} active="venues">
      <div className="tl-shell" style={{ paddingBottom: 80, maxWidth: 880, margin: "0 auto" }}>
        <p className="mb-3 text-xs text-muted-foreground">
          <Link to="/san" className="hover:underline">
            {language === "vi" ? "Tìm sân" : "Courts"}
          </Link>
          {" / "}
          {citySlug && venue.city && (
            <>
              <Link to={`/san/khu-vuc/${citySlug}`} className="hover:underline">
                {venue.city}
              </Link>
              {" / "}
            </>
          )}
          <span>{name}</span>
        </p>

        {venue.cover_image_url && (
          <img
            src={venue.cover_image_url}
            alt={name}
            className="mb-5 h-56 w-full rounded-lg border border-border object-cover"
            loading="lazy"
          />
        )}

        <header className="mb-5">
          <h1
            className="flex flex-wrap items-center gap-2 font-serif text-4xl italic leading-tight"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            {name}
            {venue.is_verified && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs not-italic text-primary">
                <BadgeCheck className="h-3.5 w-3.5" />
                {language === "vi" ? "Đã xác minh" : "Verified"}
              </span>
            )}
          </h1>
          {fullAddress && (
            <p className="mt-1 flex items-start gap-1.5 text-sm text-muted-foreground">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{fullAddress}</span>
            </p>
          )}
        </header>

        <p className="mb-6 text-sm leading-relaxed text-muted-foreground">{intro}</p>

        {/* Feature chips */}
        <div className="mb-6 flex flex-wrap gap-2">
          <span className="rounded-md border border-border bg-muted/40 px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {courtsLabel(venue.num_courts, language)}
          </span>
          {indoorLabel(venue.is_indoor, language) && (
            <span className="rounded-md border border-border bg-muted/40 px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {indoorLabel(venue.is_indoor, language)}
            </span>
          )}
          {surface && (
            <span className="rounded-md border border-border bg-muted/40 px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {surface}
            </span>
          )}
        </div>

        {/* Primary actions */}
        <div className="mb-6 flex flex-wrap gap-3">
          <a
            href={directionsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="tl-btn green"
            style={{ textDecoration: "none" }}
          >
            <Navigation className="h-4 w-4" /> {language === "vi" ? "Chỉ đường" : "Directions"}
          </a>
          {venue.phone && (
            <a href={`tel:${venue.phone}`} className="tl-btn" style={{ textDecoration: "none" }}>
              <Phone className="h-4 w-4" /> {language === "vi" ? "Gọi" : "Call"}
            </a>
          )}
          {venue.website && (
            <a
              href={venue.website}
              target="_blank"
              rel="noopener noreferrer"
              className="tl-btn"
              style={{ textDecoration: "none" }}
            >
              <Globe className="h-4 w-4" /> Website
            </a>
          )}
          <button type="button" onClick={handleShare} className="tl-btn">
            <Share2 className="h-4 w-4" /> {language === "vi" ? "Chia sẻ" : "Share"}
          </button>
        </div>

        {/* Map */}
        {osmUrl && (
          <div className="mb-6 overflow-hidden rounded-lg border border-border">
            <iframe
              title={language === "vi" ? `Bản đồ ${name}` : `Map of ${name}`}
              src={osmUrl}
              width="100%"
              height="320"
              loading="lazy"
              style={{ border: 0, display: "block" }}
            />
          </div>
        )}

        {/* Opening hours */}
        {hours.length > 0 && (
          <section className="mb-6">
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {language === "vi" ? "Giờ mở cửa" : "Opening hours"}
            </h2>
            <div className="rounded-md border border-border">
              {hours.map((h, i) => (
                <div
                  key={h.day}
                  className={`flex items-center justify-between px-4 py-2 text-sm ${
                    i > 0 ? "border-t border-border" : ""
                  }`}
                >
                  <span className="text-muted-foreground">{h.day}</span>
                  <span>{h.value}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Other courts in the same city — internal links */}
        {nearby && nearby.length > 0 && (
          <section className="mt-10 border-t border-border pt-6">
            <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {language === "vi" ? `Sân pickleball khác tại ${venue.city}` : `Other pickleball courts in ${venue.city}`}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {nearby.map((n) => (
                <VenueCard key={n.id} venue={n} language={language} />
              ))}
            </div>
            {citySlug && (
              <Link
                to={`/san/khu-vuc/${citySlug}`}
                className="mt-4 inline-block text-sm text-primary hover:underline"
              >
                {language === "vi" ? `Xem tất cả sân pickleball tại ${venue.city}` : `See all pickleball courts in ${venue.city}`} →
              </Link>
            )}
          </section>
        )}

        {/* Footer CTA */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <Link to="/san" className="text-sm text-muted-foreground hover:underline">
            ← {language === "vi" ? "Tất cả sân" : "All courts"}
          </Link>
          <Link to="/san/them" className="tl-btn green" style={{ textDecoration: "none" }}>
            <Plus className="h-4 w-4" /> {language === "vi" ? "Thêm sân mới" : "Add a court"}
          </Link>
        </div>
      </div>
    </TheLineLayout>
  );
}
