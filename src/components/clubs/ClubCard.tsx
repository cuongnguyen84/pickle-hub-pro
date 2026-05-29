// ============================================================================
// ClubCard — single tile in the /clubs grid.
// ----------------------------------------------------------------------------
// TheLine card shell: logo or initials placeholder, serif club name,
// location subtitle, "N events upcoming" stat line, inline "XEM CLB →"
// CTA at the bottom. Wraps the whole card in a Link to /clb/:slug so
// any pointer / keyboard interaction navigates.
// ============================================================================

import { Link } from "react-router-dom";
import { useI18n } from "@/i18n";

interface Props {
  slug: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  locationText: string | null;
  upcomingEvents: number;
  creatorSlug?: string | null;
  creatorDisplayName?: string | null;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ClubCard({
  slug,
  name,
  description,
  logoUrl,
  locationText,
  upcomingEvents,
  creatorSlug,
  creatorDisplayName,
}: Props) {
  const { t } = useI18n();
  const clubs = t.socialEvents.clubsList;
  return (
    <div
      className="group flex flex-col gap-3 rounded-md border border-border bg-card p-5 transition-colors hover:border-primary/40"
    >
      <Link
        to={`/clb/${slug}`}
        className="flex items-start gap-3"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
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
          {locationText && (
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {locationText}
            </p>
          )}
        </div>
      </Link>

      {description && (
        <Link
          to={`/clb/${slug}`}
          className="line-clamp-2 text-sm text-muted-foreground"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          {description}
        </Link>
      )}

      {creatorSlug && creatorDisplayName && (
        <Link
          to={`/nguoi-choi/${creatorSlug}`}
          className="text-xs text-muted-foreground hover:text-foreground hover:underline"
          style={{ textDecoration: "none" }}
        >
          {clubs.cardCreatedBy.replace("{name}", creatorDisplayName)}
        </Link>
      )}

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
        <span
          className="font-mono text-xs uppercase tracking-wider text-muted-foreground"
        >
          {upcomingEvents === 0
            ? clubs.cardNoEvents
            : clubs.cardEventCount.replace("{n}", String(upcomingEvents))}
        </span>
        <Link
          to={`/clb/${slug}`}
          className="font-mono text-xs uppercase tracking-wider text-foreground hover:underline"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          {clubs.cardCta} →
        </Link>
      </div>
    </div>
  );
}
