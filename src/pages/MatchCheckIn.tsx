// ============================================================================
// MatchCheckIn — Sprint 2 Phase 3A.1 wizard scaffold
// ----------------------------------------------------------------------------
// 5-step check-in flow for logging a pickleball match.
// Phase 3A.2 + 3A.3 will fill the actual step bodies (venue picker, format
// selector, players, scores, review). Phase 3A.4 will wire submit to the
// match-create edge function.
//
// State lives in a single useReducer so step components can be ported in
// later commits without prop drilling. URL: /tran-dau/moi.
// ============================================================================

import { useReducer, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";
import MainLayout from "@/components/layout/MainLayout";
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

// ─── Types (mirror match-create edge function body) ─────────────────────────
type Format = "singles" | "doubles" | "mixed";
type ScoringFormat = "11_rally" | "11_traditional" | "15_rally" | "21_rally";
type Team = "a" | "b";

export interface ParticipantDraft {
  player_id: string | null;
  team: Team;
  position: 1 | 2 | null;
  display_name?: string;
}

export interface CheckInState {
  currentStep: number;
  venue_id: string | null;
  venue_name_override: string;
  format: Format;
  participants: ParticipantDraft[];
  team_a_score: number[];
  team_b_score: number[];
  scoring_format: ScoringFormat;
  notes: string;
  played_at: string; // ISO; default = now (set on entry)
}

type Action =
  | { type: "GOTO"; step: number }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "SET_VENUE"; venue_id: string | null; venue_name_override?: string }
  | { type: "SET_FORMAT"; format: Format }
  | { type: "SET_PARTICIPANTS"; participants: ParticipantDraft[] }
  | { type: "SET_SCORES"; team_a: number[]; team_b: number[] }
  | { type: "SET_SCORING_FORMAT"; scoring_format: ScoringFormat }
  | { type: "SET_NOTES"; notes: string }
  | { type: "SET_PLAYED_AT"; played_at: string }
  | { type: "RESET" };

const TOTAL_STEPS = 5;

const initialState: CheckInState = {
  currentStep: 1,
  venue_id: null,
  venue_name_override: "",
  format: "doubles",
  participants: [],
  team_a_score: [],
  team_b_score: [],
  scoring_format: "11_rally",
  notes: "",
  played_at: new Date().toISOString(),
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
      return {
        ...state,
        venue_id: action.venue_id,
        venue_name_override:
          action.venue_name_override ?? state.venue_name_override,
      };
    case "SET_FORMAT":
      return { ...state, format: action.format };
    case "SET_PARTICIPANTS":
      return { ...state, participants: action.participants };
    case "SET_SCORES":
      return { ...state, team_a_score: action.team_a, team_b_score: action.team_b };
    case "SET_SCORING_FORMAT":
      return { ...state, scoring_format: action.scoring_format };
    case "SET_NOTES":
      return { ...state, notes: action.notes };
    case "SET_PLAYED_AT":
      return { ...state, played_at: action.played_at };
    case "RESET":
      return { ...initialState, played_at: new Date().toISOString() };
    default:
      return state;
  }
}

// ─── Step labels (Vietnamese canonical per spec §2) ─────────────────────────
const STEPS: { id: number; title: string; subtitle: string }[] = [
  { id: 1, title: "Sân & thời gian", subtitle: "Chọn sân và lúc nào trận diễn ra" },
  { id: 2, title: "Định dạng",       subtitle: "Đôi, đơn hay mixed?" },
  { id: 3, title: "Người chơi",      subtitle: "Ai tham gia 2 đội?" },
  { id: 4, title: "Tỷ số",           subtitle: "Nhập điểm từng game" },
  { id: 5, title: "Xem lại",         subtitle: "Kiểm tra và lưu" },
];

const MatchCheckIn = () => {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(reducer, initialState);
  const [confirmAbandon, setConfirmAbandon] = useState(false);

  const stepMeta = useMemo(
    () => STEPS.find((s) => s.id === state.currentStep) ?? STEPS[0],
    [state.currentStep],
  );

  const progressValue = (state.currentStep / TOTAL_STEPS) * 100;
  const isLastStep = state.currentStep === TOTAL_STEPS;
  const isFirstStep = state.currentStep === 1;

  const handleAbandon = () => {
    setConfirmAbandon(false);
    navigate(-1);
  };

  return (
    <MainLayout className="bg-social-bg-elevated dark:bg-social-neutral-900">
      <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 py-4 md:py-8">
        {/* ─── Header: progress + abandon ────────────────────────────────── */}
        <div className="flex items-center gap-3 pb-4">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Bỏ"
            onClick={() => setConfirmAbandon(true)}
          >
            <X className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="mb-1 flex items-baseline justify-between text-xs text-muted-foreground">
              <span>
                Bước {state.currentStep}/{TOTAL_STEPS}
              </span>
              <span className="hidden sm:inline">{stepMeta.subtitle}</span>
            </div>
            <Progress
              value={progressValue}
              className="h-1.5 [&>div]:bg-social-primary"
              aria-label={`Tiến trình: bước ${state.currentStep} trên ${TOTAL_STEPS}`}
            />
          </div>
        </div>

        {/* ─── Step body ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <h1 className="mb-1 text-2xl font-bold tracking-tight">
            {stepMeta.title}
          </h1>
          <p className="mb-6 text-sm text-muted-foreground sm:hidden">
            {stepMeta.subtitle}
          </p>

          {/* Step content placeholder — Phase 3A.2 + 3A.3 will replace */}
          <div
            className={cn(
              "rounded-2xl border border-dashed border-muted-foreground/30",
              "bg-card/50 p-8 text-center",
            )}
            data-testid={`step-${state.currentStep}-placeholder`}
          >
            <p className="text-sm text-muted-foreground">
              Step {state.currentStep} content sẽ ship trong Phase 3A.{state.currentStep < 5 ? "2" : "3"}.
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground/70">
              state.currentStep = {state.currentStep}
            </p>
          </div>
        </div>

        {/* ─── Footer: Back / Next ──────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 border-t pt-4">
          <Button
            variant="ghost"
            onClick={() => dispatch({ type: "BACK" })}
            disabled={isFirstStep}
            className="gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Quay lại
          </Button>
          <Button
            onClick={() => dispatch({ type: "NEXT" })}
            disabled={isLastStep}
            className="bg-social-primary text-white hover:bg-social-primary-dark"
          >
            {isLastStep ? "Hoàn tất" : "Tiếp tục"}
          </Button>
        </div>
      </div>

      {/* ─── Abandon confirm ─────────────────────────────────────────────── */}
      <AlertDialog open={confirmAbandon} onOpenChange={setConfirmAbandon}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bỏ check-in?</AlertDialogTitle>
            <AlertDialogDescription>
              Toàn bộ thông tin trận đấu chưa lưu sẽ mất. Bạn có chắc muốn thoát?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Tiếp tục check-in</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAbandon}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Thoát
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default MatchCheckIn;
