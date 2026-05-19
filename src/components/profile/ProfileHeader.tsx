// ============================================================================
// ProfileHeader — top of /u/:slug page.
// ----------------------------------------------------------------------------
// Avatar placeholder + name + one-line meta. TheLine serif on the name
// per the page mockup. Pure presentation; the parent owns the data.
// ============================================================================

import { useI18n } from "@/i18n";

interface Props {
  displayName: string;
  isGhost: boolean;
  level: number | null;
  eventsPlayed: number;
  matchesPlayed: number;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileHeader({ displayName, isGhost, level, eventsPlayed, matchesPlayed }: Props) {
  const { t } = useI18n();
  const profile = t.socialEvents.profile;

  const metaParts: string[] = [];
  if (level != null) {
    metaParts.push(`${profile.levelLabel} ${level.toFixed(1)}`);
  }
  metaParts.push(
    profile.eventsPlayedShort.replace("{n}", String(eventsPlayed)),
  );
  metaParts.push(
    profile.matchesPlayedShort.replace("{n}", String(matchesPlayed)),
  );

  return (
    <div className="flex flex-col items-center gap-3 py-6 sm:flex-row sm:items-center sm:gap-5">
      <div
        className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-2xl font-semibold text-muted-foreground"
        aria-hidden
      >
        {initialsOf(displayName)}
      </div>
      <div className="text-center sm:text-left">
        <h1
          className="font-serif text-4xl italic"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          {displayName}
        </h1>
        <p className="mt-1 text-sm uppercase tracking-wide text-muted-foreground">
          {metaParts.join(" · ")}
        </p>
        {isGhost && (
          <p className="mt-2 text-xs text-muted-foreground">
            {profile.ghostHint}
          </p>
        )}
      </div>
    </div>
  );
}
