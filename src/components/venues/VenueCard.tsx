// ============================================================================
// VenueCard — single tile in the /san (court finder) grid.
// ----------------------------------------------------------------------------
// Mirrors ClubCard's TheLine card shell: cover thumbnail or initials,
// serif venue name, "District, City" subtitle, a stat row (court count,
// indoor/outdoor, verified badge), and a "Xem sân →" CTA. The whole card
// links to /san/:slug.
// ============================================================================

import { Link } from "react-router-dom";
import { BadgeCheck, MapPin } from "lucide-react";
import {
  type VenueListItem,
  type Language,
  venueDisplayName,
  venueLocationLine,
  courtsLabel,
  indoorLabel,
} from "@/lib/venues";

interface Props {
  venue: VenueListItem;
  language: Language;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function VenueCard({ venue, language }: Props) {
  const name = venueDisplayName(venue, language);
  const location = venueLocationLine(venue);
  const courts = courtsLabel(venue.num_courts, language);
  const indoor = indoorLabel(venue.is_indoor, language);

  return (
    <div className="group flex flex-col gap-3 rounded-md border border-border bg-card p-5 transition-colors hover:border-primary/40">
      <Link
        to={`/san/${venue.slug}`}
        className="flex items-start gap-3"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        {venue.cover_image_url ? (
          <img
            src={venue.cover_image_url}
            alt={name}
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-md border border-border object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-base font-semibold text-muted-foreground"
            aria-hidden
          >
            {initialsOf(name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3
            className="truncate font-serif text-2xl italic leading-tight"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            {name}
          </h3>
          {location && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-muted-foreground">
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{location}</span>
            </p>
          )}
        </div>
        {venue.is_verified && (
          <BadgeCheck
            className="h-5 w-5 shrink-0 text-primary"
            aria-label={language === "vi" ? "Đã xác minh" : "Verified"}
          />
        )}
      </Link>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          {courts}
          {indoor ? ` · ${indoor}` : ""}
        </span>
        <Link
          to={`/san/${venue.slug}`}
          className="font-mono text-xs uppercase tracking-wider text-foreground hover:underline"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          {language === "vi" ? "Xem sân" : "View court"} →
        </Link>
      </div>
    </div>
  );
}
