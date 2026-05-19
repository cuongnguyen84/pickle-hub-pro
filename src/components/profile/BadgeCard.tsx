// ============================================================================
// BadgeCard — single badge tile shown inside BadgesGrid.
// ----------------------------------------------------------------------------
// Earned: full-color icon + title + earned date.
// Locked: greyscale icon + title + locked-state hint with current progress.
// Clicking either flavour opens the parent's modal with the full
// description (handled by BadgesGrid).
// ============================================================================

import { Lock } from "lucide-react";
import { useI18n } from "@/i18n";
import type { BadgeDefinition } from "@/lib/badges/definitions";

interface Props {
  def: BadgeDefinition;
  earned: boolean;
  earnedAt: string | null;
  /** Live counts used by locked-state progress hint. */
  progress: { events: number; matches: number; wins: number; streak: number };
  onClick: () => void;
}

function formatEarnedAt(iso: string, lang: "vi" | "en"): string {
  try {
    return new Date(iso).toLocaleDateString(lang === "vi" ? "vi-VN" : "en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    });
  } catch {
    return iso;
  }
}

function lockedHint(
  def: BadgeDefinition,
  progress: Props["progress"],
  hintTemplate: string,
): string | null {
  const k = def.progressKind;
  if (k.kind === "once") return null;
  if (k.kind === "events") {
    const remaining = Math.max(0, k.target - progress.events);
    return hintTemplate
      .replace("{remaining}", String(remaining))
      .replace("{kind}", "event");
  }
  if (k.kind === "matches") {
    const remaining = Math.max(0, k.target - progress.matches);
    return hintTemplate
      .replace("{remaining}", String(remaining))
      .replace("{kind}", "match");
  }
  if (k.kind === "wins") {
    const remaining = Math.max(0, k.target - progress.wins);
    return hintTemplate
      .replace("{remaining}", String(remaining))
      .replace("{kind}", "win");
  }
  // win_streak
  return hintTemplate
    .replace("{remaining}", String(Math.max(0, k.target - progress.streak)))
    .replace("{kind}", "streak");
}

export function BadgeCard({ def, earned, earnedAt, progress, onClick }: Props) {
  const { t, language } = useI18n();
  const profile = t.socialEvents.profile;
  const badgeText = (profile.badges as Record<string, { title: string; description: string }>)[
    def.code
  ];
  const Icon = def.icon;
  const hint = !earned ? lockedHint(def, progress, profile.lockedHint) : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col items-center gap-2 rounded-md border p-3 text-center transition-colors ${
        earned
          ? "border-primary/40 bg-primary/5 hover:bg-primary/10"
          : "border-border bg-muted/30 opacity-60 hover:opacity-80"
      }`}
      aria-pressed={earned}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-full ${
          earned ? "text-primary" : "text-muted-foreground"
        }`}
      >
        {earned ? <Icon className="h-7 w-7" /> : <Lock className="h-5 w-5" />}
      </div>
      <p className="text-xs font-medium">{badgeText?.title ?? def.code}</p>
      {earned && earnedAt && (
        <p className="text-[10px] text-muted-foreground">
          {formatEarnedAt(earnedAt, language)}
        </p>
      )}
      {!earned && hint && (
        <p className="text-[10px] text-muted-foreground">{hint}</p>
      )}
    </button>
  );
}
