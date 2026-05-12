// ============================================================================
// BadgesGrid — list every BADGE_DEFINITIONS entry as a BadgeCard.
// ----------------------------------------------------------------------------
// Click on any card opens a description modal (shadcn Dialog). Earned
// badges have a green hover state; locked ones are dimmed. Progress
// info is computed at the parent (player_stats + compute_player_win_streak)
// and passed in so we don't re-query here.
// ============================================================================

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { BADGE_DEFINITIONS, type BadgeCode, type BadgeDefinition } from "@/lib/badges/definitions";
import { BadgeCard } from "./BadgeCard";

interface Props {
  /** earned badges from user_badges (code → earned_at). */
  earnedMap: Record<string, string>;
  progress: { events: number; matches: number; wins: number; streak: number };
}

export function BadgesGrid({ earnedMap, progress }: Props) {
  const { t } = useI18n();
  const profile = t.socialEvents.profile;
  const [openCode, setOpenCode] = useState<BadgeCode | null>(null);

  const openDef: BadgeDefinition | null =
    openCode != null
      ? BADGE_DEFINITIONS.find((b) => b.code === openCode) ?? null
      : null;
  const openBadgeText =
    openCode != null
      ? (profile.badges as Record<string, { title: string; description: string }>)[openCode]
      : null;

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {BADGE_DEFINITIONS.map((def) => {
          const earnedAt = earnedMap[def.code] ?? null;
          return (
            <BadgeCard
              key={def.code}
              def={def}
              earned={Boolean(earnedAt)}
              earnedAt={earnedAt}
              progress={progress}
              onClick={() => setOpenCode(def.code)}
            />
          );
        })}
      </div>

      <Dialog open={openDef != null} onOpenChange={(o) => !o && setOpenCode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{openBadgeText?.title}</DialogTitle>
            <DialogDescription>{openBadgeText?.description}</DialogDescription>
          </DialogHeader>
          {openCode != null && earnedMap[openCode] && (
            <p className="text-xs text-muted-foreground">
              {profile.earnedOn.replace(
                "{date}",
                new Date(earnedMap[openCode]).toLocaleDateString(),
              )}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
