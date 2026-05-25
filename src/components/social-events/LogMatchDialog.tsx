// ============================================================================
// LogMatchDialog — organizer-only form to log a club match.
// ----------------------------------------------------------------------------
// Used inside ClubLanding via ClubMatches section. Calls log_club_match RPC
// (migration 20260525120000) which atomically inserts a `matches` row +
// `match_participants` rows.
//
// Player picker is constrained to the active member roster of the club
// (passed in via props) so we never accidentally tag a non-member.
// ============================================================================

import { useMemo, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { useClubMembers } from "@/hooks/useClubMembers";
import {
  useLogClubMatch,
  type MatchFormat,
} from "@/hooks/useClubMatches";

interface Props {
  clubId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface PickerOption {
  id: string;
  label: string;
  duprId: string | null;
}

const MAX_GAMES = 5;
const DEFAULT_GAMES = 3;

function todayLocalDatetimeString(): string {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 16);
}

export function LogMatchDialog({ clubId, open, onOpenChange, onSuccess }: Props) {
  const { t } = useI18n();
  const m = t.socialEvents.matches;

  // Member roster — only active rows are eligible to be tagged in a match.
  const { members, isLoading: membersLoading } = useClubMembers(clubId);
  const memberOptions = useMemo<PickerOption[]>(
    () =>
      members
        .filter((row) => row.status === "active")
        .map((row) => ({
          id: row.profile_id,
          label: row.display_name?.trim() || row.email || row.phone || "—",
          duprId: null,
        })),
    [members],
  );

  // Form state.
  const [format, setFormat] = useState<MatchFormat>("doubles");
  const [playedAt, setPlayedAt] = useState<string>(todayLocalDatetimeString);
  const [teamA, setTeamA] = useState<string[]>(["", ""]);
  const [teamB, setTeamB] = useState<string[]>(["", ""]);
  const [scores, setScores] = useState<{ a: string; b: string }[]>(
    () => Array.from({ length: DEFAULT_GAMES }, () => ({ a: "", b: "" })),
  );
  const [notes, setNotes] = useState("");

  const teamSize = format === "singles" ? 1 : 2;

  const logMatch = useLogClubMatch(clubId);

  function resetForm() {
    setFormat("doubles");
    setPlayedAt(todayLocalDatetimeString());
    setTeamA(["", ""]);
    setTeamB(["", ""]);
    setScores(Array.from({ length: DEFAULT_GAMES }, () => ({ a: "", b: "" })));
    setNotes("");
  }

  function handleFormatChange(next: MatchFormat) {
    setFormat(next);
    const size = next === "singles" ? 1 : 2;
    setTeamA((prev) => {
      const arr = [...prev];
      arr.length = size;
      for (let i = 0; i < size; i++) arr[i] = arr[i] ?? "";
      return arr;
    });
    setTeamB((prev) => {
      const arr = [...prev];
      arr.length = size;
      for (let i = 0; i < size; i++) arr[i] = arr[i] ?? "";
      return arr;
    });
  }

  function setPlayer(
    team: "a" | "b",
    index: number,
    profileId: string,
  ): void {
    const setter = team === "a" ? setTeamA : setTeamB;
    setter((prev) => {
      const arr = [...prev];
      arr[index] = profileId;
      return arr;
    });
  }

  function addGame(): void {
    if (scores.length >= MAX_GAMES) return;
    setScores((prev) => [...prev, { a: "", b: "" }]);
  }

  function removeGame(index: number): void {
    if (scores.length <= 1) return;
    setScores((prev) => prev.filter((_, i) => i !== index));
  }

  function updateScore(index: number, team: "a" | "b", value: string): void {
    setScores((prev) => {
      const arr = [...prev];
      arr[index] = { ...arr[index], [team]: value };
      return arr;
    });
  }

  function validateForm(): string | null {
    if (teamA.slice(0, teamSize).some((id) => !id)) return m.errMissingPlayers;
    if (teamB.slice(0, teamSize).some((id) => !id)) return m.errMissingPlayers;

    // Reject duplicate players across teams.
    const all = [...teamA.slice(0, teamSize), ...teamB.slice(0, teamSize)];
    if (new Set(all).size !== all.length) return m.errDuplicatePlayer;

    // Every game needs both scores.
    for (const game of scores) {
      if (game.a === "" || game.b === "") return m.errIncompleteScore;
      const a = Number(game.a);
      const b = Number(game.b);
      if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) {
        return m.errInvalidScore;
      }
    }
    return null;
  }

  async function handleSubmit(): Promise<void> {
    const err = validateForm();
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }
    try {
      await logMatch.mutateAsync({
        format,
        playedAt: new Date(playedAt).toISOString(),
        teamAScore: scores.map((g) => Number(g.a)),
        teamBScore: scores.map((g) => Number(g.b)),
        teamAPlayers: teamA.slice(0, teamSize),
        teamBPlayers: teamB.slice(0, teamSize),
        notes: notes.trim() || undefined,
      });
      toast({ title: m.logSuccess });
      resetForm();
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      const code = (e as { code?: string })?.code ?? "";
      const msg =
        code === "player_not_in_club"
          ? m.errPlayerNotInClub
          : code === "duplicate_player"
            ? m.errDuplicatePlayer
            : code === "team_size_mismatch"
              ? m.errMissingPlayers
              : code === "not_authorized"
                ? t.socialEvents.managers.errNotAuthorized
                : m.logError;
      toast({ title: msg, variant: "destructive" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{m.logDialogTitle}</DialogTitle>
          <DialogDescription>{m.logDialogDesc}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Format + datetime */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{m.format}</Label>
              <Select
                value={format}
                onValueChange={(v) => handleFormatChange(v as MatchFormat)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="singles">{m.formatSingles}</SelectItem>
                  <SelectItem value="doubles">{m.formatDoubles}</SelectItem>
                  <SelectItem value="mixed">{m.formatMixed}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="played-at">{m.playedAt}</Label>
              <Input
                id="played-at"
                type="datetime-local"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
              />
            </div>
          </div>

          {/* Teams */}
          {membersLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : memberOptions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              {m.noActiveMembers}
            </p>
          ) : (
            <>
              <div>
                <Label className="mb-1 block">{m.teamA}</Label>
                <div className="space-y-2">
                  {Array.from({ length: teamSize }).map((_, i) => (
                    <Select
                      key={`a-${i}`}
                      value={teamA[i] ?? ""}
                      onValueChange={(v) => setPlayer("a", i, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={m.selectPlayer} />
                      </SelectTrigger>
                      <SelectContent>
                        {memberOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ))}
                </div>
              </div>

              <div>
                <Label className="mb-1 block">{m.teamB}</Label>
                <div className="space-y-2">
                  {Array.from({ length: teamSize }).map((_, i) => (
                    <Select
                      key={`b-${i}`}
                      value={teamB[i] ?? ""}
                      onValueChange={(v) => setPlayer("b", i, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={m.selectPlayer} />
                      </SelectTrigger>
                      <SelectContent>
                        {memberOptions.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Scores */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>{m.scores}</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addGame}
                disabled={scores.length >= MAX_GAMES}
                className="h-7 px-2"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> {m.addGame}
              </Button>
            </div>
            <div className="space-y-2">
              {scores.map((g, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">
                    {m.game} {i + 1}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={g.a}
                    onChange={(e) => updateScore(i, "a", e.target.value)}
                    placeholder="A"
                    className="w-16"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={g.b}
                    onChange={(e) => updateScore(i, "b", e.target.value)}
                    placeholder="B"
                    className="w-16"
                  />
                  {scores.length > 1 && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() => removeGame(i)}
                      className="h-7 w-7"
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">{m.notesOptional}</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={m.notesPlaceholder}
              rows={2}
              maxLength={500}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t.common.cancel}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={logMatch.isPending || memberOptions.length === 0}
          >
            {logMatch.isPending && (
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
            )}
            {m.logSubmit}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
