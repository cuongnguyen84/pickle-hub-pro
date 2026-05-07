// ============================================================================
// MatchCheckIn — Sprint 2 Phase 3A wizard (full implementation)
// ----------------------------------------------------------------------------
// 5-step check-in flow for logging a pickleball match. State lives in a
// single useReducer; each step component is presentational and dispatches
// changes back here. Step 5 calls match-create edge function via
// useMatchCreate (Sprint 1 → live since Phase 2 prod deploy).
// ============================================================================

import { useReducer, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { useI18n } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { collectDeviceMeta, validateScores } from "@/lib/social";
import VenuePicker from "@/components/social/match/VenuePicker";
import FormatSelector, { type Format } from "@/components/social/match/FormatSelector";
import PlayerSelector, {
  type ParticipantSlot,
} from "@/components/social/match/PlayerSelector";
import ScoreInput from "@/components/social/match/ScoreInput";
import MatchConfirmation, {
  type MatchType,
  type ConfirmationState,
} from "@/components/social/match/MatchConfirmation";
import { useMatchCreate, type Venue } from "@/hooks/social";

type ScoringFormat = "11_rally" | "11_traditional" | "15_rally" | "21_rally";

interface CheckInState {
  currentStep: number;
  venue: Venue | null;
  venue_name_override: string;
  format: Format;
  participants: ParticipantSlot[];
  team_a_score: number[];
  team_b_score: number[];
  scoring_format: ScoringFormat;
  details: ConfirmationState;
}

type Action =
  | { type: "GOTO"; step: number }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "SET_VENUE"; venue: Venue | null }
  | { type: "SET_VENUE_OVERRIDE"; value: string }
  | { type: "SET_FORMAT"; format: Format }
  | { type: "SET_PARTICIPANTS"; participants: ParticipantSlot[] }
  | { type: "SET_SCORES"; teamA: number[]; teamB: number[] }
  | { type: "SET_SCORING_FORMAT"; scoringFormat: ScoringFormat }
  | { type: "SET_DETAILS"; details: ConfirmationState };

const TOTAL_STEPS = 5;

const initialState: CheckInState = {
  currentStep: 1,
  venue: null,
  venue_name_override: "",
  format: "doubles",
  participants: [],
  team_a_score: [],
  team_b_score: [],
  scoring_format: "11_rally",
  details: {
    notes: "",
    played_at: new Date().toISOString(),
    match_type: "rec",
    submit_to_dupr: false,
  },
};

function reducer(state: CheckInState, action: Action): CheckInState {
  switch (action.type) {
    case "GOTO":
      return { ...state, currentStep: Math.max(1, Math.min(TOTAL_STEPS, action.step)) };
    case "NEXT":
      return { ...state, currentStep: Math.min(TOTAL_STEPS, state.currentStep + 1) };
    case "BACK":
      return { ...state, currentStep: Math.max(1, state.currentStep - 1) };
    case "SET_VENUE":
      return { ...state, venue: action.venue };
    case "SET_VENUE_OVERRIDE":
      return { ...state, venue_name_override: action.value };
    case "SET_FORMAT":
      // When format changes, prune participants that don't fit (e.g. 4→2)
      return {
        ...state,
        format: action.format,
        participants: state.participants.slice(0, action.format === "singles" ? 2 : 4),
      };
    case "SET_PARTICIPANTS":
      return { ...state, participants: action.participants };
    case "SET_SCORES":
      return { ...state, team_a_score: action.teamA, team_b_score: action.teamB };
    case "SET_SCORING_FORMAT":
      return { ...state, scoring_format: action.scoringFormat };
    case "SET_DETAILS":
      return { ...state, details: action.details };
    default:
      return state;
  }
}

