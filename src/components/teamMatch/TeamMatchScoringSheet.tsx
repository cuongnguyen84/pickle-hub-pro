import { useState, useEffect, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Loader2, Trophy, RotateCcw, Check, Plus, Minus, Radio } from 'lucide-react';
import { useTeamMatchMatch, useTeamMatchMatchManagement, TeamMatchMatch } from '@/hooks/useTeamMatchMatches';
import { useTeamMatchMatchRealtime } from '@/hooks/useTeamMatchRealtime';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n';
import { useToast } from '@/hooks/use-toast';
import { submitTeamMatchGame } from '@/lib/dupr/submitTeamMatchGame';
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

interface TeamMatchScoringSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: TeamMatchMatch | null;
  tournamentId: string;
  /** Team Match DUPR Phase 1 — needed to auto-submit games to DUPR. */
  tournamentName?: string;
  ratingSource?: 'self' | 'dupr' | 'either';
}

// ─── W2.4c shared tokens ─────────────────────────────────────────────────
const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 18,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
};

const fieldLabel: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-2)',
};

const statusPillBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10.5,
  fontWeight: 500,
  padding: '3px 9px',
  borderRadius: 4,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const teamNameStyle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontSize: 17,
  letterSpacing: '-0.01em',
  color: 'var(--tl-fg)',
};

