import { useState, useEffect, useMemo } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Save, Trophy, Play } from 'lucide-react';
import { useTeamMatchMatch, useTeamMatchMatchManagement, TeamMatchMatch } from '@/hooks/useTeamMatchMatches';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useI18n } from '@/i18n';

interface MatchDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: TeamMatchMatch | null;
  isOwner?: boolean;
  tournamentId: string;
  onScoreMatch?: (match: TeamMatchMatch) => void;
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
  fontSize: 19,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
};

const scoreNumStyle: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontVariantNumeric: 'tabular-nums',
  fontWeight: 700,
  fontSize: 32,
  color: 'var(--tl-fg)',
};

export function MatchDetailSheet({
  open,
  onOpenChange,
  match,
  isOwner,
  tournamentId,
  onScoreMatch,
}: MatchDetailSheetProps) {
  const { games, isLoading } = useTeamMatchMatch(match?.id);
  const { updateGameScore, updateMatchResult, isUpdatingScore, isUpdatingResult } = useTeamMatchMatchManagement();
  const { language } = useI18n();

  const [scores, setScores] = useState<Record<string, { a: number; b: number }>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const GAME_TYPE_LABELS: Record<string, string> = useMemo(() => (
    language === 'vi'
      ? { WD: 'Đôi Nữ', MD: 'Đôi Nam', MX: 'Nam Nữ', WS: 'Đơn', MS: 'Đơn' }
      : { WD: 'WD', MD: 'MD', MX: 'Mixed', WS: 'WS', MS: 'MS' }
  ), [language]);

  const txt = {
    title: language === 'vi' ? 'Chi tiết trận đấu' : 'Match detail',
    roundLabel: (n: number | null | undefined) =>
      language === 'vi' ? `Vòng ${n ?? ''}`.trim() : `Round ${n ?? ''}`.trim(),
    tbd: 'TBD',
    winner: language === 'vi' ? 'Thắng' : 'Winner',
    pointsSuffix: language === 'vi' ? 'điểm' : 'pts',
    scoreMatchBtn: language === 'vi' ? 'Chấm điểm trận đấu' : 'Score match',
    gamesTitle: language === 'vi' ? 'Các ván đấu' : 'Games',
    noGames: language === 'vi' ? 'Chưa có ván đấu nào' : 'No games yet',
    gameNum: (n: number) => language === 'vi' ? `Ván ${n}` : `Game ${n}`,
    saveScores: language === 'vi' ? 'Lưu điểm số' : 'Save scores',
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

  // Initialize scores from games
  useEffect(() => {
    if (games.length > 0) {
      const initialScores: Record<string, { a: number; b: number }> = {};
      games.forEach(game => {
        initialScores[game.id] = { a: game.score_a, b: game.score_b };
      });
      setScores(initialScores);
      setHasChanges(false);
    }
  }, [games]);

  const handleScoreChange = (gameId: string, side: 'a' | 'b', value: string) => {
    const numValue = parseInt(value) || 0;
    setScores(prev => ({
      ...prev,
      [gameId]: { ...prev[gameId], [side]: Math.max(0, numValue) }
    }));
    setHasChanges(true);
  };

  const handleSaveScores = async () => {
    if (!match) return;

    try {
      // Update each game score
      for (const game of games) {
        const score = scores[game.id];
        if (score && (score.a !== game.score_a || score.b !== game.score_b)) {
          await updateGameScore({
            gameId: game.id,
            scoreA: score.a,
            scoreB: score.b,
            matchId: match.id,
          });
        }
      }

      // Calculate match totals
      let gamesWonA = 0;
      let gamesWonB = 0;
      let totalPointsA = 0;
      let totalPointsB = 0;

      Object.entries(scores).forEach(([_, score]) => {
        totalPointsA += score.a;
        totalPointsB += score.b;
        if (score.a > score.b) gamesWonA++;
        else if (score.b > score.a) gamesWonB++;
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

      setHasChanges(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  if (!match) return null;

  const teamAName = (match.team_a as any)?.team_name || txt.tbd;
  const teamBName = (match.team_b as any)?.team_name || txt.tbd;

  // Ready to start = both lineups submitted
  const hasBothTeams = match.team_a_id && match.team_b_id;
  const isReadyToStart = hasBothTeams && match.lineup_a_submitted && match.lineup_b_submitted;
  const canScore = isOwner && (isReadyToStart || match.status === 'in_progress' || match.status === 'completed');

  const winnerA = match.winner_team_id === match.team_a_id;
  const winnerB = match.winner_team_id === match.team_b_id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              ...sectionTitle,
              fontSize: 20,
            }}
          >
            <Trophy className="h-5 w-5" style={{ color: 'var(--tl-fg-2)' }} />
            {txt.title}
          </SheetTitle>
          <SheetDescription style={{ ...fieldLabel, marginTop: 4 }}>
            {txt.roundLabel(match.round_number)}
          </SheetDescription>
        </SheetHeader>

        <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 18 }}>
          {/* Match Header */}
          <div style={{ ...surfaceCard, padding: 16 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
              }}
            >
              <div style={{ flex: 1, textAlign: 'center' }}>
                <p
                  style={{
                    ...teamNameStyle,
                    fontWeight: winnerA ? 600 : 400,
                    color: winnerA ? 'var(--tl-green)' : 'var(--tl-fg)',
                    margin: 0,
                  }}
                >
                  {teamAName}
                </p>
                {winnerA && (
                  <span
                    style={{
                      ...statusPillBase,
                      background: 'var(--tl-green-glow)',
                      color: 'var(--tl-green)',
                      marginTop: 6,
                    }}
                  >
                    {txt.winner}
                  </span>
                )}
              </div>

              <div style={{ textAlign: 'center', minWidth: 80 }}>
                <div style={scoreNumStyle}>
                  {match.games_won_a} - {match.games_won_b}
                </div>
                <p
                  style={{
                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                    fontSize: 11,
                    color: 'var(--tl-fg-3)',
                    marginTop: 4,
                    letterSpacing: '0.04em',
                  }}
                >
                  ({match.total_points_a} - {match.total_points_b} {txt.pointsSuffix})
                </p>
              </div>

              <div style={{ flex: 1, textAlign: 'center' }}>
                <p
                  style={{
                    ...teamNameStyle,
                    fontWeight: winnerB ? 600 : 400,
                    color: winnerB ? 'var(--tl-green)' : 'var(--tl-fg)',
                    margin: 0,
                  }}
                >
                  {teamBName}
                </p>
                {winnerB && (
                  <span
                    style={{
                      ...statusPillBase,
                      background: 'var(--tl-green-glow)',
                      color: 'var(--tl-green)',
                      marginTop: 6,
                    }}
                  >
                    {txt.winner}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Score Button */}
          {canScore && onScoreMatch && (
            <button
              type="button"
              className="tl-btn green"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 14px' }}
              onClick={() => onScoreMatch(match)}
            >
              <Play className="h-4 w-4" />
              {txt.scoreMatchBtn}
            </button>
          )}

          {/* Games List */}
          <div>
            <h4 style={{ ...sectionTitle, fontSize: 17, marginBottom: 12 }}>{txt.gamesTitle}</h4>

            {isLoading ? (
              <div style={{ ...surfaceCard, padding: 16 }}>
                <Skeleton className="h-20 w-full" />
              </div>
            ) : games.length === 0 ? (
              <p
                style={{
                  textAlign: 'center',
                  color: 'var(--tl-fg-3)',
                  fontSize: 13,
                  padding: '16px 0',
                }}
              >
                {txt.noGames}
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {games.map((game, index) => {
                  const score = scores[game.id] || { a: 0, b: 0 };
                  const gameWinner = score.a > score.b ? 'a' : score.b > score.a ? 'b' : null;

                  const lineupA = game.lineup_team_a || [];
                  const lineupB = game.lineup_team_b || [];

                  return (
                    <div key={game.id} style={{ ...surfaceCard, padding: 12 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          marginBottom: 10,
                        }}
                      >
                        <span style={fieldLabel}>{txt.gameNum(index + 1)}</span>
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

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <div
                          style={{
                            flex: 1,
                            textAlign: 'right',
                            fontSize: 13,
                            fontWeight: gameWinner === 'a' ? 600 : 400,
                            color: gameWinner === 'a' ? 'var(--tl-green)' : 'var(--tl-fg-2)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {lineupA.length > 0
                            ? lineupA.map(id => rosterMap?.[id] || id).join(', ')
                            : teamAName}
                        </div>

                        {isOwner ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Input
                              type="number"
                              min="0"
                              name={`score-${game.id}-a`}
                              value={score.a}
                              onChange={(e) => handleScoreChange(game.id, 'a', e.target.value)}
                              className="w-16 text-center"
                              style={{
                                background: 'var(--tl-surface)',
                                border: '1px solid var(--tl-border)',
                                color: 'var(--tl-fg)',
                                fontFamily: 'Geist Mono, ui-monospace, monospace',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            />
                            <span style={{ color: 'var(--tl-fg-3)' }}>-</span>
                            <Input
                              type="number"
                              min="0"
                              name={`score-${game.id}-b`}
                              value={score.b}
                              onChange={(e) => handleScoreChange(game.id, 'b', e.target.value)}
                              className="w-16 text-center"
                              style={{
                                background: 'var(--tl-surface)',
                                border: '1px solid var(--tl-border)',
                                color: 'var(--tl-fg)',
                                fontFamily: 'Geist Mono, ui-monospace, monospace',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            />
                          </div>
                        ) : (
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
                                fontWeight: 600,
                                color: gameWinner === 'a' ? 'var(--tl-green)' : 'var(--tl-fg)',
                              }}
                            >
                              {score.a}
                            </span>
                            <span style={{ color: 'var(--tl-fg-4)' }}>-</span>
                            <span
                              style={{
                                fontFamily: 'Geist Mono, ui-monospace, monospace',
                                fontVariantNumeric: 'tabular-nums',
                                fontSize: 17,
                                fontWeight: 600,
                                color: gameWinner === 'b' ? 'var(--tl-green)' : 'var(--tl-fg)',
                              }}
                            >
                              {score.b}
                            </span>
                          </div>
                        )}

                        <div
                          style={{
                            flex: 1,
                            textAlign: 'left',
                            fontSize: 13,
                            fontWeight: gameWinner === 'b' ? 600 : 400,
                            color: gameWinner === 'b' ? 'var(--tl-green)' : 'var(--tl-fg-2)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {lineupB.length > 0
                            ? lineupB.map(id => rosterMap?.[id] || id).join(', ')
                            : teamBName}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Save Button */}
          {isOwner && hasChanges && (
            <button
              type="button"
              className="tl-btn green"
              style={{ width: '100%', justifyContent: 'center', padding: '10px 14px' }}
              onClick={handleSaveScores}
              disabled={isUpdatingScore || isUpdatingResult}
            >
              {(isUpdatingScore || isUpdatingResult) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              {txt.saveScores}
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
