// ============================================================================
// ClubsList (`/clubs`) — public discovery page (PR55).
// ----------------------------------------------------------------------------
// Lists every club in the system, sorted by upcoming-event count desc
// then created_at desc. Real-time search across name + location with a
// 300ms debounce. Logged-in users see a vibrant-green "+ Tạo CLB" CTA
// in the top-right that routes to /clubs/new; anonymous users get a
// muted hint instead so they can land on the page first and see what
// they'd be joining.
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
import { ClubCard } from "@/components/clubs/ClubCard";

interface ClubListingRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  location_text: string | null;
  created_at: string;
  upcoming_events: number;
}

const PAGE_SIZE = 24;

// Codex bug 2: PostgREST's `.or()` parser uses commas and parens as
// argument separators, so a user typing "District 1, HCMC" would break
// the OR expression and the query silently returns 0 rows. Strip the
// reserved characters before interpolating into the filter. Also
// neutralise the SQL ILIKE wildcards % and _ so a literal "100%" search
// doesn't match everything.
function escapePostgrestSearch(input: string): string {
  return input
    .replace(/[,.()*"%_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function ClubsList() {
  const { t } = useI18n();
  const { user } = useAuth();
  const clubs = t.socialEvents.clubsList;

  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");

  // 300ms debounce on the search input — the spec asks for "real-time"
  // results but a per-keystroke fetch would thrash the DB. 300ms is
  // imperceptible to the user.
  useEffect(() => {
    const handle = window.setTimeout(() => setSearch(rawSearch.trim()), 300);
    return () => window.clearTimeout(handle);
  }, [rawSearch]);

  const { data: rows, isLoading } = useQuery<ClubListingRow[]>({
    queryKey: ["clubs-list", search],
    queryFn: async () => {
      let q = supabase
        .from("club_listing")
        .select(
          "id, slug, name, description, logo_url, location_text, created_at, upcoming_events",
        )
        .order("upcoming_events", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(PAGE_SIZE);
      if (search.length > 0) {
        const safe = escapePostgrestSearch(search);
        if (safe.length > 0) {
          // ILIKE prefix match on either name or location. The GIN
          // indexes from migration 16000 keep this cheap even with a
          // few thousand rows. `safe` has commas / parens / quotes
          // stripped so the .or() expression parses cleanly.
          q = q.or(`name.ilike.%${safe}%,location_text.ilike.%${safe}%`);
        }
      }
      const { data, error } = await q;
      if (error) {
        console.error("ClubsList: fetch error", error);
        return [];
      }
      return (data as ClubListingRow[]) ?? [];
    },
    staleTime: 30_000,
  });

  const hasResults = (rows ?? []).length > 0;

  return (
    <TheLineLayout title={clubs.pageTitle} active="clubs">
      <div className="tl-shell" style={{ paddingBottom: 80, maxWidth: 1080, margin: "0 auto" }}>
        <header className="tl-page-head">
          <div className="kicker">◆ {clubs.kicker}</div>
          <h1>{clubs.heading}</h1>
          <p>{clubs.subheading}</p>
        </header>

        {/* Top action row — search input on the left, "+ Tạo CLB" CTA
            on the right when the viewer is logged in. */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={rawSearch}
              onChange={(e) => setRawSearch(e.target.value)}
              placeholder={clubs.searchPlaceholder}
              className="pl-9"
              aria-label={clubs.searchAria}
            />
          </div>
          {user ? (
            <Link to="/clubs/new" className="tl-btn green sm:shrink-0">
              <Plus className="h-4 w-4" /> {clubs.createCta} →
            </Link>
          ) : (
            <Link
              to="/login?redirect=%2Fclubs%2Fnew"
              className="tl-btn sm:shrink-0"
              style={{ textDecoration: "none" }}
            >
              {clubs.createCtaAnon} →
            </Link>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hasResults ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(rows ?? []).map((row) => (
              <ClubCard
                key={row.id}
                slug={row.slug}
                name={row.name}
                description={row.description}
                logoUrl={row.logo_url}
                locationText={row.location_text}
                upcomingEvents={row.upcoming_events}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-md border border-border bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              {search.length > 0 ? clubs.emptySearch : clubs.emptyAll}
            </p>
          </div>
        )}
      </div>
    </TheLineLayout>
  );
}