export function TeamMatchScoringSheet({
  open,
  onOpenChange,
  match,
  tournamentId,
  tournamentName,
  ratingSource = 'self',
}: TeamMatchScoringSheetProps) {
  const { games, isLoading } = useTeamMatchMatch(match?.id);
  const { updateGameScore, updateMatchResult, isUpdatingScore, isUpdatingResult } = useTeamMatchMatchManagement();
  const { language } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Subscribe to realtime updates for this match
  useTeamMatchMatchRealtime(match?.id);

  const [selectedGameIndex, setSelectedGameIndex] = useState(0);
  const [localScoreA, setLocalScoreA] = useState(0);
  const [localScoreB, setLocalScoreB] = useState(0);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  const GAME_TYPE_LABELS: Record<string, string> = useMemo(() => (
    language === 'vi'
      ? { WD: 'Đôi Nữ', MD: 'Đôi Nam', MX: 'Đôi Nam Nữ', WS: 'Đơn Nữ', MS: 'Đơn Nam' }
      : { WD: 'WD', MD: 'MD', MX: 'Mixed', WS: 'WS', MS: 'MS' }
  ), [language]);

  const txt = {
    matchLabel: language === 'vi' ? 'Trận đấu' : 'Match',
    live: language === 'vi' ? 'LIVE' : 'LIVE',
    noGames: language === 'vi' ? 'Chưa có ván đấu nào' : 'No games yet',
    hint: language === 'vi' ? 'Chọn ô ván để chấm điểm' : 'Tap a game slot to score it',
    gameShort: language === 'vi' ? 'Ván' : 'Game',
    gamesUnit: language === 'vi' ? 'ván' : 'games',
    reset: language === 'vi' ? 'Đặt lại' : 'Reset',
    saveGame: (n: number) =>
      language === 'vi' ? `Lưu ván ${n}` : `Save game ${n}`,
    gamesViewTitle: language === 'vi' ? 'Các ván đấu' : 'Games',
    completedTitle: language === 'vi' ? 'Trận đấu đã kết thúc' : 'Match completed',
    completedWinner: (name: string) =>
      language === 'vi' ? `${name} chiến thắng` : `${name} won`,
    resetDialogTitle: language === 'vi' ? 'Đặt lại điểm?' : 'Reset score?',
    resetDialogDesc: language === 'vi'
      ? 'Điểm hiện tại sẽ được đặt về 0-0.'
      : 'Current score will be reset to 0-0.',
    saveDialogTitle: (n: number) =>
      language === 'vi' ? `Lưu ván ${n}?` : `Save game ${n}?`,
    saveDialogResultLabel: language === 'vi' ? 'Kết quả' : 'Result',
    saveDialogWonGame: (name: string) =>
      language === 'vi' ? `${name} thắng ván này.` : `${name} won this game.`,
    cancelBtn: language === 'vi' ? 'Hủy' : 'Cancel',
    confirmBtn: language === 'vi' ? 'Lưu' : 'Save',
    resetConfirm: language === 'vi' ? 'Đặt lại' : 'Reset',
    tbd: 'TBD',
  };

  // Collect all roster IDs from games to fetch player names
  const allRosterIds = useMemo(() => {
    const ids = new Set<string>();
    games.forEach(game => {
      game.lineup_team_a?.forEach(id => ids.add(id));
      game.lineup_team_b?.forEach(id => ids.add(id));
    });
    return Array.from(ids);
  }, [games]);

  // Fetch player names for all roster IDs
  const { data: rosterMap } = useQuery({
    queryKey: ['roster-names', allRosterIds],
    queryFn: async () => {
      if (allRosterIds.length === 0) return {};

      const { data, error } = await supabase
        .from('team_match_roster')
        .select('id, player_name')
        .in('id', allRosterIds);

      if (error) throw error;

      const map: Record<string, string> = {};
      data?.forEach(r => {
        map[r.id] = r.player_name;
      });
      return map;
    },
    enabled: allRosterIds.length > 0,
  });

  // Current selected game
  const currentGame = games[selectedGameIndex];

  // Calculate games won dynamically from games data
  const calculatedGamesWon = useMemo(() => {
    let gamesWonA = 0;
    let gamesWonB = 0;

    games.forEach(game => {
      if (game.score_a > game.score_b) gamesWonA++;
      else if (game.score_b > game.score_a) gamesWonB++;
    });

    return { a: gamesWonA, b: gamesWonB };
  }, [games]);

  // Reset local scores when game changes
  useEffect(() => {
    if (currentGame) {
      setLocalScoreA(currentGame.score_a || 0);
      setLocalScoreB(currentGame.score_b || 0);
    }
  }, [currentGame?.id, currentGame?.score_a, currentGame?.score_b]);

  // Auto-select first incomplete game when sheet opens
  useEffect(() => {
    if (open && games.length > 0) {
      const firstIncompleteIndex = games.findIndex(g => !g.winner_team_id);
      if (firstIncompleteIndex !== -1) {
        setSelectedGameIndex(firstIncompleteIndex);
      } else {
        setSelectedGameIndex(0);
      }
    }
  }, [open, games.length]);

  const handleScoreChange = (team: 'a' | 'b', delta: number) => {
    if (team === 'a') {
      setLocalScoreA(prev => Math.max(0, prev + delta));
    } else {
      setLocalScoreB(prev => Math.max(0, prev + delta));
    }
  };

  const handleReset = () => {
    setLocalScoreA(0);
    setLocalScoreB(0);
    setShowResetDialog(false);
  };

  const handleSaveGame = async () => {
    if (!match || !currentGame) return;

    try {
      // Update this game's score
      await updateGameScore({
        gameId: currentGame.id,
        scoreA: localScoreA,
        scoreB: localScoreB,
        matchId: match.id,
      });

      // Calculate match totals from all games including current update
      let gamesWonA = 0;
      let gamesWonB = 0;
      let totalPointsA = 0;
      let totalPointsB = 0;

      games.forEach((game, index) => {
        const scoreA = index === selectedGameIndex ? localScoreA : game.score_a;
        const scoreB = index === selectedGameIndex ? localScoreB : game.score_b;

        totalPointsA += scoreA;
        totalPointsB += scoreB;

        if (scoreA > scoreB) gamesWonA++;
        else if (scoreB > scoreA) gamesWonB++;
      });

      // Determine winner (majority of games)
      const totalGames = games.length;
      const requiredToWin = Math.ceil(totalGames / 2);
      let winnerId: string | null = null;

      if (gamesWonA >= requiredToWin && match.team_a_id) {
        winnerId = match.team_a_id;
      } else if (gamesWonB >= requiredToWin && match.team_b_id) {
        winnerId = match.team_b_id;
      }

      await updateMatchResult({
        matchId: match.id,
        gamesWonA,
        gamesWonB,
        totalPointsA,
        totalPointsB,
        winnerId,
        tournamentId,
      });

      // Team Match DUPR Phase 1 — best-effort submit this game to DUPR.
      // Soft-fail: errors are captured into team_match_games.dupr_submit_error
      // by the helper and never block scoring. Only fires when the organizer
      // opted into DUPR and the game has a winner.
      if (
        ratingSource !== 'self' &&
        localScoreA !== localScoreB &&
        !currentGame.dupr_submitted
      ) {
        try {
          const outcome = await submitTeamMatchGame({
            gameId: currentGame.id,
            gameType: currentGame.game_type,
            scoringType: currentGame.scoring_type,
            scoreA: localScoreA,
            scoreB: localScoreB,
            lineupRosterIdsA: currentGame.lineup_team_a ?? [],
            lineupRosterIdsB: currentGame.lineup_team_b ?? [],
            ratingSource,
            tournamentName: tournamentName ?? 'ThePickleHub Team Match',
            bracketLabel: currentGame.display_name || GAME_TYPE_LABELS[currentGame.game_type] || 'MLP Team Match',
            alreadySubmitted: !!currentGame.dupr_submitted,
          });
          if (outcome.kind === 'ok') {
            toast({
              title: language === 'vi' ? 'Đã đẩy lên DUPR' : 'Submitted to DUPR',
              description: outcome.matchCode
                ? (language === 'vi' ? `Mã trận: ${outcome.matchCode}` : `Match code: ${outcome.matchCode}`)
                : undefined,
            });
          } else if (outcome.kind === 'error') {
            toast({
              title: language === 'vi' ? 'Không đẩy được lên DUPR' : 'DUPR submit failed',
              description: outcome.message.slice(0, 160),
              variant: 'destructive',
            });
          }
          // kind === 'skipped' → silent (e.g. players not linked to DUPR)
          queryClient.invalidateQueries({ queryKey: ['team-match-games', match.id] });
        } catch (duprErr) {
          console.warn('[TeamMatchScoringSheet] DUPR submit:', duprErr);
        }
      }

      // Move to next game if not the last one and current game completed
      if (localScoreA !== localScoreB && selectedGameIndex < games.length - 1) {
        setSelectedGameIndex(prev => prev + 1);
      }

      setShowSaveDialog(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  if (!match) return null;

  const teamAName = (match.team_a as any)?.team_name || txt.tbd;
  const teamBName = (match.team_b as any)?.team_name || txt.tbd;

  // Get player names for current game
  const currentLineupA = currentGame?.lineup_team_a || [];
  const currentLineupB = currentGame?.lineup_team_b || [];
  const playersA = currentLineupA.map(id => rosterMap?.[id] || id).join(' - ');
  const playersB = currentLineupB.map(id => rosterMap?.[id] || id).join(' - ');

  const isMatchCompleted = match.status === 'completed';
  const totalGames = games.length;
  const winnerA = match.winner_team_id === match.team_a_id;
  const winnerB = match.winner_team_id === match.team_b_id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader
          style={{
            padding: '16px 16px 8px',
            borderBottom: '1px solid var(--tl-border)',
          }}
        >
          <SheetTitle
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                ...statusPillBase,
                background: 'var(--tl-surface)',
                color: 'var(--tl-fg)',
                border: '1px solid var(--tl-border)',
              }}
            >
              BO{totalGames}
            </span>
            {!isMatchCompleted && (
              <span
                style={{
                  ...statusPillBase,
                  background: 'rgba(255, 65, 54, 0.10)',
                  color: 'var(--tl-live)',
                  animation: 'tl-pulse 1.6s ease-in-out infinite',
                }}
              >
                <Radio className="h-3 w-3" />
                {txt.live}
              </span>
            )}
            <span
              style={{
                ...statusPillBase,
                background: 'var(--tl-surface)',
                color: 'var(--tl-fg-2)',
              }}
            >
              <Trophy className="h-3 w-3" />
              {txt.matchLabel}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Match Header with games score */}
          <div style={{ ...surfaceCard, padding: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ flex: 1, textAlign: 'center' }}>
                <p
                  style={{
                    ...teamNameStyle,
                    fontSize: 18,
                    margin: 0,
                    fontWeight: winnerA ? 600 : 400,
                    color: winnerA ? 'var(--tl-green)' : 'var(--tl-fg)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {teamAName}
                </p>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 28,
                    fontWeight: 700,
                    color: 'var(--tl-fg)',
                  }}
                >
                  {calculatedGamesWon.a} - {calculatedGamesWon.b}
                </div>
                <p style={{ ...fieldLabel, marginTop: 2, color: 'var(--tl-fg-3)' }}>{txt.gamesUnit}</p>
              </div>

              <div style={{ flex: 1, textAlign: 'center' }}>
                <p
                  style={{
                    ...teamNameStyle,
                    fontSize: 18,
                    margin: 0,
                    fontWeight: winnerB ? 600 : 400,
                    color: winnerB ? 'var(--tl-green)' : 'var(--tl-fg)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {teamBName}
                </p>
              </div>
            </div>
          </div>

          {/* Game slots */}
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <Loader2
                className="h-6 w-6 animate-spin mx-auto"
                style={{ color: 'var(--tl-fg-3)' }}
              />
            </div>
          ) : games.length === 0 ? (
            <p style={{ color: 'var(--tl-fg-3)', textAlign: 'center', padding: 16, fontSize: 13 }}>
              {txt.noGames}
            </p>
          ) : (
            <>
              {/* Clickable game slots */}
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
                {games.map((game, index) => {
                  const isSelected = index === selectedGameIndex;
                  const hasScore = game.score_a > 0 || game.score_b > 0;
                  const isCompleted = game.score_a !== game.score_b && hasScore;
                  const winnerSide = game.score_a > game.score_b ? 'a' : game.score_b > game.score_a ? 'b' : null;

                  const slotBg = isSelected
                    ? 'var(--tl-green-glow)'
                    : isCompleted
                      ? 'var(--tl-surface)'
                      : 'transparent';
                  const slotBorder = isSelected
                    ? '2px solid var(--tl-green)'
                    : isCompleted
                      ? '1px solid var(--tl-border)'
                      : '1px dashed var(--tl-border-2)';

                  return (
                    <button
                      key={game.id}
                      type="button"
                      onClick={() => setSelectedGameIndex(index)}
                      style={{
                        width: 56,
                        height: 64,
                        borderRadius: 8,
                        border: slotBorder,
                        background: slotBg,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div
                        style={{
                          ...fieldLabel,
                          fontSize: 10,
                          marginBottom: 2,
                          color: isSelected ? 'var(--tl-green)' : 'var(--tl-fg-3)',
                        }}
                      >
                        G{index + 1}
                      </div>
                      {hasScore ? (
                        <div
                          style={{
                            fontFamily: 'Geist Mono, ui-monospace, monospace',
                            fontVariantNumeric: 'tabular-nums',
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          <span style={{ color: winnerSide === 'a' ? 'var(--tl-green)' : 'var(--tl-fg-3)' }}>
                            {game.score_a}
                          </span>
                          <span style={{ color: 'var(--tl-fg-4)', margin: '0 2px' }}>-</span>
                          <span style={{ color: winnerSide === 'b' ? 'var(--tl-green)' : 'var(--tl-fg-3)' }}>
                            {game.score_b}
                          </span>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: 'var(--tl-fg-4)' }}>—</div>
                      )}
                    </button>
                  );
                })}
              </div>

              <p
                style={{
                  ...fieldLabel,
                  fontSize: 10.5,
                  textAlign: 'center',
                  color: 'var(--tl-fg-3)',
                  textTransform: 'none',
                  letterSpacing: '0.02em',
                }}
              >
                {txt.hint}
              </p>

              {/* Current game card */}
              {currentGame && (
                <div
                  style={{
                    ...surfaceCard,
                    padding: 14,
                    borderColor: 'var(--tl-green-dim)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 12,
                    }}
                  >
                    <span
                      style={{
                        ...statusPillBase,
                        background: 'var(--tl-green-glow)',
                        color: 'var(--tl-green)',
                      }}
                    >
                      {txt.gameShort} {selectedGameIndex + 1}
                    </span>
                    <span
                      style={{
                        ...statusPillBase,
                        background: 'var(--tl-surface)',
                        color: 'var(--tl-fg-2)',
                      }}
                    >
                      {GAME_TYPE_LABELS[currentGame.game_type] || currentGame.game_type}
                    </span>
                  </div>

                  {/* Lineup display with score */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
                      <p
                        style={{
                          ...teamNameStyle,
                          fontWeight: localScoreA > localScoreB ? 600 : 400,
                          color: localScoreA > localScoreB ? 'var(--tl-green)' : 'var(--tl-fg)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          margin: 0,
                        }}
                      >
                        {playersA || teamAName}
                      </p>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        fontFamily: 'Geist Mono, ui-monospace, monospace',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 36,
                          fontWeight: 700,
                          color: localScoreA > localScoreB ? 'var(--tl-green)' : 'var(--tl-fg)',
                        }}
                      >
                        {localScoreA}
                      </span>
                      <span style={{ fontSize: 24, fontWeight: 700, color: 'var(--tl-fg-4)' }}>:</span>
                      <span
                        style={{
                          fontSize: 36,
                          fontWeight: 700,
                          color: localScoreB > localScoreA ? 'var(--tl-green)' : 'var(--tl-fg)',
                        }}
                      >
                        {localScoreB}
                      </span>
                    </div>

                    <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                      <p
                        style={{
                          ...teamNameStyle,
                          fontWeight: localScoreB > localScoreA ? 600 : 400,
                          color: localScoreB > localScoreA ? 'var(--tl-green)' : 'var(--tl-fg)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          margin: 0,
                        }}
                      >
                        {playersB || teamBName}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Score controls */}
              {!isMatchCompleted && currentGame && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Team names row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div
                      style={{
                        textAlign: 'center',
                        ...fieldLabel,
                        color: 'var(--tl-fg)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {teamAName}
                    </div>
                    <div
                      style={{
                        textAlign: 'center',
                        ...fieldLabel,
                        color: 'var(--tl-fg)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {teamBName}
                    </div>
                  </div>

                  {/* Score controls row */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    {/* Team A controls */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="tl-btn"
                        style={{ width: 48, height: 56, justifyContent: 'center', padding: 0 }}
                        onClick={() => handleScoreChange('a', -1)}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="tl-btn green"
                        style={{ flex: 1, height: 56, justifyContent: 'center', padding: 0 }}
                        onClick={() => handleScoreChange('a', 1)}
                      >
                        <Plus className="w-6 h-6" />
                      </button>
                    </div>

                    {/* Team B controls */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        className="tl-btn"
                        style={{ width: 48, height: 56, justifyContent: 'center', padding: 0 }}
                        onClick={() => handleScoreChange('b', -1)}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        className="tl-btn green"
                        style={{ flex: 1, height: 56, justifyContent: 'center', padding: 0 }}
                        onClick={() => handleScoreChange('b', 1)}
                      >
                        <Plus className="w-6 h-6" />
                      </button>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className="tl-btn"
                      style={{ flex: 1, justifyContent: 'center', padding: '10px 12px' }}
                      onClick={() => setShowResetDialog(true)}
                    >
                      <RotateCcw className="w-4 h-4" />
                      {txt.reset}
                    </button>
                    <button
                      type="button"
                      className="tl-btn green"
                      style={{ flex: 1, justifyContent: 'center', padding: '10px 12px' }}
                      onClick={() => setShowSaveDialog(true)}
                      disabled={isUpdatingScore || isUpdatingResult}
                    >
                      {(isUpdatingScore || isUpdatingResult) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                      {txt.saveGame(selectedGameIndex + 1)}
                    </button>
                  </div>
                </div>
              )}

              {/* Games list - view only */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  paddingTop: 14,
                  borderTop: '1px solid var(--tl-border)',
                }}
              >
                <h4 style={{ ...fieldLabel, margin: 0 }}>{txt.gamesViewTitle}</h4>
                {games.map((game, index) => {
                  const lineupA = game.lineup_team_a || [];
                  const lineupB = game.lineup_team_b || [];
                  const gamePlayersA = lineupA.map(id => rosterMap?.[id] || id).join(', ');
                  const gamePlayersB = lineupB.map(id => rosterMap?.[id] || id).join(', ');
                  const gameWinner = game.score_a > game.score_b ? 'a' : game.score_b > game.score_a ? 'b' : null;
                  const isSelected = index === selectedGameIndex;

                  return (
                    <div
                      key={game.id}
                      onClick={() => setSelectedGameIndex(index)}
                      style={{
                        ...surfaceCard,
                        padding: 12,
                        cursor: 'pointer',
                        borderColor: isSelected ? 'var(--tl-green-dim)' : 'var(--tl-border)',
                        boxShadow: isSelected ? '0 0 0 1px var(--tl-green-dim)' : 'none',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: 8,
                        }}
                      >
                        <span style={fieldLabel}>{txt.gameShort} {index + 1}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {ratingSource !== 'self' && (() => {
                            const decided = game.score_a !== game.score_b && (game.score_a > 0 || game.score_b > 0);
                            if (game.dupr_submitted) {
                              return (
                                <span style={{ ...statusPillBase, background: 'var(--tl-green-glow)', color: 'var(--tl-green)' }}
                                  title={game.dupr_match_code ? `DUPR ${game.dupr_match_code}` : 'DUPR'}>
                                  DUPR ✓
                                </span>
                              );
                            }
                            if (game.dupr_submit_error) {
                              return (
                                <span style={{ ...statusPillBase, background: 'rgba(255,65,54,0.10)', color: 'var(--tl-live)' }}
                                  title={game.dupr_submit_error}>
                                  DUPR ✕
                                </span>
                              );
                            }
                            if (decided) {
                              return (
                                <span style={{ ...statusPillBase, background: 'var(--tl-surface)', color: 'var(--tl-fg-3)' }}>
                                  DUPR ⋯
                                </span>
                              );
                            }
                            return null;
                          })()}
                          <span
                            style={{
                              ...statusPillBase,
                              background: 'var(--tl-surface)',
                              color: 'var(--tl-fg-2)',
                            }}
                          >
                            {GAME_TYPE_LABELS[game.game_type] || game.game_type}
                          </span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <div
                          style={{
                            flex: 1,
                            textAlign: 'right',
                            fontSize: 13,
                            fontWeight: gameWinner === 'a' ? 600 : 400,
                            color: gameWinner === 'a' ? 'var(--tl-green)' : 'var(--tl-fg-2)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {gamePlayersA || teamAName}
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '6px 14px',
                            borderRadius: 6,
                            background: 'var(--tl-surface)',
                            border: '1px solid var(--tl-border)',
                            minWidth: 88,
                            justifyContent: 'center',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'Geist Mono, ui-monospace, monospace',
                              fontVariantNumeric: 'tabular-nums',
                              fontSize: 17,
                              fontWeight: 700,
                              color: gameWinner === 'a' ? 'var(--tl-green)' : 'var(--tl-fg)',
                            }}
                          >
                            {game.score_a}
                          </span>
                          <span style={{ color: 'var(--tl-fg-4)' }}>-</span>
                          <span
                            style={{
                              fontFamily: 'Geist Mono, ui-monospace, monospace',
                              fontVariantNumeric: 'tabular-nums',
                              fontSize: 17,
                              fontWeight: 700,
                              color: gameWinner === 'b' ? 'var(--tl-green)' : 'var(--tl-fg)',
                            }}
                          >
                            {game.score_b}
                          </span>
                        </div>

                        <div
                          style={{
                            flex: 1,
                            textAlign: 'left',
                            fontSize: 13,
                            fontWeight: gameWinner === 'b' ? 600 : 400,
                            color: gameWinner === 'b' ? 'var(--tl-green)' : 'var(--tl-fg-2)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {gamePlayersB || teamBName}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Completed state */}
          {isMatchCompleted && (
            <div
              style={{
                ...surfaceCard,
                background: 'var(--tl-green-glow)',
                borderColor: 'var(--tl-green-dim)',
                padding: '24px 16px',
                textAlign: 'center',
              }}
            >
              <Trophy
                className="w-10 h-10 mx-auto mb-2"
                style={{ color: 'var(--tl-green)' }}
              />
              <div style={{ ...sectionTitle, color: 'var(--tl-fg)' }}>
                {txt.completedTitle}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: 'var(--tl-fg-2)' }}>
                {txt.completedWinner(
                  match.winner_team_id === match.team_a_id ? teamAName : teamBName,
                )}
              </div>
            </div>
          )}
        </div>
      </SheetContent>

      {/* Reset Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{txt.resetDialogTitle}</AlertDialogTitle>
            <AlertDialogDescription>{txt.resetDialogDesc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{txt.cancelBtn}</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>{txt.resetConfirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Save Dialog */}
      <AlertDialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{txt.saveDialogTitle(selectedGameIndex + 1)}</AlertDialogTitle>
            <AlertDialogDescription>
              {txt.saveDialogResultLabel}: {playersA || teamAName} {localScoreA} - {localScoreB} {playersB || teamBName}
              {localScoreA !== localScoreB && (
                <>
                  <br />
                  {txt.saveDialogWonGame(
                    localScoreA > localScoreB ? (playersA || teamAName) : (playersB || teamBName),
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{txt.cancelBtn}</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveGame}>{txt.confirmBtn}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
