// ============================================================================
// VenuesCity (`/san/khu-vuc/:city`) — per-city court hub.
// ----------------------------------------------------------------------------
// SEO landing page for "sân pickleball <thành phố>" queries. Lists every
// venue in one city and internal-links the /san/:slug detail pages (helping
// them get discovered + indexed). City slug resolves via VENUE_CITIES.
// ============================================================================

import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, MapPin } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { VenueCard } from "@/components/venues/VenueCard";
import { type VenueListItem, VENUE_LIST_COLUMNS, cityNameFromSlug } from "@/lib/venues";

export default function VenuesCity() {
  const { city: citySlug } = useParams<{ city: string }>();
  const { language } = useI18n();
  const vi = language === "vi";
  const cityName = citySlug ? cityNameFromSlug(citySlug) : null;

  const { data: rows, isLoading } = useQuery<VenueListItem[]>({
    queryKey: ["venues-city", cityName],
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
        console.error("VenuesCity: fetch error", error);
        return [];
      }
      return (data as VenueListItem[]) ?? [];
    },
    enabled: Boolean(cityName),
    staleTime: 60_000,
  });

  if (!cityName) {
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
          <Link to="/san" className="tl-btn">← {vi ? "Về danh sách sân" : "Back to courts"}</Link>
        </div>
      </TheLineLayout>
    );
  }

  const count = rows?.length ?? 0;
  const heading = vi ? `Sân Pickleball ${cityName}` : `Pickleball courts in ${cityName}`;
  const subheading = vi
    ? `Danh sách sân pickleball tại ${cityName} — địa chỉ, số sân, bản đồ và chỉ đường. Cộng đồng cùng đóng góp trên ThePickleHub.`
    : `Pickleball courts in ${cityName}, Vietnam — address, court count, map and directions, crowd-sourced on ThePickleHub.`;

  return (
    <TheLineLayout
      title={`${heading} | ThePickleHub`}
      description={subheading}
      active="venues"
    >
      <div className="tl-shell" style={{ paddingBottom: 80, maxWidth: 1080, margin: "0 auto" }}>
        <p className="mb-3 text-xs text-muted-foreground">
          <Link to="/san" className="hover:underline">{vi ? "Tìm sân" : "Courts"}</Link>
          {" / "}<span>{cityName}</span>
        </p>
        <header className="tl-page-head">
          <div className="kicker">◆ {vi ? "Khu vực" : "Area"}</div>
          <h1>{heading}</h1>
          <p>
            <MapPin className="mb-0.5 mr-1 inline h-4 w-4" aria-hidden />
            {vi ? `${count} sân tại ${cityName}.` : `${count} courts in ${cityName}.`} {subheading}
          </p>
        </header>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : count > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(rows ?? []).map((v) => <VenueCard key={v.id} venue={v} language={language} />)}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {vi ? `Chưa có sân nào tại ${cityName}. Hãy là người đầu tiên thêm sân!` : `No courts in ${cityName} yet. Be the first to add one!`}
            </p>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <Link to="/san" className="text-sm text-muted-foreground hover:underline">← {vi ? "Tất cả sân" : "All courts"}</Link>
          <Link to="/san/them" className="tl-btn green" style={{ textDecoration: "none" }}>
            <Plus className="h-4 w-4" /> {vi ? "Thêm sân" : "Add a court"}
          </Link>
        </div>
      </div>
    </TheLineLayout>
  );
}
