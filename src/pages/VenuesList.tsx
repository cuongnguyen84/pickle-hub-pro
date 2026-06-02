// ============================================================================
// VenuesList (`/san`) — pickleball court finder / "Tìm sân".
// ----------------------------------------------------------------------------
// Public discovery page. Real-time search (300ms debounce) across name /
// name_vi / address / district / city, plus client-side city-chip filtering
// derived from the results. Verified venues sort first, then by court count.
// Logged-in users get a "+ Thêm sân" CTA → /san/them; anonymous users get a
// muted sign-in hint so they can browse first.
//
// Backing table `venues` is public-read (RLS), so anonymous visitors load
// the grid directly. The SSR mirror (functions/_lib/render/venues.ts) serves
// the same list to crawlers for SEO.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Loader2 } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useI18n } from "@/i18n";
import { VenueCard } from "@/components/venues/VenueCard";
import { type VenueListItem, VENUE_LIST_COLUMNS, VENUE_CITIES } from "@/lib/venues";

const PAGE_SIZE = 60;

// Mirrors ClubsList.escapePostgrestSearch — PostgREST's .or() parser treats
// commas / parens as separators, so a user typing "Quận 1, HCMC" would break
// the filter and return 0 rows. Strip reserved chars + ILIKE wildcards.
function escapePostgrestSearch(input: string): string {
  return input
    .replace(/[,.()*"%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function VenuesList() {
  const { language } = useI18n();
  const { user } = useAuth();

  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");
  const [cityFilter, setCityFilter] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(rawSearch.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [rawSearch]);

  const { data: rows, isLoading } = useQuery<VenueListItem[]>({
    queryKey: ["venues-list", search],
    queryFn: async () => {
      let q = supabase
        .from("venues")
        .select(VENUE_LIST_COLUMNS)
        .order("is_verified", { ascending: false })
        .order("num_courts", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (search.length > 0) {
        const safe = escapePostgrestSearch(search);
        if (safe.length > 0) {
          q = q.or(
            [
              `name.ilike.%${safe}%`,
              `name_vi.ilike.%${safe}%`,
              `address.ilike.%${safe}%`,
              `district.ilike.%${safe}%`,
              `city.ilike.%${safe}%`,
            ].join(","),
          );
        }
      }
      const { data, error } = await q;
      if (error) {
        console.error("VenuesList: fetch error", error);
        return [];
      }
      return (data as VenueListItem[]) ?? [];
    },
    staleTime: 30_000,
  });

  // City chips derived from the current result set.
  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows ?? []) {
      if (r.city && r.city.trim().length > 0) set.add(r.city.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "vi"));
  }, [rows]);

  // Reset an active city filter when a new search makes it irrelevant.
  useEffect(() => {
    if (cityFilter && !cities.includes(cityFilter)) setCityFilter(null);
  }, [cities, cityFilter]);

  const visible = useMemo(() => {
    if (!cityFilter) return rows ?? [];
    return (rows ?? []).filter((r) => r.city === cityFilter);
  }, [rows, cityFilter]);

  const hasResults = visible.length > 0;

  const heading = language === "vi" ? "Tìm sân Pickleball" : "Find a pickleball court";
  const subheading =
    language === "vi"
      ? "Tìm sân pickleball gần bạn — số sân, trong nhà/ngoài trời, địa chỉ và chỉ đường. Cộng đồng cùng đóng góp."
      : "Find pickleball courts near you — court count, indoor/outdoor, address and directions. Crowd-sourced by the community.";

  return (
    <TheLineLayout
      title={language === "vi" ? "Tìm sân Pickleball | ThePickleHub" : "Find Pickleball Courts | ThePickleHub"}
      description={subheading}
      active="venues"
    >
      <div className="tl-shell" style={{ paddingBottom: 80, maxWidth: 1080, margin: "0 auto" }}>
        <header className="tl-page-head">
          <div className="kicker">◆ {language === "vi" ? "Sân chơi" : "Courts"}</div>
          <h1>{heading}</h1>
          <p>{subheading}</p>
        </header>

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder={
                language === "vi" ? "Tìm theo tên sân, quận, thành phố…" : "Search by name, district or city…"
              }
              className="pl-9"
              aria-label={language === "vi" ? "Tìm sân theo tên hoặc khu vực" : "Search courts by name or area"}
            />
          </div>
          {user ? (
            <Link to="/san/them" className="tl-btn green sm:shrink-0">
              <Plus className="h-4 w-4" /> {language === "vi" ? "Thêm sân" : "Add a court"} →
            </Link>
          ) : (
            <Link
              to="/login?redirect=%2Fsan%2Fthem"
              className="tl-btn sm:shrink-0"
              style={{ textDecoration: "none" }}
            >
              {language === "vi" ? "Đăng nhập để thêm sân" : "Sign in to add a court"} →
            </Link>
          )}
        </div>

        {/* City filter chips */}
        {cities.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCityFilter(null)}
              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                cityFilter === null
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/40"
              }`}
            >
              {language === "vi" ? "Tất cả" : "All"}
            </button>
            {cities.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCityFilter(c)}
                className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                  cityFilter === c
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/40"
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hasResults ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((v) => (
              <VenueCard key={v.id} venue={v} language={language} />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {search.length > 0
                ? language === "vi"
                  ? "Không tìm thấy sân phù hợp. Thử từ khóa khác hoặc thêm sân mới."
                  : "No courts match your search. Try different keywords or add a new court."
                : language === "vi"
                  ? "Chưa có sân nào. Hãy là người đầu tiên thêm sân!"
                  : "No courts yet. Be the first to add one!"}
            </p>
            {user && (
              <Link
                to="/san/them"
                className="tl-btn green mt-4 inline-flex"
                style={{ textDecoration: "none" }}
              >
                <Plus className="h-4 w-4" /> {language === "vi" ? "Thêm sân" : "Add a court"} →
              </Link>
            )}
          </div>
        )}
        <section className="mt-12 border-t border-border pt-6">
          <h2 className="mb-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {language === "vi" ? "Tìm sân theo khu vực" : "Browse courts by city"}
          </h2>
          <div className="flex flex-wrap gap-2">
            {VENUE_CITIES.map((c) => (
              <Link
                key={c.slug}
                to={`/san/khu-vuc/${c.slug}`}
                className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                style={{ textDecoration: "none" }}
              >
                {c.name}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </TheLineLayout>
  );
}
