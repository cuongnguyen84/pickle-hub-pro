// ============================================================================
// MatchConfirmation — Sprint 2 Phase 3A.3 wizard step 5
// ----------------------------------------------------------------------------
// Final preview before submit. Shows scoreboard, venue, players with avatars,
// and a collapsible "thêm chi tiết" section for notes/match_type/played_at.
// "Lưu trận đấu" button dispatches to useMatchCreate (Phase 3A.4 wires).
// ============================================================================

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";
import type { ParticipantSlot } from "./PlayerSelector";
import type { Venue } from "@/hooks/social/types";
import { validateScores, type ScoringFormat } from "@/lib/social";

export type MatchType = "rec" | "open_play" | "tournament" | "league" | "practice";

export interface ConfirmationState {
  notes: string;
  played_at: string;
  match_type: MatchType;
  submit_to_dupr: boolean;
}

interface MatchConfirmationProps {
  venue: Venue | null;
  venueNameOverride: string;
  format: "singles" | "doubles" | "mixed";
  participants: ParticipantSlot[];
  teamA: number[];
  teamB: number[];
  scoringFormat: ScoringFormat;
  details: ConfirmationState;
  onDetailsChange: (next: ConfirmationState) => void;
  onSubmit: () => void;
  submitting: boolean;
}

const MATCH_TYPES_VI: { value: MatchType; label: string }[] = [
  { value: "rec",         label: "Giao lưu (rec)" },
  { value: "open_play",   label: "Open play" },
  { value: "tournament",  label: "Giải đấu" },
  { value: "league",      label: "League" },
  { value: "practice",    label: "Tập luyện" },
];
const MATCH_TYPES_EN: { value: MatchType; label: string }[] = [
  { value: "rec",         label: "Casual (rec)" },
  { value: "open_play",   label: "Open play" },
  { value: "tournament",  label: "Tournament" },
  { value: "league",      label: "League" },
  { value: "practice",    label: "Practice" },
];

const initials = (name: string) =>
  name.split(/\s+/).map((p) => p[0] ?? "").join("").slice(0, 2).toUpperCase();

const fmtDateTimeLocal = (iso: string) => {
  // Convert ISO → input[type=datetime-local] value (YYYY-MM-DDTHH:MM)
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return "";
  }
};

