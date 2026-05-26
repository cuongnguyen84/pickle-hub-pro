// ============================================================================
// LogEventMatchDialog — form để ghi nhận một trận trong social event.
// ----------------------------------------------------------------------------
// Caller: organizer hoặc registered player (RPC log_social_event_match
// validate server-side). Player picker pulls từ useEventRegistrations,
// chỉ include rows có profile_id (loại bỏ guest chưa OTP — không thể xảy
// ra với flow hiện tại nhưng defensive).
//
// Scoring format mặc định 11_rally (sideout/rally điều chỉnh server-side
// sau nếu cần). Tỷ số: best-of-3 với input 2 ván đầu, "+ Thêm ván" cho
// ván 3.
// ============================================================================

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { toast } from "@/hooks/use-toast";
import {
  useEventRegistrations,
  type EventRegistrationRow,
} from "@/hooks/useEventRegistrations";
import {
  useLogSocialEventMatch,
  type SocialEventMatchFormat,
} from "@/hooks/useSocialEventMatches";

interface Props {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Optional — prefill team A player 1 với chính viewer (registered player). */
  defaultSelfProfileId?: string | null;
}

interface PlayerOption {
  profile_id: string;
  display_name: string;
}

function registrationsToOptions(rows: EventRegistrationRow[]): PlayerOption[] {
  return rows
    .filter((r) => r.profile_id != null)
    .map((r) => ({
      profile_id: r.profile_id as string,
      display_name: r.display_name,
    }));
}

