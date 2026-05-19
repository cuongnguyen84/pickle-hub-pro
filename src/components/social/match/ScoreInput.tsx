// ============================================================================
// ScoreInput — Sprint 2 Phase 3A.3 wizard step 4
// ----------------------------------------------------------------------------
// Multi-game score entry with realtime validation against
// lib/social/score-validation (FIX 1 clean — no tied series).
//
// - Format chips on top: 11 rally / 11 traditional / 15 rally / 21 rally
// - Up to 5 game rows; +/- to add/remove
// - Live validation: green winner badge or red error
// - Mobile: inputmode="numeric", touch targets >=44px
// ============================================================================

import { useMemo } from "react";
import { Plus, X, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import { validateScores, type ScoringFormat } from "@/lib/social";

interface ScoreInputProps {
  scoringFormat: ScoringFormat;
  teamA: number[];
  teamB: number[];
  onScoringFormatChange: (next: ScoringFormat) => void;
  onScoresChange: (teamA: number[], teamB: number[]) => void;
}

const FORMATS_VI: { id: ScoringFormat; label: string }[] = [
  { id: "11_rally",       label: "11 rally" },
  { id: "11_traditional", label: "11 truyền thống" },
  { id: "15_rally",       label: "15 rally" },
  { id: "21_rally",       label: "21 rally" },
];
const FORMATS_EN: { id: ScoringFormat; label: string }[] = [
  { id: "11_rally",       label: "11 rally" },
  { id: "11_traditional", label: "11 traditional" },
  { id: "15_rally",       label: "15 rally" },
  { id: "21_rally",       label: "21 rally" },
];

const MAX_GAMES = 5;

export const ScoreInput = ({
  scoringFormat,
  teamA,
  teamB,
  onScoringFormatChange,
  onScoresChange,
}: ScoreInputProps) => {
  const { language } = useI18n();
  const FORMATS = language === "vi" ? FORMATS_VI : FORMATS_EN;
  // Ensure we always show at least 1 row
  const rows = Math.max(1, teamA.length, teamB.length);

  const validation = useMemo(() => {
    if (teamA.length === 0 || teamB.length === 0) return null;
    return validateScores(teamA, teamB, scoringFormat);
  }, [teamA, teamB, scoringFormat]);

  const setScore = (idx: number, side: "a" | "b", raw: string) => {
    const num = raw === "" ? 0 : parseInt(raw, 10);
    if (Number.isNaN(num)) return;
    const clamp = Math.max(0, Math.min(50, num));
    const a = [...teamA];
    const b = [...teamB];
    while (a.length <= idx) a.push(0);
    while (b.length <= idx) b.push(0);
    if (side === "a") a[idx] = clamp; else b[idx] = clamp;
    onScoresChange(a, b);
  };

  const addGame = () => {
    if (rows >= MAX_GAMES) return;
    onScoresChange([...teamA, 0], [...teamB, 0]);
  };

  const removeGame = (idx: number) => {
    if (rows <= 1) return;
    const a = teamA.filter((_, i) => i !== idx);
    const b = teamB.filter((_, i) => i !== idx);
    onScoresChange(a, b);
  };

  return (
    <div className="space-y-5">
      {/* ─── Scoring format chips ─────────────────────────────────────── */}
      <div>
        <div className="mb-2 text-sm font-medium">
          {language === "vi" ? "Thể thức tính điểm" : "Scoring format"}
        </div>
        <div className="flex flex-wrap gap-2">
          {FORMATS.map(({ id, label }) => {
            const active = scoringFormat === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onScoringFormatChange(id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition-colors min-h-[40px]",
                  active
                    ? "border-social-primary bg-social-primary text-white"
                    : "border-border bg-card hover:bg-accent",
                )}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Game rows ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2 px-1 text-xs font-medium text-muted-foreground">
          <span className="text-center">
            {language === "vi" ? "Đội A" : "Team A"}
          </span>
          <span />
          <span className="text-center">
            {language === "vi" ? "Đội B" : "Team B"}
          </span>
          <span />
        </div>
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-2"
          >
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              type="number"
              min={0}
              max={50}
              value={teamA[idx] ?? 0}
              onChange={(e) => setScore(idx, "a", e.target.value)}
              className="h-12 text-center text-lg font-semibold"
              aria-label={
                language === "vi"
                  ? `Đội A game ${idx + 1}`
                  : `Team A game ${idx + 1}`
              }
            />
            <span className="text-muted-foreground">:</span>
            <Input
              inputMode="numeric"
              pattern="[0-9]*"
              type="number"
              min={0}
              max={50}
              value={teamB[idx] ?? 0}
              onChange={(e) => setScore(idx, "b", e.target.value)}
              className="h-12 text-center text-lg font-semibold"
              aria-label={
                language === "vi"
                  ? `Đội B game ${idx + 1}`
                  : `Team B game ${idx + 1}`
              }
            />
            {rows > 1 ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeGame(idx)}
                aria-label={
                  language === "vi"
                    ? `Xóa game ${idx + 1}`
                    : `Remove game ${idx + 1}`
                }
                className="h-11 w-11"
              >
                <X className="h-4 w-4" />
              </Button>
            ) : (
              <span className="w-11" />
            )}
          </div>
        ))}
        {rows < MAX_GAMES && (
          <Button
            type="button"
            variant="outline"
            onClick={addGame}
            className="w-full gap-2"
          >
            <Plus className="h-4 w-4" />
            {language === "vi" ? "Thêm game" : "Add game"} ({rows + 1}/
            {MAX_GAMES})
          </Button>
        )}
      </div>

      {/* ─── Validation feedback ─────────────────────────────────────── */}
      {validation && validation.valid && (
        <div className="flex items-center gap-2 rounded-xl border border-social-success/40 bg-social-success/10 p-3 text-social-success">
          <Trophy className="h-5 w-5 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold">
              {language === "vi"
                ? `Đội ${validation.winner.toUpperCase()} thắng`
                : `Team ${validation.winner.toUpperCase()} wins`}
            </span>
            <span className="ml-2 text-muted-foreground">
              ({validation.games_a}-{validation.games_b}{" "}
              {language === "vi" ? "game" : "games"})
            </span>
          </div>
        </div>
      )}
      {validation && !validation.valid && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {validation.reason}
        </div>
      )}
    </div>
  );
};

export default ScoreInput;
