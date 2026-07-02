import { Skeleton } from '@/components/ui/skeleton';
import { Gamepad2, Trophy, Clock, Play, ClipboardList, Check, AlertTriangle, Radio } from 'lucide-react';
import { useTeamMatchMatches, TeamMatchMatch } from '@/hooks/useTeamMatchMatches';
import { useI18n } from '@/i18n';

interface MatchListProps {
  tournamentId: string;
  userTeamId?: string;
  isOwner?: boolean;
  canEditScores?: boolean;
  /** Total-score format → show cumulative points (not games won) as the score. */
  isTotalScore?: boolean;
  onMatchClick?: (match: TeamMatchMatch) => void;
  onLineupClick?: (match: TeamMatchMatch, teamId?: string) => void;
  onStartRound?: (roundNumber: number) => void;
  onScoreMatch?: (match: TeamMatchMatch) => void;
}

// ─── W2.4a shared tokens ─────────────────────────────────────────────────
const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
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

function onRowEnter(e: React.MouseEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.background = 'var(--tl-bg)';
}
function onRowLeave(e: React.MouseEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.background = 'transparent';
}

type StatusKind = 'pending' | 'lineup' | 'in_progress' | 'completed';

function statusPillStyle(kind: StatusKind): React.CSSProperties {
  if (kind === 'completed') return { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' };
  if (kind === 'in_progress') return { background: 'rgba(255, 65, 54, 0.10)', color: 'var(--tl-live)' };
  if (kind === 'lineup') return { background: 'rgba(120, 165, 255, 0.10)', color: 'var(--tl-fg-2)' };
  return { background: 'var(--tl-surface)', color: 'var(--tl-fg-3)' };
}

export function MatchList({ tournamentId, userTeamId, isOwner, canEditScores, isTotalScore, onMatchClick, onLineupClick, onStartRound, onScoreMatch }: MatchListProps) {
  const { data: matches, isLoading } = useTeamMatchMatches(tournamentId);
  const { t, language } = useI18n();
  const c = t.teamMatchComponents;

  const txt = {
    notStarted: c.notStarted,
    lineup: c.liningUp,
    live: c.live,
    ended: c.ended,
    roundLabel: language === 'vi' ? `Vòng` : c.roundLabel,
    startRound: (n: number) => language === 'vi' ? `Bắt đầu vòng ${n}` : `Start round ${n}`,
    waitingLineup: c.waitingLineup,
    missingLineup: c.missingLineup,
    lineupBtn: language === 'vi' ? 'Line up' : 'Lineup',
    lineupDone: c.lineupDone,
    scoreBtn: c.scoreBtn,
    details: language === 'vi' ? 'Chi tiết' : 'Details',
    points: language === 'vi' ? 'Điểm' : 'Points',
    noMatchesTitle: language === 'vi' ? 'Chưa có trận đấu nào' : 'No matches yet',
    noMatchesHint: language === 'vi' ? 'Tạo lịch thi đấu để bắt đầu' : 'Create a schedule to begin',
  };

  const STATUS_CONFIG: Record<StatusKind, { label: string; kind: StatusKind; icon: typeof Clock }> = {
    pending: { label: txt.notStarted, kind: 'pending', icon: Clock },
    lineup: { label: txt.lineup, kind: 'lineup', icon: ClipboardList },
    in_progress: { label: txt.live, kind: 'in_progress', icon: Radio },
    completed: { label: txt.ended, kind: 'completed', icon: Trophy },
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div style={{ ...surfaceCard, padding: 32 }}>
        <div className="tl-empty-card" style={{ margin: 0, padding: '24px 16px' }}>
          <span className="tl-empty-card-mark">
            <Gamepad2 className="h-6 w-6" />
          </span>
          <span className="tl-empty-card-label">{txt.noMatchesTitle}</span>
          <span className="tl-empty-card-hint">{txt.noMatchesHint}</span>
        </div>
      </div>
    );
  }

  // Group matches by round - filter out playoff matches (they have round_number 0 or null and is_playoff = true)
  const roundRobinMatches = matches.filter(m => !m.is_playoff);

  const matchesByRound = roundRobinMatches.reduce((acc, match) => {
    const round = match.round_number || 0;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {} as Record<number, TeamMatchMatch[]>);

  // Filter out round 0 (should not exist for round robin)
  const rounds = Object.keys(matchesByRound).map(Number).filter(r => r > 0).sort((a, b) => a - b);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {rounds.map((round) => {
        const roundMatches = matchesByRound[round];

        // Check if all teams in this round have submitted lineups
        const allLineupsSubmitted = roundMatches.every(match =>
          match.lineup_a_submitted && match.lineup_b_submitted
        );

        // Check if any match in round is started
        const roundStarted = roundMatches.some(match =>
          match.status === 'in_progress' || match.status === 'completed'
        );

        // Find teams missing lineup
        const missingLineups: string[] = [];
        roundMatches.forEach(match => {
          if (!match.lineup_a_submitted && match.team_a) {
            missingLineups.push(match.team_a?.team_name || 'Team A');
          }
          if (!match.lineup_b_submitted && match.team_b) {
            missingLineups.push(match.team_b?.team_name || 'Team B');
          }
        });

        return (
          <div key={round}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 12,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <h3 style={{ ...fieldLabel, fontSize: 12 }}>{txt.roundLabel} {round}</h3>

              {/* BTC Start Round Button */}
              {isOwner && !roundStarted && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {allLineupsSubmitted ? (
                    <button
                      type="button"
                      className="tl-btn green"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => onStartRound?.(round)}
                    >
                      <Play className="h-3.5 w-3.5" />
                      {txt.startRound(round)}
                    </button>
                  ) : (
                    <span style={{ ...statusPillBase, background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)' }}>
                      <Clock className="h-3 w-3" />
                      {txt.waitingLineup}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Warning for BTC if lineups missing */}
            {isOwner && !roundStarted && missingLineups.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginBottom: 12,
                  padding: '10px 12px',
                  borderRadius: 'var(--tl-radius)',
                  background: 'rgba(233, 182, 73, 0.08)',
                  border: '1px solid rgba(233, 182, 73, 0.35)',
                  color: 'var(--tl-fg-2)',
                  fontSize: 12.5,
                }}
              >
                <AlertTriangle className="h-4 w-4 mt-0.5" style={{ color: 'var(--tl-gold)' }} />
                <span>
                  {txt.missingLineup} {missingLineups.join(', ')}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {roundMatches.map((match) => {
                const config = STATUS_CONFIG[match.status as StatusKind] || STATUS_CONFIG.pending;
                const StatusIcon = config.icon;
                const isMyMatch = userTeamId && (match.team_a_id === userTeamId || match.team_b_id === userTeamId);
                const isLive = match.status === 'in_progress';

                // Determine if captain needs to lineup
                const isTeamA = match.team_a_id === userTeamId;
                const myLineupSubmitted = isMyMatch && (isTeamA ? match.lineup_a_submitted : match.lineup_b_submitted);
                const needsLineup = isMyMatch && !myLineupSubmitted && match.status !== 'completed' && !roundStarted;

                // BTC can lineup for either team if not yet submitted
                const canBTCLineupA = isOwner && !match.lineup_a_submitted && match.status !== 'completed';
                const canBTCLineupB = isOwner && !match.lineup_b_submitted && match.status !== 'completed';

                const winnerA = match.winner_team_id === match.team_a_id;
                const winnerB = match.winner_team_id === match.team_b_id;
                const teamAColor = winnerA ? 'var(--tl-fg)' : (match.status === 'completed' ? 'var(--tl-fg-3)' : 'var(--tl-fg)');
                const teamBColor = winnerB ? 'var(--tl-fg)' : (match.status === 'completed' ? 'var(--tl-fg-3)' : 'var(--tl-fg)');

                const cardRingShadow = isLive
                  ? '0 0 0 1px var(--tl-green), 0 0 12px var(--tl-green-glow)'
                  : isMyMatch
                    ? '0 0 0 1px var(--tl-green-dim)'
                    : 'none';

                return (
                  <div
                    key={match.id}
                    onClick={() => onMatchClick?.(match)}
                    style={{
                      ...surfaceCard,
                      padding: 14,
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                      boxShadow: cardRingShadow,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 240 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                          {/* Team A */}
                          <div
                            style={{
                              flex: 1,
                              textAlign: 'right',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontFamily: 'Instrument Serif, serif',
                              fontStyle: 'italic',
                              fontWeight: winnerA ? 600 : 400,
                              fontSize: 17,
                              letterSpacing: '-0.01em',
                              color: teamAColor,
                            }}
                          >
                            <span>{match.team_a?.team_name || 'TBD'}</span>
                            {match.lineup_a_submitted && (
                              <Check className="h-3 w-3 inline-block ml-1" style={{ color: 'var(--tl-green)' }} />
                            )}
                          </div>

                          {/* Score */}
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 14px',
                              borderRadius: 8,
                              background: 'var(--tl-surface)',
                              border: '1px solid var(--tl-border)',
                              minWidth: 96,
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 19,
                                fontWeight: 600,
                                fontFamily: 'Geist Mono, ui-monospace, monospace',
                                fontVariantNumeric: 'tabular-nums',
                                color: winnerA ? 'var(--tl-green)' : 'var(--tl-fg)',
                              }}
                            >
                              {isTotalScore ? match.total_points_a : match.games_won_a}
                            </span>
                            <span style={{ color: 'var(--tl-fg-4)', fontFamily: 'Geist Mono, ui-monospace, monospace' }}>:</span>
                            <span
                              style={{
                                fontSize: 19,
                                fontWeight: 600,
                                fontFamily: 'Geist Mono, ui-monospace, monospace',
                                fontVariantNumeric: 'tabular-nums',
                                color: winnerB ? 'var(--tl-green)' : 'var(--tl-fg)',
                              }}
                            >
                              {isTotalScore ? match.total_points_b : match.games_won_b}
                            </span>
                          </div>

                          {/* Team B */}
                          <div
                            style={{
                              flex: 1,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              fontFamily: 'Instrument Serif, serif',
                              fontStyle: 'italic',
                              fontWeight: winnerB ? 600 : 400,
                              fontSize: 17,
                              letterSpacing: '-0.01em',
                              color: teamBColor,
                            }}
                          >
                            {match.lineup_b_submitted && (
                              <Check className="h-3 w-3 inline-block mr-1" style={{ color: 'var(--tl-green)' }} />
                            )}
                            <span>{match.team_b?.team_name || 'TBD'}</span>
                          </div>
                        </div>

                        {/* Points info */}
                        {match.status !== 'pending' && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 12,
                              marginTop: 8,
                              fontFamily: 'Geist Mono, ui-monospace, monospace',
                              fontVariantNumeric: 'tabular-nums',
                              fontSize: 11.5,
                              color: 'var(--tl-fg-3)',
                              letterSpacing: '0.02em',
                            }}
                          >
                            <span>
                              {isTotalScore
                                ? `${language === 'vi' ? 'Ván' : 'Games'}: ${match.games_won_a} - ${match.games_won_b}`
                                : `${txt.points}: ${match.total_points_a} - ${match.total_points_b}`}
                            </span>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
                        <span
                          style={{
                            ...statusPillBase,
                            ...statusPillStyle(config.kind),
                            ...(isLive ? { animation: 'tl-pulse 1.6s ease-in-out infinite' } : {}),
                          }}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {config.label}
                        </span>

                        {/* Captain's own lineup button */}
                        {needsLineup && (
                          <button
                            type="button"
                            className="tl-btn green"
                            style={{ padding: '6px 10px', fontSize: 11.5 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onLineupClick?.(match, userTeamId);
                            }}
                          >
                            <ClipboardList className="h-3 w-3" />
                            {txt.lineupBtn}
                          </button>
                        )}

                        {/* Captain's lineup done badge */}
                        {!needsLineup && myLineupSubmitted && !roundStarted && (
                          <span
                            style={{
                              ...statusPillBase,
                              ...statusPillStyle('completed'),
                            }}
                          >
                            <Check className="h-3 w-3" />
                            {txt.lineupDone}
                          </span>
                        )}

                        {/* BTC lineup buttons for both teams */}
                        {isOwner && !isMyMatch && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            {canBTCLineupA && match.team_a_id && (
                              <button
                                type="button"
                                className="tl-btn"
                                style={{ padding: '5px 9px', fontSize: 11 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onLineupClick?.(match, match.team_a_id!);
                                }}
                              >
                                <ClipboardList className="h-3 w-3" />
                                A
                              </button>
                            )}
                            {canBTCLineupB && match.team_b_id && (
                              <button
                                type="button"
                                className="tl-btn"
                                style={{ padding: '5px 9px', fontSize: 11 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onLineupClick?.(match, match.team_b_id!);
                                }}
                              >
                                <ClipboardList className="h-3 w-3" />
                                B
                              </button>
                            )}
                          </div>
                        )}

                        {/* Referee Score Button - show when both lineups ready OR match started */}
                        {canEditScores && (
                          (match.lineup_a_submitted && match.lineup_b_submitted) ||
                          match.status === 'in_progress' ||
                          match.status === 'completed'
                        ) && (
                          <button
                            type="button"
                            className="tl-btn green"
                            style={{ padding: '6px 10px', fontSize: 11.5 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onScoreMatch?.(match);
                            }}
                          >
                            <Play className="h-3 w-3" />
                            {txt.scoreBtn}
                          </button>
                        )}

                        {/* Show detail button */}
                        {!needsLineup && !myLineupSubmitted && !canEditScores && (!isOwner || (!canBTCLineupA && !canBTCLineupB)) && (
                          <button
                            type="button"
                            className="tl-btn"
                            style={{ padding: '5px 10px', fontSize: 11.5 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onMatchClick?.(match);
                            }}
                          >
                            {txt.details}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