const fmtDateTime = (iso: string, language: "vi" | "en") => {
  try {
    return new Date(iso).toLocaleString(language === "vi" ? "vi-VN" : "en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const TeamRoster = ({
  team,
  participants,
  isWinner,
  scores,
}: {
  team: "a" | "b";
  participants: ParticipantSlot[];
  isWinner: boolean;
  scores: number[];
}) => {
  const { language } = useI18n();
  return (
  <div
    className={cn(
      "flex-1 rounded-xl border-2 p-3",
      isWinner ? "border-social-primary bg-social-primary/5" : "border-border bg-card",
    )}
  >
    <div className="mb-2 flex items-center justify-between">
      <span className="text-xs font-semibold uppercase">
        {language === "vi" ? "Đội" : "Team"} {team.toUpperCase()}
      </span>
      {isWinner && (
        <Trophy className="h-4 w-4 text-social-primary" />
      )}
    </div>
    <div className="mb-2 flex flex-wrap gap-1">
      {scores.map((s, i) => (
        <span
          key={i}
          className={cn(
            "rounded-md px-2 py-0.5 font-mono text-sm",
            isWinner ? "bg-social-primary/10 text-social-primary font-semibold" : "bg-muted text-foreground",
          )}
        >
          {s}
        </span>
      ))}
    </div>
    <div className="space-y-1.5">
      {participants
        .filter((p) => p.team === team)
        .sort((a, b) => a.position - b.position)
        .map((p) => (
          <div key={p.player_id} className="flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarImage src={p.avatar_url ?? undefined} alt={p.display_name} />
              <AvatarFallback className="text-xs">{initials(p.display_name)}</AvatarFallback>
            </Avatar>
            <span className="truncate text-sm">{p.display_name}</span>
            {p.is_ghost && <Badge variant="outline" className="px-1 py-0 text-[10px]">ghost</Badge>}
          </div>
        ))}
    </div>
  </div>
  );
};

export const MatchConfirmation = ({
  venue,
  venueNameOverride,
  format,
  participants,
  teamA,
  teamB,
  scoringFormat,
  details,
  onDetailsChange,
  onSubmit,
  submitting,
}: MatchConfirmationProps) => {
  const { language } = useI18n();
  const MATCH_TYPES = language === "vi" ? MATCH_TYPES_VI : MATCH_TYPES_EN;
  const [showDetails, setShowDetails] = useState(false);
  const validation = validateScores(teamA, teamB, scoringFormat);
  const winner = validation.valid ? validation.winner : null;
  const venueLabel =
    venue?.name_vi || venue?.name || venueNameOverride ||
    (language === "vi" ? "Chưa rõ" : "Not specified");
  const formatLabel =
    language === "vi"
      ? ({ singles: "Đơn", doubles: "Đôi", mixed: "Đôi nam-nữ" } as const)[format]
      : ({ singles: "Singles", doubles: "Doubles", mixed: "Mixed" } as const)[format];

  return (
    <div className="space-y-4">
      {/* ─── Header summary ─────────────────────────────────────────────── */}
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-3 text-xs text-muted-foreground">
          {fmtDateTime(details.played_at, language)} · {venueLabel} · {formatLabel}
        </div>
        <div className="flex gap-2">
          <TeamRoster team="a" participants={participants} isWinner={winner === "a"} scores={teamA} />
          <TeamRoster team="b" participants={participants} isWinner={winner === "b"} scores={teamB} />
        </div>
      </div>

      {/* ─── Collapsible details ───────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setShowDetails((s) => !s)}
        className="flex w-full items-center justify-between rounded-xl border bg-card p-3 text-left text-sm font-medium hover:bg-accent"
      >
        <span>{language === "vi" ? "Thêm chi tiết" : "Add details"}</span>
        {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {showDetails && (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <div>
            <Label htmlFor="match-played-at">
              {language === "vi" ? "Thời gian thi đấu" : "Match time"}
            </Label>
            <Input
              id="match-played-at"
              type="datetime-local"
              value={fmtDateTimeLocal(details.played_at)}
              onChange={(e) => {
                const next = new Date(e.target.value).toISOString();
                onDetailsChange({ ...details, played_at: next });
              }}
              max={fmtDateTimeLocal(new Date().toISOString())}
              className="h-11"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {language === "vi"
                ? "Tối đa 24h trước. Mặc định: bây giờ."
                : "Max 24h in the past. Default: now."}
            </p>
          </div>
          <div>
            <Label htmlFor="match-type">
              {language === "vi" ? "Loại trận" : "Match type"}
            </Label>
            <Select
              value={details.match_type}
              onValueChange={(v) => onDetailsChange({ ...details, match_type: v as MatchType })}
            >
              <SelectTrigger id="match-type" className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MATCH_TYPES.map((mt) => (
                  <SelectItem key={mt.value} value={mt.value}>{mt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="match-notes">
              {language === "vi" ? "Ghi chú" : "Notes"}
            </Label>
            <Textarea
              id="match-notes"
              value={details.notes}
              onChange={(e) => onDetailsChange({ ...details, notes: e.target.value.slice(0, 500) })}
              placeholder={
                language === "vi"
                  ? "Thời tiết, đặc điểm trận, ..."
                  : "Weather, match notes, ..."
              }
              maxLength={500}
              rows={3}
            />
            <p className="mt-1 text-xs text-muted-foreground">{details.notes.length}/500</p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="flex-1">
              <Label htmlFor="dupr-toggle" className="cursor-pointer">Submit to DUPR</Label>
              <p className="text-xs text-muted-foreground">
                {language === "vi"
                  ? "Phase 1 chỉ ghi flag — chưa thực sự gửi DUPR."
                  : "Phase 1 only stores the flag — DUPR submission not active yet."}
              </p>
            </div>
            <Switch
              id="dupr-toggle"
              checked={details.submit_to_dupr}
              onCheckedChange={(v) => onDetailsChange({ ...details, submit_to_dupr: v })}
            />
          </div>
        </div>
      )}

      {/* ─── Validation issues warning ─────────────────────────────────── */}
      {!validation.valid && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {language === "vi"
            ? `Quay lại bước 4 để sửa tỷ số: ${validation.reason}`
            : `Go back to step 4 to fix the score: ${validation.reason}`}
        </div>
      )}

      {/* ─── Submit ────────────────────────────────────────────────────── */}
      <Button
        type="button"
        onClick={onSubmit}
        disabled={submitting || !validation.valid}
        className="h-12 w-full bg-social-primary text-white hover:bg-social-primary-dark"
      >
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {language === "vi" ? "Lưu trận đấu" : "Save match"}
      </Button>
    </div>
  );
};

export default MatchConfirmation;
