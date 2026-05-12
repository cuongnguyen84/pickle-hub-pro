// ============================================================================
// badges / definitions — UI metadata for every badge_code awarded by the DB
// ----------------------------------------------------------------------------
// Source of truth for what each badge looks like on the BadgesGrid +
// what the locked-state hint says ("Chơi thêm 3 event để mở khóa").
// The award path itself lives in the DB triggers (migration 150002);
// this file is purely cosmetic + describes the unlock condition so the
// client can render progress.
//
// Adding a new badge: append a row here AND extend the migration to
// award it. Title/description must be added in both vi.ts + en.ts under
// `socialEvents.profile.badges.<code>`.
// ============================================================================

import type { ComponentType } from "react";
import {
  Trophy,
  Award,
  Calendar,
  Flame,
  Star,
  Medal,
  Moon,
  Zap,
  Crown,
  type LucideProps,
} from "lucide-react";

export type BadgeCode =
  | "first_event"
  | "first_match"
  | "first_win"
  | "event_5"
  | "event_10"
  | "event_25"
  | "event_50"
  | "match_10"
  | "match_50"
  | "match_100"
  | "win_streak_3"
  | "win_streak_5"
  | "night_owl";

export type BadgeCategory = "milestone" | "achievement";

export interface BadgeDefinition {
  code: BadgeCode;
  icon: ComponentType<LucideProps>;
  category: BadgeCategory;
  /** For locked-state hint: how the user can progress towards earning. */
  progressKind:
    | { kind: "events"; target: number }
    | { kind: "matches"; target: number }
    | { kind: "wins"; target: number }
    | { kind: "win_streak"; target: number }
    | { kind: "once" }; // Awarded by a single qualifying event (first_*, night_owl).
}

export const BADGE_DEFINITIONS: ReadonlyArray<BadgeDefinition> = [
  { code: "first_event",   icon: Calendar, category: "milestone",  progressKind: { kind: "once" } },
  { code: "first_match",   icon: Zap,      category: "milestone",  progressKind: { kind: "once" } },
  { code: "first_win",     icon: Trophy,   category: "milestone",  progressKind: { kind: "once" } },
  { code: "event_5",       icon: Star,     category: "milestone",  progressKind: { kind: "events", target: 5 } },
  { code: "event_10",      icon: Award,    category: "milestone",  progressKind: { kind: "events", target: 10 } },
  { code: "event_25",      icon: Medal,    category: "milestone",  progressKind: { kind: "events", target: 25 } },
  { code: "event_50",      icon: Crown,    category: "milestone",  progressKind: { kind: "events", target: 50 } },
  { code: "match_10",      icon: Star,     category: "milestone",  progressKind: { kind: "matches", target: 10 } },
  { code: "match_50",      icon: Award,    category: "milestone",  progressKind: { kind: "matches", target: 50 } },
  { code: "match_100",     icon: Crown,    category: "milestone",  progressKind: { kind: "matches", target: 100 } },
  { code: "win_streak_3",  icon: Flame,    category: "achievement", progressKind: { kind: "win_streak", target: 3 } },
  { code: "win_streak_5",  icon: Flame,    category: "achievement", progressKind: { kind: "win_streak", target: 5 } },
  { code: "night_owl",     icon: Moon,     category: "achievement", progressKind: { kind: "once" } },
];

export const BADGE_BY_CODE: Record<BadgeCode, BadgeDefinition> = BADGE_DEFINITIONS.reduce(
  (acc, b) => {
    acc[b.code] = b;
    return acc;
  },
  {} as Record<BadgeCode, BadgeDefinition>,
);