export function LogEventMatchDialog({
  eventId,
  open,
  onOpenChange,
  onSuccess,
  defaultSelfProfileId,
}: Props) {
  const { t } = useI18n();
  const log = t.socialEvents.eventDupr.log;

  const { data: registrations = [] } = useEventRegistrations(eventId);
  const options = useMemo(() => registrationsToOptions(registrations), [registrations]);

  const [format, setFormat] = useState<SocialEventMatchFormat>("doubles");
  const teamSize = format === "singles" ? 1 : 2;

  const [teamA, setTeamA] = useState<string[]>(() => {
    if (defaultSelfProfileId) return [defaultSelfProfileId, ""];
    return ["", ""];
  });
  const [teamB, setTeamB] = useState<string[]>(["", ""]);

  // Best-of-3: scores[g] = [a, b]. Mặc định 2 game.
  const [scores, setScores] = useState<Array<[string, string]>>([
    ["", ""],
    ["", ""],
  ]);
  const [notes, setNotes] = useState("");
  const [playedAt, setPlayedAt] = useState<string>(() => {
    // Default = giờ hiện tại, format datetime-local (YYYY-MM-DDTHH:mm).
    const d = new Date();
    const tz = d.getTimezoneOffset();
    const local = new Date(d.getTime() - tz * 60_000);
    return local.toISOString().slice(0, 16);
  });

  const logMutation = useLogSocialEventMatch(eventId);

  function setPlayer(team: "a" | "b", idx: number, value: string) {
    if (team === "a") {
      const next = [...teamA];
      next[idx] = value;
      setTeamA(next);
    } else {
      const next = [...teamB];
      next[idx] = value;
      setTeamB(next);
    }
  }

  function setScore(gameIdx: number, side: 0 | 1, value: string) {
    const next = scores.map((g) => [...g] as [string, string]);
    next[gameIdx][side] = value;
    setScores(next);
  }

  function addGame() {
    if (scores.length >= 5) return;
    setScores((prev) => [...prev, ["", ""]]);
  }
  function removeGame(idx: number) {
    if (scores.length <= 1) return;
    setScores((prev) => prev.filter((_, i) => i !== idx));
  }

  function resetForm() {
    setFormat("doubles");
    setTeamA(defaultSelfProfileId ? [defaultSelfProfileId, ""] : ["", ""]);
    setTeamB(["", ""]);
    setScores([
      ["", ""],
      ["", ""],
    ]);
    setNotes("");
  }

  async function handleSubmit() {
    // Build cleaned arrays based on team size
    const aPlayers = teamA.slice(0, teamSize).map((s) => s.trim());
    const bPlayers = teamB.slice(0, teamSize).map((s) => s.trim());

    if (aPlayers.some((p) => p.length === 0) || bPlayers.some((p) => p.length === 0)) {
      toast({ title: log.errSelectPlayer, variant: "destructive" });
      return;
    }

    // Duplicate check
    const all = [...aPlayers, ...bPlayers];
    if (new Set(all).size !== all.length) {
      toast({ title: log.errDuplicatePlayer, variant: "destructive" });
      return;
    }

    // Score validation
    const teamAScore: number[] = [];
    const teamBScore: number[] = [];
    for (const [aRaw, bRaw] of scores) {
      if (aRaw.trim().length === 0 || bRaw.trim().length === 0) {
        toast({ title: log.errInvalidScore, variant: "destructive" });
        return;
      }
      const a = Number(aRaw);
      const b = Number(bRaw);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) {
        toast({ title: log.errInvalidScore, variant: "destructive" });
        return;
      }
      teamAScore.push(Math.trunc(a));
      teamBScore.push(Math.trunc(b));
    }

    try {
      const playedAtIso = new Date(playedAt).toISOString();
      await logMutation.mutateAsync({
        format,
        playedAt: playedAtIso,
        teamAPlayers: aPlayers,
        teamBPlayers: bPlayers,
        teamAScore,
        teamBScore,
        notes: notes.trim() || undefined,
        scoringFormat: "11_rally",
      });
      toast({ title: log.success });
      resetForm();
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      const errCode = (error as { code?: string })?.code ?? "";
      const msg =
        errCode === "not_authorized"
          ? log.errNotAuthorized
          : errCode === "player_not_in_event"
            ? log.errPlayerNotInEvent
            : errCode === "duplicate_player"
              ? log.errDuplicatePlayer
              : errCode === "team_size_mismatch"
                ? log.errSelectPlayer
                : errCode === "score_length_invalid"
                  ? log.errInvalidScore
                  : log.error;
      toast({ title: msg, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{log.dialogTitle}</DialogTitle>
          <DialogDescription>{log.dialogDesc}</DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!logMutation.isPending) handleSubmit();
          }}
          className="space-y-4"
        >
          {/* Format */}
          <div className="space-y-2">
            <Label>{log.formatLabel}</Label>
            <div className="flex gap-2 flex-wrap">
              {(["singles", "doubles", "mixed"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setFormat(f);
                    // Reset team arrays khi đổi format (singles bỏ player 2).
                    if (f === "singles") {
                      setTeamA((prev) => [prev[0] ?? "", ""]);
                      setTeamB((prev) => [prev[0] ?? "", ""]);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-md border text-sm ${
                    format === f
                      ? "border-primary bg-primary/10 font-medium"
                      : "border-border bg-background"
                  }`}
                >
                  {f === "singles"
                    ? log.formatSingles
                    : f === "doubles"
                      ? log.formatDoubles
                      : log.formatMixed}
                </button>
              ))}
            </div>
          </div>

          {/* Played at */}
          <div className="space-y-2">
            <Label htmlFor="ev-match-played-at">{log.playedAtLabel}</Label>
            <Input
              id="ev-match-played-at"
              type="datetime-local"
              value={playedAt}
              onChange={(e) => setPlayedAt(e.target.value)}
              required
            />
          </div>

          {/* Team A */}
          <div className="space-y-2">
            <Label>{log.teamALabel}</Label>
            {Array.from({ length: teamSize }).map((_, i) => (
              <select
                key={`a${i}`}
                value={teamA[i] ?? ""}
                onChange={(e) => setPlayer("a", i, e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">{log.selectPlayerPlaceholder}</option>
                {options.map((p) => (
                  <option
                    key={p.profile_id}
                    value={p.profile_id}
                    disabled={
                      teamA.indexOf(p.profile_id) !== -1 && teamA.indexOf(p.profile_id) !== i
                        ? true
                        : teamB.indexOf(p.profile_id) !== -1
                    }
                  >
                    {p.display_name}
                  </option>
                ))}
              </select>
            ))}
          </div>

          {/* Team B */}
          <div className="space-y-2">
            <Label>{log.teamBLabel}</Label>
            {Array.from({ length: teamSize }).map((_, i) => (
              <select
                key={`b${i}`}
                value={teamB[i] ?? ""}
                onChange={(e) => setPlayer("b", i, e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">{log.selectPlayerPlaceholder}</option>
                {options.map((p) => (
                  <option
                    key={p.profile_id}
                    value={p.profile_id}
                    disabled={
                      teamB.indexOf(p.profile_id) !== -1 && teamB.indexOf(p.profile_id) !== i
                        ? true
                        : teamA.indexOf(p.profile_id) !== -1
                    }
                  >
                    {p.display_name}
                  </option>
                ))}
              </select>
            ))}
          </div>

          {/* Scores */}
          <div className="space-y-2">
            <Label>{log.scoresLabel}</Label>
            <div className="space-y-2">
              {scores.map((game, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-12">
                    {log.gameLabel} {idx + 1}
                  </span>
                  <Input
                    type="number"
                    min="0"
                    max="99"
                    inputMode="numeric"
                    value={game[0]}
                    onChange={(e) => setScore(idx, 0, e.target.value)}
                    placeholder="A"
                    className="w-20"
                    required
                  />
                  <span>—</span>
                  <Input
                    type="number"
                    min="0"
                    max="99"
                    inputMode="numeric"
                    value={game[1]}
                    onChange={(e) => setScore(idx, 1, e.target.value)}
                    placeholder="B"
                    className="w-20"
                    required
                  />
                  {scores.length > 1 && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => removeGame(idx)}
                    >
                      ×
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {scores.length < 5 && (
              <Button type="button" size="sm" variant="outline" onClick={addGame}>
                + {log.addGameCta}
              </Button>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="ev-match-notes">{log.notesLabel}</Label>
            <Input
              id="ev-match-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={log.notesPlaceholder}
              maxLength={500}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2 border-t">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={logMutation.isPending}
            >
              {t.common.cancel}
            </Button>
            <Button type="submit" disabled={logMutation.isPending}>
              {logMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {logMutation.isPending ? log.submitting : log.submitCta}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