type StepMeta = { id: number; title: string; subtitle: string };
const STEPS_VI: StepMeta[] = [
  { id: 1, title: "Sân & thời gian", subtitle: "Chọn sân nơi diễn ra trận" },
  { id: 2, title: "Định dạng",       subtitle: "Đôi, đơn hay mixed?" },
  { id: 3, title: "Người chơi",      subtitle: "Ai tham gia 2 đội?" },
  { id: 4, title: "Tỷ số",           subtitle: "Nhập điểm từng game" },
  { id: 5, title: "Xem lại",         subtitle: "Kiểm tra và lưu" },
];
const STEPS_EN: StepMeta[] = [
  { id: 1, title: "Venue & time",  subtitle: "Where the match was played" },
  { id: 2, title: "Format",        subtitle: "Doubles, singles, or mixed?" },
  { id: 3, title: "Players",       subtitle: "Who's on each team?" },
  { id: 4, title: "Score",         subtitle: "Enter game-by-game scores" },
  { id: 5, title: "Review",        subtitle: "Check and save" },
];

const MatchCheckIn = () => {
  const navigate = useNavigate();
  const { language } = useI18n();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const matchCreate = useMatchCreate();
  const STEPS = language === "vi" ? STEPS_VI : STEPS_EN;

  const stepMeta = useMemo(
    () => STEPS.find((s) => s.id === state.currentStep) ?? STEPS[0],
    [state.currentStep, STEPS],
  );

  const progressValue = (state.currentStep / TOTAL_STEPS) * 100;
  const isLastStep = state.currentStep === TOTAL_STEPS;
  const isFirstStep = state.currentStep === 1;

  // ─── Per-step validation ─────────────────────────────────────────────
  const stepValid = useMemo(() => {
    switch (state.currentStep) {
      case 1:
        return state.venue !== null || state.venue_name_override.trim().length >= 2;
      case 2:
        return ["singles", "doubles", "mixed"].includes(state.format);
      case 3: {
        const expected = state.format === "singles" ? 2 : 4;
        return state.participants.length === expected;
      }
      case 4:
        return validateScores(state.team_a_score, state.team_b_score, state.scoring_format).valid;
      case 5:
        return validateScores(state.team_a_score, state.team_b_score, state.scoring_format).valid;
      default:
        return false;
    }
  }, [state]);

  const handleAbandon = () => {
    setConfirmAbandon(false);
    navigate(-1);
  };

  const handleSubmit = () => {
    matchCreate.mutate({
      format: state.format,
      match_type: state.details.match_type,
      venue_id: state.venue?.id ?? null,
      venue_name_override: state.venue ? null : state.venue_name_override || null,
      played_at: state.details.played_at,
      team_a_score: state.team_a_score,
      team_b_score: state.team_b_score,
      scoring_format: state.scoring_format,
      participants: state.participants.map((p) => ({
        player_id: p.player_id,
        team: p.team,
        position: p.position,
      })),
      notes: state.details.notes || null,
      device_meta: {
        capacitor_platform: collectDeviceMeta().capacitor_platform,
        device_fp: collectDeviceMeta().device_fp,
      },
    });
  };

  return (
    <TheLineLayout
      title={language === "vi" ? "Tạo trận đấu" : "Log match"}
      noindex
    >
      <div className="mx-auto flex w-full max-w-2xl flex-col bg-social-bg-elevated px-4 py-4 dark:bg-social-neutral-900 md:py-8">
        {/* ─── Header: progress + abandon ────────────────────────────── */}
        <div className="flex items-center gap-3 pb-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label={language === "vi" ? "Bỏ" : "Cancel"}
            onClick={() => setConfirmAbandon(true)}
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="mb-1 flex items-baseline justify-between text-xs text-muted-foreground">
              <span>
                {language === "vi" ? "Bước" : "Step"} {state.currentStep}/
                {TOTAL_STEPS}
              </span>
              <span className="hidden sm:inline">{stepMeta.subtitle}</span>
            </div>
            <Progress
              value={progressValue}
              className="h-1.5 [&>div]:bg-social-primary"
              aria-label={
                language === "vi"
                  ? `Tiến trình: bước ${state.currentStep} trên ${TOTAL_STEPS}`
                  : `Progress: step ${state.currentStep} of ${TOTAL_STEPS}`
              }
            />
          </div>
        </div>

        {/* ─── Step body ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <h1 className="mb-1 text-2xl font-bold tracking-tight">{stepMeta.title}</h1>
          <p className="mb-6 text-sm text-muted-foreground sm:hidden">
            {stepMeta.subtitle}
          </p>

          {state.currentStep === 1 && (
            <VenuePicker
              selectedId={state.venue?.id ?? null}
              selectedVenue={state.venue}
              onSelect={(v) => dispatch({ type: "SET_VENUE", venue: v })}
              venueNameOverride={state.venue_name_override}
              onOverrideChange={(v) => dispatch({ type: "SET_VENUE_OVERRIDE", value: v })}
            />
          )}
          {state.currentStep === 2 && (
            <FormatSelector
              value={state.format}
              onSelect={(f) => {
                dispatch({ type: "SET_FORMAT", format: f });
                // Auto-advance per spec
                setTimeout(() => dispatch({ type: "NEXT" }), 200);
              }}
            />
          )}
          {state.currentStep === 3 && (
            <PlayerSelector
              format={state.format}
              participants={state.participants}
              onChange={(p) => dispatch({ type: "SET_PARTICIPANTS", participants: p })}
            />
          )}
          {state.currentStep === 4 && (
            <ScoreInput
              scoringFormat={state.scoring_format}
              teamA={state.team_a_score}
              teamB={state.team_b_score}
              onScoringFormatChange={(f) => dispatch({ type: "SET_SCORING_FORMAT", scoringFormat: f })}
              onScoresChange={(a, b) => dispatch({ type: "SET_SCORES", teamA: a, teamB: b })}
            />
          )}
          {state.currentStep === 5 && (
            <MatchConfirmation
              venue={state.venue}
              venueNameOverride={state.venue_name_override}
              format={state.format}
              participants={state.participants}
              teamA={state.team_a_score}
              teamB={state.team_b_score}
              scoringFormat={state.scoring_format}
              details={state.details}
              onDetailsChange={(d) => dispatch({ type: "SET_DETAILS", details: d })}
              onSubmit={handleSubmit}
              submitting={matchCreate.isPending}
            />
          )}
        </div>

        {/* ─── Footer: Back / Next (hidden on step 5 — has its own button) ── */}
        {!isLastStep && (
          <div className="flex items-center justify-between gap-3 border-t pt-4">
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: "BACK" })}
              disabled={isFirstStep}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              {language === "vi" ? "Quay lại" : "Back"}
            </Button>
            <Button
              onClick={() => dispatch({ type: "NEXT" })}
              disabled={!stepValid}
              className={cn(
                "bg-social-primary text-white hover:bg-social-primary-dark",
                !stepValid && "opacity-50",
              )}
            >
              {language === "vi" ? "Tiếp tục" : "Continue"}
            </Button>
          </div>
        )}
        {isLastStep && (
          <div className="flex items-center border-t pt-4">
            <Button
              variant="ghost"
              onClick={() => dispatch({ type: "BACK" })}
              className="gap-1"
            >
              <ArrowLeft className="h-4 w-4" />
              {language === "vi"
                ? "Quay lại bước 4 (sửa tỷ số)"
                : "Back to step 4 (edit score)"}
            </Button>
          </div>
        )}
      </div>

      {/* ─── Abandon confirm ────────────────────────────────────────────── */}
      <AlertDialog open={confirmAbandon} onOpenChange={setConfirmAbandon}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === "vi" ? "Bỏ check-in?" : "Abandon check-in?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {language === "vi"
                ? "Toàn bộ thông tin trận đấu chưa lưu sẽ mất. Bạn có chắc muốn thoát?"
                : "All unsaved match info will be lost. Are you sure you want to leave?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {language === "vi" ? "Tiếp tục check-in" : "Keep going"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAbandon}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {language === "vi" ? "Thoát" : "Leave"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TheLineLayout>
  );
};

export default MatchCheckIn;
