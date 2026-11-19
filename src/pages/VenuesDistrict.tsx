// ============================================================================
// VenuesDistrict (`/san/khu-vuc/:city/:district`) — per-district court hub.
// ----------------------------------------------------------------------------
// District-level landing under the city hub: every court in one district
// of one city, so "sân pickleball <quận>" searches land on a focused page
// instead of a city-wide list. District resolves by slugifying the raw
// district names of the city's venues (shared `districtSlug` helper — the
// bot renderer and the sitemap derive the same URLs). Districts below
// MIN_DISTRICT_HUB_VENUES render for direct visitors but are noindex and
// are never linked from the city hub or the sitemap.
// ============================================================================

import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, MapPin } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { VenueCard } from "@/components/venues/VenueCard";
import {
  type VenueListItem,
  VENUE_LIST_COLUMNS,
  cityNameFromSlug,
  districtSlug,
  MIN_DISTRICT_HUB_VENUES,
} from "@/lib/venues";

export default function VenuesDistrict() {
  const { city: citySlug, district: districtParam } = useParams<{ city: string; district: string }>();
  const { language } = useI18n();
  const vi = language === "vi";
  const cityName = citySlug ? cityNameFromSlug(citySlug) : null;

  const { data: rows, isLoading } = useQuery<VenueListItem[]>({
    queryKey: ["venues-district", cityName],
    queryFn: async () => {
      if (!cityName) return [];
      const { data, error } = await supabase
        .from("venues")
        .select(VENUE_LIST_COLUMNS)
        .eq("city", cityName)
        .order("is_verified", { ascending: false })
        .order("num_courts", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(500);
      if (error) {
        console.error("VenuesDistrict: fetch error", error);
        return [];
      }
      return (data as VenueListItem[]) ?? [];
    },
    enabled: Boolean(cityName),
    staleTime: 60_000,
  });

  const matched = (rows ?? []).filter((v) => districtSlug(v.district) === districtParam);
  const districtName = matched[0]?.district ?? null;
  const notFound = !cityName || (!isLoading && rows !== undefined && matched.length === 0);

  if (notFound) {
    return (
      <TheLineLayout
        title={vi ? "Không tìm thấy khu vực | ThePickleHub" : "Area not found | ThePickleHub"}
        active="venues"
        noindex
      >
        <div className="tl-shell" style={{ padding: "60px 16px", maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
          <h1 className="mb-3 font-serif text-3xl italic" style={{ fontFamily: "'Instrument Serif', serif" }}>
            {vi ? "Không tìm thấy khu vực này" : "Area not found"}
          </h1>
          <Button asChild variant="outline">
            <Link to="/san">← {vi ? "Về danh sách sân" : "Back to courts"}</Link>
          </Button>
        </div>
      </TheLineLayout>
    );
  }

  const count = matched.length;
  const heading = vi ? `Sân Pickleball ${districtName ?? ""}` : `Pickleball courts in ${districtName ?? ""}`;
  const subheading = vi
    ? `Danh sách sân pickleball tại ${districtName}, ${cityName} — địa chỉ, số sân, bản đồ và chỉ đường. Cộng đồng cùng đóng góp trên ThePickleHub.`
    : `Pickleball courts in ${districtName}, ${cityName} — address, court count, map and directions, crowd-sourced on ThePickleHub.`;

  // Sibling district hubs (only districts with enough courts to compare).
  const groups = new Map<string, { raw: string; count: number }>();
  for (const v of rows ?? []) {
    const slug = districtSlug(v.district);
    if (!slug || !v.district) continue;
    const cur = groups.get(slug) ?? { raw: v.district, count: 0 };
    cur.count += 1;
    groups.set(slug, cur);
  }
  const siblings = [...groups.entries()]
    .filter(([slug, g]) => slug !== districtParam && g.count >= MIN_DISTRICT_HUB_VENUES)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 12);

  return (
    <TheLineLayout
      title={`${heading} | ThePickleHub`}
      description={subheading}
      active="venues"
      noindex={count < MIN_DISTRICT_HUB_VENUES}
    >
      <div className="tl-shell" style={{ paddingBottom: 80, maxWidth: 1080, margin: "0 auto" }}>
        <p className="mb-3 text-xs text-muted-foreground">
          <Link to="/san" className="hover:underline">{vi ? "Tìm sân" : "Courts"}</Link>
          {" / "}
          <Link to={`/san/khu-vuc/${citySlug}`} className="hover:underline">{cityName}</Link>
          {" / "}<span>{districtName}</span>
        </p>
        <header className="tl-page-head">
          <div className="kicker">◆ {vi ? "Khu vực" : "Area"}</div>
          <h1>{heading}</h1>
          <p>
            <MapPin className="mb-0.5 mr-1 inline h-4 w-4" aria-hidden />
            {vi ? `${count} sân tại ${districtName}, ${cityName}.` : `${count} courts in ${districtName}, ${cityName}.`} {subheading}
          </p>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {matched.map((v) => <VenueCard key={v.id} venue={v} language={language} />)}
          </div>
        )}

        {siblings.length > 0 && (
          <nav className="mt-10">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {vi ? `Quận/huyện khác tại ${cityName}` : `Other districts in ${cityName}`}
            </h2>
            <div className="flex flex-wrap gap-2">
              {siblings.map(([slug, g]) => (
                <Link
                  key={slug}
                  to={`/san/khu-vuc/${citySlug}/${slug}`}
                  className="rounded-full border border-border px-3 py-1 text-sm hover:bg-muted"
                >
                  {g.raw} ({g.count})
                </Link>
              ))}
            </div>
          </nav>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <Link to={`/san/khu-vuc/${citySlug}`} className="text-sm text-muted-foreground hover:underline">
            ← {vi ? `Tất cả sân tại ${cityName}` : `All courts in ${cityName}`}
          </Link>
          <Button asChild variant="tl-primary">
            <Link to="/san/them">
              <Plus className="h-4 w-4" /> {vi ? "Thêm sân" : "Add a court"}
            </Link>
          </Button>
        </div>
      </div>
    </TheLineLayout>
  );
}
