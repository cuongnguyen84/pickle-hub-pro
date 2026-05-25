// ============================================================================
// ClubMatches — section rendered on /clb/:slug listing club-logged matches.
// ----------------------------------------------------------------------------
// Public-readable. Organizers see an extra "Log match" button + per-row
// "Ready for DUPR" toggle. Submitted matches show their DUPR id badge.
// ============================================================================

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  Clock,
  Loader2,
  Plus,
  Trophy,
  UploadCloud,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import {
  useClubMatches,
  useMarkMatchReadyForDupr,
  type ClubMatchRow,
} from "@/hooks/useClubMatches";
import { LogMatchDialog } from "./LogMatchDialog";

interface Props {
  clubId: string;
  isOrganizer: boolean;
}

function formatPlayedAt(iso: string, lang: "vi" | "en"): string {
  const d = new Date(iso);
  return d.toLocaleString(lang === "vi" ? "vi-VN" : "en-US", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MatchCard({
  match,
  isOrganizer,
  clubId,
  lang,
}: {
  match: ClubMatchRow;
  isOrganizer: boolean;
  clubId: string;
  lang: "vi" | "en";
}) {
  const { t } = useI18n();
  const m = t.socialEvents.matches;
  const markReady = useMarkMatchReadyForDupr(clubId);

  const teamALabel = match.team_a_players.map((p) => p.display_name ?? "—").join(" + ");
  const teamBLabel = match.team_b_players.map((p) => p.display_name ?? "—").join(" + ");
  const gamesWonA = match.team_a_score.reduce(
    (n, a, i) => n + (a > (match.team_b_score[i] ?? 0) ? 1 : 0),
    0,
  );
  const gamesWonB = match.team_b_score.reduce(
    (n, b, i) => n + (b > (match.team_a_score[i] ?? 0) ? 1 : 0),
    0,
  );

  async function handleToggleReady(next: boolean): Promise<void> {
    try {
      await markReady.mutateAsync({ matchId: match.id, ready: next });
      toast({ title: next ? m.readyOn : m.readyOff });
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      const msg =
        code === "already_submitted"
          ? m.errAlreadySubmitted
          : code === "not_authorized"
            ? t.socialEvents.managers.errNotAuthorized
            : m.toggleError;
      toast({ title: msg, variant: "destructive" });
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5 mb-1.5">
            <Badge variant="secondary" className="text-xs">
              {match.format === "singles"
                ? m.formatSingles
                : match.format === "mixed"
                  ? m.formatMixed
                  : m.formatDoubles}
            </Badge>
            {match.submitted_to_dupr ? (
              <Badge
                variant="outline"
                className="text-xs"
                style={{ borderColor: "var(--tl-green)", color: "var(--tl-green)" }}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {m.submittedBadge}
              </Badge>
            ) : match.ready_for_dupr ? (
              <Badge variant="outline" className="text-xs">
                <UploadCloud className="h-3 w-3 mr-1" />
                {m.readyBadge}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                <Clock className="h-3 w-3 mr-1" />
                {m.draftBadge}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatPlayedAt(match.played_at, lang)}
          </div>
        </div>
        <Link
          to={`/tran-dau/${match.slug}`}
          className="text-xs text-muted-foreground hover:underline shrink-0"
        >
          {m.viewDetail}
        </Link>
      </div>

      {/* Teams + score row */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <div
          className={`text-sm ${match.winning_team === "a" ? "font-semibold" : ""}`}
        >
          {teamALabel}
          {match.winning_team === "a" && (
            <Trophy className="inline h-3.5 w-3.5 ml-1 text-amber-500" />
          )}
        </div>
        <div className="text-center">
          <div className="flex gap-1 justify-center text-base font-mono">
            {match.team_a_score.map((a, i) => (
              <span
                key={i}
                className={`px-1.5 py-0.5 rounded ${
                  a > (match.team_b_score[i] ?? 0)
                    ? "bg-emerald-50 dark:bg-emerald-900/30"
                    : ""
                }`}
              >
                {a}
              </span>
            ))}
          </div>
          <div className="text-xs text-muted-foreground my-0.5">vs</div>
          <div className="flex gap-1 justify-center text-base font-mono">
            {match.team_b_score.map((b, i) => (
              <span
                key={i}
                className={`px-1.5 py-0.5 rounded ${
                  b > (match.team_a_score[i] ?? 0)
                    ? "bg-emerald-50 dark:bg-emerald-900/30"
                    : ""
                }`}
              >
                {b}
              </span>
            ))}
          </div>
        </div>
        <div
          className={`text-sm text-right ${match.winning_team === "b" ? "font-semibold" : ""}`}
        >
          {match.winning_team === "b" && (
            <Trophy className="inline h-3.5 w-3.5 mr-1 text-amber-500" />
          )}
          {teamBLabel}
        </div>
      </div>

      {match.notes && (
        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
          {match.notes}
        </p>
      )}

      {/* Organizer-only DUPR toggle */}
      {isOrganizer && !match.submitted_to_dupr && (
        <div className="mt-3 pt-3 border-t flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            {match.ready_for_dupr ? m.readyHint : m.draftHint}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs">{m.readyToggle}</span>
            <Switch
              checked={match.ready_for_dupr}
              disabled={markReady.isPending}
              onCheckedChange={handleToggleReady}
            />
          </div>
        </div>
      )}

      {match.submitted_to_dupr && match.dupr_match_id && (
        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
          DUPR ID: <span className="font-mono">{match.dupr_match_id}</span>
          {gamesWonA + gamesWonB > 0 && (
            <span className="ml-2">
              ({gamesWonA}–{gamesWonB})
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

export function ClubMatches({ clubId, isOrganizer }: Props) {
  const { t, language } = useI18n();
  const m = t.socialEvents.matches;
  const { matches, isLoading } = useClubMatches(clubId);
  const [logOpen, setLogOpen] = useState(false);

  const readyCount = matches.filter(
    (x) => x.ready_for_dupr && !x.submitted_to_dupr,
  ).length;

  return (
    <section style={{ marginBottom: 32 }}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 600 }}>{m.sectionTitle}</h2>
          {isOrganizer && readyCount > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {m.readyQueueHint.replace("{n}", String(readyCount))}
            </p>
          )}
        </div>
        {isOrganizer && (
          <Button size="sm" onClick={() => setLogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />
            {m.logCta}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : matches.length === 0 ? (
        <p style={{ color: "var(--tl-fg-3)" }}>{m.noMatches}</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {matches.map((match) => (
            <MatchCard
              key={match.id}
              match={match}
              isOrganizer={isOrganizer}
              clubId={clubId}
              lang={language}
            />
          ))}
        </div>
      )}

      <LogMatchDialog
        clubId={clubId}
        open={logOpen}
        onOpenChange={setLogOpen}
      />
    </section>
  );
}
