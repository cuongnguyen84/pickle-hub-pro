import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Crown, Trophy, Radio, Play, Pencil, Check, X, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Match, Team, useDoublesElimination } from '@/hooks/useDoublesElimination';
import { supabase } from '@/integrations/supabase/client';
import type { TablesUpdate } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useI18n } from '@/i18n';

// ─── Shared TheLineLayout tokens ─────────────────────────────────────────
// Match the W2.1 pattern from src/components/quicktable/RegistrationManager.tsx
// and src/components/quicktable/TeamManager.tsx. No raw hex, no Tailwind
// palette — every visual decision flows through CSS variables from
// the-line.css.

const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

const matchCardStyle: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius)',
  overflow: 'hidden',
  transition: 'border-color 0.15s, box-shadow 0.15s',
};

const teamNameStyle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 17,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  lineHeight: 1.15,
};

const monoKicker: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-2)',
};

const monoMicro: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-3)',
};

const scoreCellBase: React.CSSProperties = {
  width: 38,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: 6,
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 14,
  fontWeight: 600,
  fontVariantNumeric: 'tabular-nums',
  background: 'var(--tl-surface)',
  color: 'var(--tl-fg-2)',
  flexShrink: 0,
};

const scoreCellWinner: React.CSSProperties = {
  ...scoreCellBase,
  background: 'var(--tl-green)',
  color: 'var(--tl-bg)',
};

const pillBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10,
  fontWeight: 500,
  padding: '2px 7px',
  borderRadius: 4,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

const livePillStyle: React.CSSProperties = {
  ...pillBase,
  background: 'rgba(255, 65, 54, 0.12)',
  color: 'var(--tl-live)',
};

const donePillStyle: React.CSSProperties = {
  ...pillBase,
  background: 'var(--tl-surface)',
  color: 'var(--tl-fg-3)',
};

const finalPillStyle: React.CSSProperties = {
  ...pillBase,
  background: 'var(--tl-green-glow)',
  color: 'var(--tl-green)',
  border: '1px solid rgba(0, 185, 107, 0.30)',
};

const formatPillStyle: React.CSSProperties = {
  ...pillBase,
  background: 'var(--tl-surface)',
  color: 'var(--tl-fg-2)',
  border: '1px solid var(--tl-border)',
};

const thirdPlacePillStyle: React.CSSProperties = {
  ...pillBase,
  background: 'rgba(233, 182, 73, 0.12)',
  color: 'var(--tl-gold)',
  border: '1px solid rgba(233, 182, 73, 0.30)',
};

// Inline button — small, tokenized. Matches `.tl-btn` look but rendered
// inline because the canonical class targets `[data-theme="the-line"]`
// only and we want the bracket buttons sized down for dense rows.
const inlineBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  padding: '5px 10px',
  borderRadius: 6,
  border: '1px solid var(--tl-border)',
  background: 'transparent',
  color: 'var(--tl-fg)',
  cursor: 'pointer',
  transition: 'background 0.15s, border-color 0.15s',
};

const inlineBtnPrimaryStyle: React.CSSProperties = {
  ...inlineBtnStyle,
  background: 'var(--tl-green)',
  color: 'var(--tl-bg)',
  borderColor: 'var(--tl-green)',
  fontWeight: 600,
};

const inlineBtnGhostStyle: React.CSSProperties = {
  ...inlineBtnStyle,
  border: '1px solid transparent',
  color: 'var(--tl-fg-2)',
};

interface DoublesEliminationBracketProps {
  matches: Match[];
  teams: Team[];
  tournamentId?: string;
  onMatchClick?: (matchId: string) => void;
  showPreliminaryOnly?: boolean;
  showPlayoffOnly?: boolean;
  canEdit?: boolean;
  onScoreUpdated?: () => void;
  // Callback for optimistic updates - passes updated match data
  onMatchUpdated?: (matchId: string, updates: Partial<Match>) => void;
  // Callback for R3 assignment notification
  onR3Assigned?: (tiedTeamsInfo?: { count: number; names: string[] }) => void;
}

const DoublesEliminationBracket = ({
  matches,
  teams,
  tournamentId,
  onMatchClick,
  showPreliminaryOnly = false,
  showPlayoffOnly = false,
  canEdit = false,
  onScoreUpdated,
  onMatchUpdated,
  onR3Assigned,
}: DoublesEliminationBracketProps) => {
  const { checkAndAssignR3, checkAndGeneratePlayoff } = useDoublesElimination();
  const { toast } = useToast();
  const { t } = useI18n();
  const b = t.doublesElimination.bracket;
  const [isAssigningR3, setIsAssigningR3] = useState(false);
  const [isGeneratingPlayoff, setIsGeneratingPlayoff] = useState(false);

  // Track if we've already triggered generation in this session to prevent duplicate calls
  const hasTriggeredR3Ref = React.useRef(false);
  const hasTriggeredPlayoffRef = React.useRef(false);

  // Reset refs when matches change significantly (e.g., after reload)
  const matchStatusKey = React.useMemo(() => {
    return matches.map(m => `${m.id}:${m.status}`).join(',');
  }, [matches]);

  const getTeam = (id: string | null): Team | undefined =>
    id ? teams.find(t => t.id === id) : undefined;

  const formatTeamName = (team: Team | undefined): string => {
    if (!team) return 'TBD';
    // Display seed next to name ONLY if seed exists and is not null
    if (team.seed !== null && team.seed !== undefined) {
      return `${team.team_name} (${team.seed})`;
    }
    return team.team_name;
  };

  const { rounds, champion, loserMatches, r1Completed, r2Completed, r3NeedsAssignment, r3Completed, playoffNeedsGeneration } = useMemo(() => {
    if (matches.length === 0) return {
      rounds: [],
      champion: null,
      loserMatches: [],
      r1Completed: false,
      r2Completed: false,
      r3NeedsAssignment: false,
      r3Completed: false,
      playoffNeedsGeneration: false,
    };

    const r1Matches = matches.filter(m => m.round_number === 1 && m.bracket_type === 'winner');
    const r2LoserMatches = matches.filter(m => m.round_number === 2 && m.bracket_type === 'loser');
    const r3Matches = matches.filter(m => m.round_number === 3);
    const playoffMatches = matches.filter(m => m.round_number >= 4);

    const r1CompletedCheck = r1Matches.length > 0 && r1Matches.every(m => m.status === 'completed');
    const r2CompletedCheck = r2LoserMatches.length > 0 && r2LoserMatches.every(m => m.status === 'completed');
    const r3NeedsAssignmentCheck = r3Matches.length > 0 && r3Matches.some(m => !m.team_a_id || !m.team_b_id);
    const r3CompletedCheck = r3Matches.length > 0 && r3Matches.every(m => m.status === 'completed');
    const playoffNeedsGenerationCheck = r3CompletedCheck && playoffMatches.length === 0;

    const mainBracketMatches = matches.filter(m =>
      (m.round_number >= 3 && (m.bracket_type === 'merged' || m.bracket_type === 'single')) ||
      m.round_type === 'final'
    ).filter(m => m.round_type !== 'third_place');

    const roundMap = new Map<number, Match[]>();

    if (r1Matches.length > 0) {
      roundMap.set(1, r1Matches.sort((a, b) => a.match_number - b.match_number));
    }

    mainBracketMatches.forEach(match => {
      const round = match.round_number;
      if (!roundMap.has(round)) {
        roundMap.set(round, []);
      }
      roundMap.get(round)!.push(match);
    });

    roundMap.forEach((roundMatches) => {
      roundMatches.sort((a, b) => a.match_number - b.match_number);
    });

    const roundNumbers = Array.from(roundMap.keys()).sort((a, b) => a - b);
    const roundsArray = roundNumbers.map(roundNum => {
      const roundMatches = roundMap.get(roundNum) || [];
      return {
        roundNumber: roundNum,
        matches: roundMatches,
        roundType: roundMatches[0]?.round_type || 'elimination',
      };
    });

    const finalMatch = matches.find(m => m.round_type === 'final');
    const champion = finalMatch?.winner_id ? getTeam(finalMatch.winner_id) : null;

    return {
      rounds: roundsArray,
      champion,
      loserMatches: r2LoserMatches.sort((a, b) => a.match_number - b.match_number),
      r1Completed: r1CompletedCheck,
      r2Completed: r2CompletedCheck,
      r3NeedsAssignment: r3NeedsAssignmentCheck,
      r3Completed: r3CompletedCheck,
      playoffNeedsGeneration: playoffNeedsGenerationCheck,
    };
  }, [matches, teams]);

  // Reset trigger flags when match statuses change (after reload)
  React.useEffect(() => {
    hasTriggeredR3Ref.current = false;
    hasTriggeredPlayoffRef.current = false;
  }, [matchStatusKey]);

  // Auto-trigger R3 assignment when R1+R2 are completed but R3 has no teams
  useEffect(() => {
    const autoAssign = async () => {
      if (r1Completed && r2Completed && r3NeedsAssignment && tournamentId && !isAssigningR3 && !hasTriggeredR3Ref.current) {
        hasTriggeredR3Ref.current = true;
        setIsAssigningR3(true);
        const result = await checkAndAssignR3(tournamentId);
        if (result.triggered) {
          onR3Assigned?.(result.tiedTeamsInfo);
          onScoreUpdated?.(); // Reload to show assignments
        }
        setIsAssigningR3(false);
      }
    };
    autoAssign();
  }, [r1Completed, r2Completed, r3NeedsAssignment, tournamentId, matchStatusKey]);

  // Auto-generate playoff bracket when R3 is completed
  useEffect(() => {
    const autoGeneratePlayoff = async () => {
      if (r3Completed && playoffNeedsGeneration && tournamentId && !isGeneratingPlayoff && !hasTriggeredPlayoffRef.current) {
        hasTriggeredPlayoffRef.current = true;
        setIsGeneratingPlayoff(true);
        const result = await checkAndGeneratePlayoff(tournamentId);
        if (result.generated) {
          toast({
            title: b.playoffCreated,
            description: b.playoffCreatedDesc,
          });
          onScoreUpdated?.(); // Reload to show new playoff matches
        }
        setIsGeneratingPlayoff(false);
      }
    };
    autoGeneratePlayoff();
  }, [r3Completed, playoffNeedsGeneration, tournamentId, matchStatusKey]);

  // Manual trigger for R3 assignment
  const handleManualR3Assignment = async () => {
    if (!tournamentId) return;
    setIsAssigningR3(true);
    const result = await checkAndAssignR3(tournamentId);
    if (result.triggered) {
      toast({ title: b.r3Assigned, description: b.r3AssignedDesc });
      onR3Assigned?.(result.tiedTeamsInfo);
      onScoreUpdated?.();
    } else if (result.error === 'NOT_ALL_MATCHES_COMPLETED') {
      toast({ title: b.waitingR1R2, description: b.waitingR1R2, variant: 'destructive' });
    }
    setIsAssigningR3(false);
  };

  const getRoundLabel = (roundType: string, matchCount: number): string => {
    switch (roundType) {
      case 'winner_r1': return `${b.round} 1 (Winner)`;
      case 'merge_r3': return `${b.round} 3 (Merge)`;
      case 'quarterfinal': return b.quarterFinal;
      case 'semifinal': return b.semiFinal;
      case 'final': return b.finals;
      case 'elimination':
        if (matchCount === 1) return b.finals;
        if (matchCount === 2) return b.semiFinal;
        if (matchCount <= 4) return b.quarterFinal;
        if (matchCount <= 8) return b.round16;
        return `${b.round} ${matchCount * 2}`;
      default: return `${b.round} ${roundType}`;
    }
  };

  // ─── Empty bracket ────────────────────────────────────────────────────
  if (matches.length === 0) {
    return (
      <div className="tl-empty-card">
        <div className="tl-empty-card-mark">◌</div>
        <div className="tl-empty-card-label">{b.noBracket}</div>
      </div>
    );
  }

  const playoffRounds = rounds.filter(r => r.roundNumber >= 4);
  const r3Rounds = rounds.filter(r => r.roundNumber === 3);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* ─── Champion banner ────────────────────────────────────────────── */}
      {!showPreliminaryOnly && champion && (
        <div
          style={{
            ...surfaceCard,
            background:
              'linear-gradient(180deg, var(--tl-green-glow) 0%, transparent 100%)',
            border: '1px solid rgba(0, 185, 107, 0.35)',
            padding: '22px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
          }}
        >
          <Trophy
            className="w-8 h-8"
            style={{ color: 'var(--tl-green)' }}
            aria-hidden
          />
          <div style={{ textAlign: 'center' }}>
            <div style={{ ...monoKicker, color: 'var(--tl-green)', marginBottom: 6 }}>
              {b.champion}
            </div>
            <div
              style={{
                fontFamily: 'Instrument Serif, serif',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 30,
                letterSpacing: '-0.02em',
                color: 'var(--tl-fg)',
                lineHeight: 1.1,
              }}
            >
              {formatTeamName(champion)}
            </div>
          </div>
          <Trophy
            className="w-8 h-8"
            style={{ color: 'var(--tl-green)' }}
            aria-hidden
          />
        </div>
      )}

      {/* ─── PRELIMINARY VIEW ───────────────────────────────────────────── */}
      {!showPlayoffOnly && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Progress strip — V1 / V2 / V3 dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 2px' }}>
            <ProgressDot label="V1" active={r1Completed} tone="green" />
            <div
              style={{
                width: 24,
                height: 1,
                background: 'var(--tl-border)',
                flexShrink: 0,
              }}
            />
            <ProgressDot label="V2" active={r2Completed} tone="gold" />
            <div
              style={{
                width: 24,
                height: 1,
                background: 'var(--tl-border)',
                flexShrink: 0,
              }}
            />
            <ProgressDot
              label="V3"
              active={!r3NeedsAssignment && r1Completed && r2Completed}
              tone="green"
            />

            {/* Manual R3 assignment button */}
            {canEdit && r1Completed && r2Completed && r3NeedsAssignment && (
              <button
                type="button"
                name="assign-r3"
                onClick={handleManualR3Assignment}
                disabled={isAssigningR3}
                style={{
                  ...inlineBtnStyle,
                  marginLeft: 'auto',
                  opacity: isAssigningR3 ? 0.5 : 1,
                  cursor: isAssigningR3 ? 'wait' : 'pointer',
                }}
              >
                <RefreshCw
                  className={cn('w-3 h-3', isAssigningR3 && 'animate-spin')}
                />
                {b.assignR3}
              </button>
            )}
          </div>

          {/* Horizontal bracket layout */}
          <div
            style={{
              overflowX: 'auto',
              paddingBottom: 16,
              marginLeft: -16,
              marginRight: -16,
              paddingLeft: 16,
              paddingRight: 16,
            }}
          >
            <div style={{ display: 'flex', gap: 24, minWidth: 'max-content', alignItems: 'flex-start' }}>
              {/* R1 Winner Matches */}
              {rounds.find(r => r.roundNumber === 1) && (
                <RoundColumn
                  title={`${b.round} 1`}
                  subtitle={b.winnerBracket}
                  completed={rounds.find(r => r.roundNumber === 1)?.matches.filter(m => m.status === 'completed').length || 0}
                  total={rounds.find(r => r.roundNumber === 1)?.matches.length || 0}
                  accent="var(--tl-green)"
                >
                  {rounds.find(r => r.roundNumber === 1)?.matches.map((match) => (
                    <BracketMatchCard
                      key={match.id}
                      match={match}
                      allMatches={matches}
                      teamA={getTeam(match.team_a_id)}
                      teamB={getTeam(match.team_b_id)}
                      formatTeamName={formatTeamName}
                      isFinal={false}
                      canEdit={canEdit}
                      onScoreUpdated={onScoreUpdated}
                      onMatchUpdated={onMatchUpdated}
                    />
                  ))}
                </RoundColumn>
              )}

              {/* R2 Loser Matches */}
              {loserMatches.length > 0 && (
                <RoundColumn
                  title={`${b.round} 2`}
                  subtitle={b.loserBracket}
                  completed={loserMatches.filter(m => m.status === 'completed').length}
                  total={loserMatches.length}
                  accent="var(--tl-gold)"
                >
                  {loserMatches.map((match) => (
                    <BracketMatchCard
                      key={match.id}
                      match={match}
                      allMatches={matches}
                      teamA={getTeam(match.team_a_id)}
                      teamB={getTeam(match.team_b_id)}
                      formatTeamName={formatTeamName}
                      isFinal={false}
                      canEdit={canEdit}
                      onScoreUpdated={onScoreUpdated}
                      onMatchUpdated={onMatchUpdated}
                    />
                  ))}
                </RoundColumn>
              )}

              {/* R3 Merge Matches */}
              <RoundColumn
                title={`${b.round} 3`}
                subtitle={b.finalElimination}
                completed={r3Rounds[0]?.matches.filter(m => m.status === 'completed').length || 0}
                total={r3Rounds[0]?.matches.length || 0}
                accent="var(--tl-green)"
              >
                {r3NeedsAssignment && r1Completed && r2Completed ? (
                  <div
                    style={{
                      ...surfaceCard,
                      borderStyle: 'dashed',
                      padding: '20px 16px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <RefreshCw
                      className={cn(
                        'w-5 h-5',
                        isAssigningR3 && 'animate-spin',
                      )}
                      style={{ color: isAssigningR3 ? 'var(--tl-green)' : 'var(--tl-fg-3)' }}
                    />
                    <p style={{ ...monoMicro, margin: 0, textAlign: 'center' }}>
                      {isAssigningR3 ? b.assigning : b.waitingAssignment}
                    </p>
                  </div>
                ) : r3Rounds.length > 0 && r3Rounds[0].matches.length > 0 ? (
                  r3Rounds[0].matches.map((match) => (
                    <BracketMatchCard
                      key={match.id}
                      match={match}
                      allMatches={matches}
                      teamA={getTeam(match.team_a_id)}
                      teamB={getTeam(match.team_b_id)}
                      formatTeamName={formatTeamName}
                      isFinal={false}
                      canEdit={canEdit}
                      onScoreUpdated={onScoreUpdated}
                      onMatchUpdated={onMatchUpdated}
                    />
                  ))
                ) : (
                  <div
                    style={{
                      ...surfaceCard,
                      borderStyle: 'dashed',
                      padding: '20px 16px',
                      textAlign: 'center',
                    }}
                  >
                    <p style={{ ...monoMicro, margin: 0 }}>
                      {!r1Completed || !r2Completed ? b.waitingR1R2 : b.noMatches}
                    </p>
                  </div>
                )}
              </RoundColumn>
            </div>
          </div>
        </div>
      )}

      {/* ─── PLAYOFF VIEW ───────────────────────────────────────────────── */}
      {!showPreliminaryOnly && playoffRounds.length > 0 && (
        <div
          style={{
            overflowX: 'auto',
            paddingBottom: 16,
            marginLeft: -16,
            marginRight: -16,
            paddingLeft: 16,
            paddingRight: 16,
          }}
        >
          <div style={{ display: 'flex', minWidth: 'max-content', alignItems: 'stretch' }}>
            {/* Regular playoff rounds (non-final) */}
            {playoffRounds.filter(r => r.roundType !== 'final').map((round, roundIdx, filteredRounds) => {
              const isLastBeforeFinal = roundIdx === filteredRounds.length - 1;
              const matchCount = round.matches.length;
              const hasNextRound = roundIdx < filteredRounds.length - 1 || isLastBeforeFinal;

              // Group matches into pairs for bracket visualization
              const matchPairs: Match[][] = [];
              for (let i = 0; i < round.matches.length; i += 2) {
                matchPairs.push(round.matches.slice(i, i + 2));
              }

              return (
                <React.Fragment key={round.roundNumber}>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 260 }}>
                    <div
                      style={{
                        textAlign: 'center',
                        marginBottom: 16,
                        ...monoKicker,
                        color: 'var(--tl-fg-2)',
                      }}
                    >
                      {getRoundLabel(round.roundType, round.matches.length)}
                      <span style={{ marginLeft: 6, color: 'var(--tl-fg-4)' }}>
                        ({round.matches.length})
                      </span>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        flex: 1,
                        justifyContent: 'space-around',
                        gap: roundIdx === 0 ? '12px' : `${Math.pow(2, roundIdx) * 24}px`,
                      }}
                    >
                      {round.matches.map((match) => (
                        <BracketMatchCard
                          key={match.id}
                          match={match}
                          allMatches={matches}
                          teamA={getTeam(match.team_a_id)}
                          teamB={getTeam(match.team_b_id)}
                          formatTeamName={formatTeamName}
                          isFinal={false}
                          canEdit={canEdit}
                          onScoreUpdated={onScoreUpdated}
                          onMatchUpdated={onMatchUpdated}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Bracket connector lines — token border color, no
                      hardcoded grays. */}
                  {hasNextRound && matchCount >= 2 && (
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-around',
                        flexShrink: 0,
                        width: 40,
                        paddingTop: '2.5rem',
                      }}
                    >
                      {matchPairs.map((pair, pairIdx) => {
                        if (pair.length < 2) return null;
                        return (
                          <div key={pairIdx} style={{ position: 'relative', flex: 1 }}>
                            {/* Vertical line connecting match pair */}
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: '25%',
                                height: '50%',
                                width: 2,
                                background: 'var(--tl-border-2)',
                              }}
                            />
                            {/* Horizontal line to next round */}
                            <div
                              style={{
                                position: 'absolute',
                                left: 0,
                                top: '50%',
                                width: '100%',
                                height: 2,
                                background: 'var(--tl-border-2)',
                                transform: 'translateY(-1px)',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {/* Finals Column — Grand final + 3rd place */}
            {(() => {
              const finalMatch = matches.find(m => m.round_type === 'final');
              const thirdPlaceMatch = matches.find(m => m.round_type === 'third_place');

              if (!finalMatch) return null;

              return (
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 260, justifyContent: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Finals match */}
                    <div>
                      <div style={{ textAlign: 'center', marginBottom: 10 }}>
                        <span style={finalPillStyle}>
                          <Trophy className="w-3 h-3" />
                          {b.finals}
                        </span>
                      </div>
                      <BracketMatchCard
                        match={finalMatch}
                        allMatches={matches}
                        teamA={getTeam(finalMatch.team_a_id)}
                        teamB={getTeam(finalMatch.team_b_id)}
                        formatTeamName={formatTeamName}
                        isFinal={true}
                        canEdit={canEdit}
                        onScoreUpdated={onScoreUpdated}
                        onMatchUpdated={onMatchUpdated}
                      />
                    </div>

                    {/* 3rd place match */}
                    {thirdPlaceMatch && (
                      <div>
                        <div style={{ textAlign: 'center', marginBottom: 10 }}>
                          <span style={thirdPlacePillStyle}>{b.thirdPlace}</span>
                        </div>
                        <BracketMatchCard
                          match={thirdPlaceMatch}
                          allMatches={matches}
                          teamA={getTeam(thirdPlaceMatch.team_a_id)}
                          teamB={getTeam(thirdPlaceMatch.team_b_id)}
                          formatTeamName={formatTeamName}
                          isFinal={false}
                          isThirdPlace={true}
                          canEdit={canEdit}
                          onScoreUpdated={onScoreUpdated}
                          onMatchUpdated={onMatchUpdated}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {showPlayoffOnly && playoffRounds.length === 0 && (
        <div className="tl-empty-card">
          <div className="tl-empty-card-mark">◌</div>
          <div className="tl-empty-card-label">{b.playoffNotReady}</div>
        </div>
      )}
    </div>
  );
};

// ─── Progress dot subcomponent ──────────────────────────────────────────
function ProgressDot({
  label,
  active,
  tone,
}: {
  label: string;
  active: boolean;
  tone: 'green' | 'gold';
}) {
  const accent = tone === 'green' ? 'var(--tl-green)' : 'var(--tl-gold)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: active ? accent : 'var(--tl-border-2)',
          transition: 'background 0.2s',
        }}
      />
      <span
        style={{
          fontFamily: 'Geist Mono, ui-monospace, monospace',
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: active ? accent : 'var(--tl-fg-3)',
        }}
      >
        {label}
      </span>
    </div>
  );
}

// ─── Round column subcomponent ──────────────────────────────────────────
function RoundColumn({
  title,
  subtitle,
  completed,
  total,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  completed: number;
  total: number;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 280 }}>
      <div
        style={{
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '1px solid var(--tl-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 3,
                height: 16,
                borderRadius: 2,
                background: accent,
                flexShrink: 0,
              }}
            />
            <span style={{ ...monoKicker, color: 'var(--tl-fg)' }}>{title}</span>
          </div>
          <span
            style={{
              ...monoMicro,
              padding: '2px 8px',
              borderRadius: 999,
              background: 'var(--tl-surface)',
              color: 'var(--tl-fg-2)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {completed}/{total}
          </span>
        </div>
        <p style={{ ...monoMicro, marginTop: 4, marginLeft: 11, margin: '4px 0 0 11px' }}>
          {subtitle}
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>{children}</div>
    </div>
  );
}

// Helper to propagate loser to R2 match using match_index (0-based)
// Now fetches R2 matches directly from database to ensure we have latest data
async function propagateLoserToR2(
  matchIndex: number, // 0-based index of R1 match
  loserId: string,
  allMatches: Match[],
) {
  // First try from allMatches (for optimistic update when data is fresh)
  let r2Match = allMatches.find(m => {
    if (m.round_number !== 2 || m.bracket_type !== 'loser') return false;
    const sourceA = m.source_a as { type: string; match_index?: number } | null;
    const sourceB = m.source_b as { type: string; match_index?: number } | null;
    return sourceA?.match_index === matchIndex || sourceB?.match_index === matchIndex;
  });

  // If not found in allMatches, fetch from database
  if (!r2Match) {
    // Get tournament_id from any match in allMatches
    const tournamentId = allMatches[0]?.tournament_id;
    if (tournamentId) {
      const { data: r2Matches } = await supabase
        .from('doubles_elimination_matches')
        .select('*')
        .eq('tournament_id', tournamentId)
        .eq('round_number', 2);

      if (r2Matches) {
        r2Match = r2Matches.find(m => {
          const sourceA = m.source_a as { type: string; match_index?: number } | null;
          const sourceB = m.source_b as { type: string; match_index?: number } | null;
          return sourceA?.match_index === matchIndex || sourceB?.match_index === matchIndex;
        }) as Match | undefined;
      }
    }
  }

  if (r2Match) {
    const sourceA = r2Match.source_a as { type: string; match_index?: number } | null;
    const updateField = sourceA?.match_index === matchIndex ? 'team_a_id' : 'team_b_id';

    await supabase
      .from('doubles_elimination_matches')
      .update({ [updateField]: loserId } as TablesUpdate<'doubles_elimination_matches'>)
      .eq('id', r2Match.id);
  }
}

// Helper to propagate winner to next round match (R3 -> R4, R4 -> R5, etc.)
// Returns the updated match info for optimistic UI update
async function propagateWinnerToNextRound(
  match: Match,
  winnerId: string,
  allMatches: Match[],
  onMatchUpdated?: (matchId: string, updates: Partial<Match>) => void,
) {
  // For R3 matches, find corresponding R4 match slot
  // R3 winners fill empty slots in R4 (teams with high point diff already have byes to R4)
  if (match.round_number === 3) {
    const r4Matches = allMatches
      .filter(m => m.round_number === 4)
      .sort((a, b) => a.match_number - b.match_number);

    // Find R4 match with an empty slot to fill
    for (const r4Match of r4Matches) {
      // Check for empty slots (not already filled)
      if (!r4Match.team_a_id) {
        await supabase
          .from('doubles_elimination_matches')
          .update({ team_a_id: winnerId })
          .eq('id', r4Match.id);
        // Optimistic update for next round match
        onMatchUpdated?.(r4Match.id, { team_a_id: winnerId });
        return;
      }
      if (!r4Match.team_b_id) {
        await supabase
          .from('doubles_elimination_matches')
          .update({ team_b_id: winnerId })
          .eq('id', r4Match.id);
        // Optimistic update for next round match
        onMatchUpdated?.(r4Match.id, { team_b_id: winnerId });
        return;
      }
    }
  }
  // For R4+ rounds, follow the bracket position pattern
  else if (match.round_number >= 4) {
    const nextRoundMatches = allMatches
      .filter(m => m.round_number === match.round_number + 1 && m.round_type !== 'third_place')
      .sort((a, b) => a.match_number - b.match_number);

    // Find the next match based on bracket position
    const matchIndex = match.match_number - 1;
    const nextMatchIndex = Math.floor(matchIndex / 2);
    const slot = matchIndex % 2;

    const targetMatch = nextRoundMatches[nextMatchIndex];
    if (targetMatch) {
      const updateField = slot === 0 ? 'team_a_id' : 'team_b_id';
      await supabase
        .from('doubles_elimination_matches')
        .update({ [updateField]: winnerId } as TablesUpdate<'doubles_elimination_matches'>)
        .eq('id', targetMatch.id);
      // Optimistic update for next round match
      onMatchUpdated?.(targetMatch.id, { [updateField]: winnerId });
    }
  }
}

// Helper to propagate semifinal loser to 3rd place match
async function propagateLoserToThirdPlace(
  match: Match,
  loserId: string,
  allMatches: Match[],
  onMatchUpdated?: (matchId: string, updates: Partial<Match>) => void,
) {
  const thirdPlaceMatch = allMatches.find(m => m.round_type === 'third_place');
  if (!thirdPlaceMatch) return;

  // Determine slot based on match_number (match 1 loser -> team_a, match 2 loser -> team_b)
  const slot = match.match_number === 1 ? 'team_a_id' : 'team_b_id';

  // Check if slot is not already filled
  if (!thirdPlaceMatch[slot]) {
    await supabase
      .from('doubles_elimination_matches')
      .update({ [slot]: loserId } as TablesUpdate<'doubles_elimination_matches'>)
      .eq('id', thirdPlaceMatch.id);
    // Optimistic update
    onMatchUpdated?.(thirdPlaceMatch.id, { [slot]: loserId });
  }
}

interface BracketMatchCardProps {
  match: Match;
  allMatches: Match[];
  teamA: Team | undefined;
  teamB: Team | undefined;
  formatTeamName: (team: Team | undefined) => string;
  isFinal: boolean;
  isThirdPlace?: boolean;
  canEdit?: boolean;
  onScoreUpdated?: () => void;
  onMatchUpdated?: (matchId: string, updates: Partial<Match>) => void;
}

const BracketMatchCard = ({
  match,
  allMatches,
  teamA,
  teamB,
  formatTeamName,
  isFinal,
  isThirdPlace = false,
  canEdit = false,
  onScoreUpdated,
  onMatchUpdated,
}: BracketMatchCardProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useI18n();
  const b = t.doublesElimination.bracket;
  const [isEditing, setIsEditing] = useState(false);
  const [editScoreA, setEditScoreA] = useState(match.score_a?.toString() || '0');
  const [editScoreB, setEditScoreB] = useState(match.score_b?.toString() || '0');
  const [saving, setSaving] = useState(false);

  // State for BO3/BO5 game-by-game editing
  const [editingGameIndex, setEditingGameIndex] = useState<number | null>(null);
  const [gameScoreA, setGameScoreA] = useState('0');
  const [gameScoreB, setGameScoreB] = useState('0');

  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';
  const isAWinner = match.winner_id === match.team_a_id && isCompleted;
  const isBWinner = match.winner_id === match.team_b_id && isCompleted;

  // Parse existing games from JSONB
  const existingGames = Array.isArray(match.games) ? match.games as { game: number; score_a: number; score_b: number; winner: 'a' | 'b' }[] : [];

  // "Sửa" button = inline edit for BO1
  const handleStartInlineEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditScoreA(match.score_a?.toString() || '0');
    setEditScoreB(match.score_b?.toString() || '0');
    setIsEditing(true);
  };

  // For BO3/BO5: click on game slot to edit that specific game
  const handleStartGameEdit = (gameIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const existingGame = existingGames[gameIndex];
    setGameScoreA(existingGame?.score_a?.toString() || '0');
    setGameScoreB(existingGame?.score_b?.toString() || '0');
    setEditingGameIndex(gameIndex);
  };

  const handleCancelGameEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGameIndex(null);
  };

  const handleSaveGameScore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingGameIndex === null) return;
    setSaving(true);

    const scoreA = parseInt(gameScoreA) || 0;
    const scoreB = parseInt(gameScoreB) || 0;

    if (scoreA === scoreB) {
      toast({ title: b.tieNotAllowed, variant: 'destructive' });
      setSaving(false);
      return;
    }

    const gameWinner: 'a' | 'b' = scoreA > scoreB ? 'a' : 'b';
    const gameNum = editingGameIndex + 1;

    // Build updated games array
    const updatedGames = [...existingGames];
    updatedGames[editingGameIndex] = {
      game: gameNum,
      score_a: scoreA,
      score_b: scoreB,
      winner: gameWinner,
    };

    // Calculate games won
    const gamesWonA = updatedGames.filter(g => g?.winner === 'a').length;
    const gamesWonB = updatedGames.filter(g => g?.winner === 'b').length;
    const winsNeededForMatch = Math.ceil(match.best_of / 2);

    const matchComplete = gamesWonA >= winsNeededForMatch || gamesWonB >= winsNeededForMatch;
    const winnerId = matchComplete ? (gamesWonA > gamesWonB ? match.team_a_id : match.team_b_id) : null;
    const loserId = matchComplete ? (gamesWonA > gamesWonB ? match.team_b_id : match.team_a_id) : null;

    // Optimistic update
    const matchUpdates: Partial<Match> = {
      games: updatedGames as any,
      games_won_a: gamesWonA,
      games_won_b: gamesWonB,
      winner_id: winnerId,
      status: matchComplete ? 'completed' : 'live',
    };
    onMatchUpdated?.(match.id, matchUpdates);

    try {
      await supabase
        .from('doubles_elimination_matches')
        .update({
          games: updatedGames,
          games_won_a: gamesWonA,
          games_won_b: gamesWonB,
          winner_id: winnerId,
          status: matchComplete ? 'completed' : 'live',
        })
        .eq('id', match.id);

      if (matchComplete) {
        // For R1 winner matches, propagate loser to R2 loser bracket
        if (loserId && match.round_type === 'winner_r1') {
          const matchIndex = match.match_number - 1;
          await propagateLoserToR2(matchIndex, loserId, allMatches);
        }

        // For R3+ matches, propagate winner to next round
        if (winnerId && match.round_number >= 3) {
          await propagateWinnerToNextRound(match, winnerId, allMatches, onMatchUpdated);
        }

        // For semifinal matches, propagate loser to 3rd place match
        if (loserId && match.round_type === 'semifinal') {
          await propagateLoserToThirdPlace(match, loserId, allMatches, onMatchUpdated);
        }

        // Mark loser as eliminated if not R1
        if (loserId && match.round_type !== 'winner_r1') {
          await supabase
            .from('doubles_elimination_teams')
            .update({
              status: 'eliminated',
              eliminated_at_round: match.round_number,
            })
            .eq('id', loserId);
        }

        // If this is the final match, mark tournament as completed
        if (match.round_type === 'final') {
          await supabase
            .from('doubles_elimination_tournaments')
            .update({ status: 'completed' })
            .eq('id', match.tournament_id);
        }
      }

      toast({ title: matchComplete ? b.matchSaved : `${b.gameSaved} ${gameNum}` });
      setEditingGameIndex(null);

      // Trigger reload to update data and auto-generate next round if needed
      if (matchComplete) {
        onScoreUpdated?.();
      }
    } catch (error) {
      toast({ title: b.scoreSaveError, variant: 'destructive' });
      onScoreUpdated?.();
    } finally {
      setSaving(false);
    }
  };

  // "Chấm" button = go to scoring page
  const handleGoToScoringPage = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/tools/doubles-elimination/match/${match.id}/score`);
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(false);
  };

  const handleSaveScore = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);

    const scoreA = parseInt(editScoreA) || 0;
    const scoreB = parseInt(editScoreB) || 0;

    // For BO1: higher score wins
    const winnerId = scoreA > scoreB ? match.team_a_id : scoreB > scoreA ? match.team_b_id : null;
    const loserId = scoreA > scoreB ? match.team_b_id : scoreB > scoreA ? match.team_a_id : null;
    const isMatchComplete = scoreA !== scoreB;

    // Optimistic update
    const matchUpdates: Partial<Match> = {
      score_a: scoreA,
      score_b: scoreB,
      winner_id: isMatchComplete ? winnerId : null,
      status: isMatchComplete ? 'completed' : 'live',
    };
    onMatchUpdated?.(match.id, matchUpdates);

    try {
      await supabase
        .from('doubles_elimination_matches')
        .update({
          score_a: scoreA,
          score_b: scoreB,
          winner_id: isMatchComplete ? winnerId : null,
          status: isMatchComplete ? 'completed' : 'live',
        })
        .eq('id', match.id);

      // For R1 winner matches, propagate loser to R2 loser bracket
      if (isMatchComplete && loserId && match.round_type === 'winner_r1') {
        const matchIndex = match.match_number - 1;
        await propagateLoserToR2(matchIndex, loserId, allMatches);
      }

      // For R3+ matches, propagate winner to next round
      if (isMatchComplete && winnerId && match.round_number >= 3) {
        await propagateWinnerToNextRound(match, winnerId, allMatches, onMatchUpdated);
      }

      // For semifinal matches, propagate loser to 3rd place match
      if (isMatchComplete && loserId && match.round_type === 'semifinal') {
        await propagateLoserToThirdPlace(match, loserId, allMatches, onMatchUpdated);
      }

      // Mark loser as eliminated if not R1
      if (isMatchComplete && loserId && match.round_type !== 'winner_r1') {
        await supabase
          .from('doubles_elimination_teams')
          .update({
            status: 'eliminated',
            eliminated_at_round: match.round_number,
          })
          .eq('id', loserId);
      }

      // If this is the final match, mark tournament as completed
      if (isMatchComplete && match.round_type === 'final') {
        await supabase
          .from('doubles_elimination_tournaments')
          .update({ status: 'completed' })
          .eq('id', match.tournament_id);
      }

      toast({ title: isMatchComplete ? b.matchSaved : b.scoreSaved });
      setIsEditing(false);

      // Trigger reload to update data and auto-generate next round if needed
      if (isMatchComplete) {
        onScoreUpdated?.();
      }
    } catch (error) {
      toast({ title: b.scoreSaveError, variant: 'destructive' });
      onScoreUpdated?.();
    } finally {
      setSaving(false);
    }
  };

  const isBestOf = match.best_of > 1;
  const formatLabel = match.best_of === 1 ? '' : `BO${match.best_of}`;

  // Border / glow treatment per match state. LIVE matches get the
  // signature green-glow ring (matches the live broadcast convention
  // in TheLineLayout).
  const cardStyle: React.CSSProperties = {
    ...matchCardStyle,
    ...(isFinal && {
      borderColor: 'var(--tl-green)',
      boxShadow: '0 0 0 1px var(--tl-green), 0 0 18px var(--tl-green-glow)',
      background:
        'linear-gradient(180deg, var(--tl-green-glow) 0%, var(--tl-bg-elev) 60%)',
    }),
    ...(isThirdPlace && {
      borderColor: 'rgba(233, 182, 73, 0.55)',
      boxShadow: '0 0 0 1px rgba(233, 182, 73, 0.20)',
    }),
    ...(isLive && {
      borderColor: 'var(--tl-live)',
      boxShadow: '0 0 0 1px var(--tl-live), 0 0 14px rgba(255, 65, 54, 0.18)',
    }),
    ...(isCompleted && !isFinal && !isLive && {
      opacity: 0.92,
    }),
  };

  // Header background tinted by state
  const headerBg = isLive
    ? 'rgba(255, 65, 54, 0.08)'
    : isFinal
    ? 'rgba(0, 185, 107, 0.10)'
    : 'var(--tl-surface)';

  return (
    <div style={cardStyle}>
      {/* Match header */}
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid var(--tl-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: headerBg,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isFinal && !isThirdPlace && (
            <span style={{ ...monoKicker, color: 'var(--tl-fg)' }}>
              {b.match} {match.match_number}
            </span>
          )}
          {(match.court_number || match.start_time) && (
            <span style={{ ...monoMicro, color: 'var(--tl-fg-3)' }}>
              {match.court_number && `S${match.court_number}`}
              {match.court_number && match.start_time && ' • '}
              {match.start_time}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Best-of format badge */}
          {isBestOf && <span style={formatPillStyle}>{formatLabel}</span>}
          {isLive && (
            <span style={livePillStyle} className="animate-pulse">
              <Radio className="w-2.5 h-2.5" />
              LIVE
            </span>
          )}
          {isFinal && (
            <span style={finalPillStyle}>
              <Trophy className="w-2.5 h-2.5" />
              {b.finalBadge}
            </span>
          )}
          {isCompleted && !isFinal && <span style={donePillStyle}>{b.done}</span>}
        </div>
      </div>

      {/* Teams */}
      <div>
        <TeamRow
          team={teamA}
          isWinner={isAWinner}
          isLoser={isCompleted && !isAWinner}
          score={match.best_of > 1 ? match.games_won_a : match.score_a}
          formatTeamName={formatTeamName}
          isEditing={isEditing}
          editScore={editScoreA}
          setEditScore={setEditScoreA}
          isTop={true}
        />
        <TeamRow
          team={teamB}
          isWinner={isBWinner}
          isLoser={isCompleted && !isBWinner}
          score={match.best_of > 1 ? match.games_won_b : match.score_b}
          formatTeamName={formatTeamName}
          isEditing={isEditing}
          editScore={editScoreB}
          setEditScore={setEditScoreB}
          isTop={false}
        />
      </div>

      {/* BO3/BO5 game slots */}
      {isBestOf && (
        <div
          style={{
            padding: '10px 10px',
            borderTop: '1px solid var(--tl-border)',
            background: 'var(--tl-surface)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
            {Array.from({ length: match.best_of }).map((_, gameIndex) => {
              const gameData = existingGames[gameIndex];
              const gameCompleted = !!gameData;
              const winnerTeam = gameData?.winner;
              const isEditingThis = editingGameIndex === gameIndex;
              const canEditGame = canEdit && teamA && teamB;

              const slotStyle: React.CSSProperties = {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                transition: 'border-color 0.15s, background 0.15s',
                width: isEditingThis ? 84 : 44,
                height: isEditingThis ? 64 : 44,
                border: isEditingThis
                  ? '1px solid var(--tl-green)'
                  : gameCompleted
                  ? '1px solid var(--tl-border)'
                  : '1px dashed var(--tl-border-2)',
                background: isEditingThis
                  ? 'var(--tl-green-glow)'
                  : gameCompleted
                  ? 'var(--tl-bg-elev)'
                  : 'transparent',
                cursor: canEditGame && !isEditingThis ? 'pointer' : 'default',
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontVariantNumeric: 'tabular-nums',
              };

              return (
                <div
                  key={gameIndex}
                  onClick={(e) => canEditGame && handleStartGameEdit(gameIndex, e)}
                  style={slotStyle}
                  title={canEditGame ? `${b.clickGameToEdit} ${gameIndex + 1}` : `Game ${gameIndex + 1}`}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 500,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--tl-fg-3)',
                    }}
                  >
                    G{gameIndex + 1}
                  </div>
                  {isEditingThis ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                      <Input
                        type="number"
                        value={gameScoreA}
                        onChange={(e) => setGameScoreA(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-center font-bold p-0"
                        style={{
                          width: 30,
                          height: 22,
                          fontSize: 11,
                          fontFamily: 'Geist Mono, ui-monospace, monospace',
                        }}
                        min={0}
                      />
                      <span style={{ color: 'var(--tl-fg-3)', fontSize: 11 }}>-</span>
                      <Input
                        type="number"
                        value={gameScoreB}
                        onChange={(e) => setGameScoreB(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="text-center font-bold p-0"
                        style={{
                          width: 30,
                          height: 22,
                          fontSize: 11,
                          fontFamily: 'Geist Mono, ui-monospace, monospace',
                        }}
                        min={0}
                      />
                    </div>
                  ) : gameCompleted ? (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        fontSize: 12,
                        fontWeight: 600,
                      }}
                    >
                      <span
                        style={{
                          color:
                            winnerTeam === 'a' ? 'var(--tl-green)' : 'var(--tl-fg-3)',
                        }}
                      >
                        {gameData.score_a}
                      </span>
                      <span style={{ color: 'var(--tl-fg-4)' }}>-</span>
                      <span
                        style={{
                          color:
                            winnerTeam === 'b' ? 'var(--tl-green)' : 'var(--tl-fg-3)',
                        }}
                      >
                        {gameData.score_b}
                      </span>
                    </div>
                  ) : (
                    <span style={{ color: 'var(--tl-fg-4)', fontSize: 12 }}>—</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Save/Cancel buttons for game editing */}
          {editingGameIndex !== null && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
              <button
                type="button"
                name="cancel-game-edit"
                onClick={handleCancelGameEdit}
                disabled={saving}
                style={{ ...inlineBtnGhostStyle, opacity: saving ? 0.5 : 1 }}
              >
                <X className="w-3 h-3" />
                {b.cancel}
              </button>
              <button
                type="button"
                name="save-game-score"
                onClick={handleSaveGameScore}
                disabled={saving}
                style={{ ...inlineBtnPrimaryStyle, opacity: saving ? 0.5 : 1 }}
              >
                <Check className="w-3 h-3" />
                {b.saveGameN}{editingGameIndex + 1}
              </button>
            </div>
          )}

          {editingGameIndex === null && canEdit && teamA && teamB && (
            <div style={{ ...monoMicro, textAlign: 'center', marginTop: 6 }}>
              {b.clickGameToEdit}
            </div>
          )}

          {editingGameIndex === null && canEdit && (!teamA || !teamB) && (
            <div style={{ ...monoMicro, textAlign: 'center', marginTop: 6 }}>
              {b.waitingTeams}
            </div>
          )}
        </div>
      )}

      {/* Edit controls for organizer / referee */}
      {canEdit && (
        <div
          style={{
            padding: '8px 12px',
            borderTop: '1px solid var(--tl-border)',
            background: 'var(--tl-surface)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: 6,
          }}
        >
          {isEditing ? (
            <>
              <button
                type="button"
                name="cancel-score-edit"
                onClick={handleCancelEdit}
                disabled={saving}
                style={{ ...inlineBtnGhostStyle, opacity: saving ? 0.5 : 1 }}
              >
                <X className="w-3 h-3" />
                {b.cancel}
              </button>
              <button
                type="button"
                name="save-score"
                onClick={handleSaveScore}
                disabled={saving}
                style={{ ...inlineBtnPrimaryStyle, opacity: saving ? 0.5 : 1 }}
              >
                <Check className="w-3 h-3" />
                {b.save}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                name="open-scoring"
                onClick={handleGoToScoringPage}
                disabled={!teamA || !teamB}
                style={{
                  ...inlineBtnStyle,
                  opacity: !teamA || !teamB ? 0.4 : 1,
                  cursor: !teamA || !teamB ? 'not-allowed' : 'pointer',
                }}
              >
                <Play className="w-3 h-3" />
                {b.openScoring}
              </button>
              {/* For BO1: show edit button. For BO3/BO5: game slots are clickable instead */}
              {!isBestOf && (
                <button
                  type="button"
                  name="edit-score"
                  onClick={handleStartInlineEdit}
                  disabled={!teamA || !teamB}
                  style={{
                    ...inlineBtnGhostStyle,
                    opacity: !teamA || !teamB ? 0.4 : 1,
                    cursor: !teamA || !teamB ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Pencil className="w-3 h-3" />
                  {b.editScore}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Team row subcomponent ──────────────────────────────────────────────
function TeamRow({
  team,
  isWinner,
  isLoser,
  score,
  formatTeamName,
  isEditing,
  editScore,
  setEditScore,
  isTop,
}: {
  team: Team | undefined;
  isWinner: boolean;
  isLoser: boolean;
  score: number | null | undefined;
  formatTeamName: (team: Team | undefined) => string;
  isEditing: boolean;
  editScore: string;
  setEditScore: (v: string) => void;
  isTop: boolean;
}) {
  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    minHeight: 44,
    borderTop: isTop ? 'none' : '1px solid var(--tl-border)',
    background: isWinner
      ? 'var(--tl-green-glow)'
      : !team
      ? 'transparent'
      : 'transparent',
    borderLeft: isWinner ? '2px solid var(--tl-green)' : '2px solid transparent',
    transition: 'background 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    ...teamNameStyle,
    color: isWinner
      ? 'var(--tl-fg)'
      : isLoser
      ? 'var(--tl-fg-3)'
      : !team
      ? 'var(--tl-fg-3)'
      : 'var(--tl-fg)',
    fontStyle: !team ? 'italic' : 'italic',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  };

  return (
    <div style={rowStyle}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={labelStyle}>{formatTeamName(team)}</div>
      </div>

      {isEditing ? (
        <Input
          type="number"
          value={editScore}
          onChange={(e) => setEditScore(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="text-center font-bold p-1"
          style={{
            width: 52,
            height: 32,
            fontFamily: 'Geist Mono, ui-monospace, monospace',
            fontSize: 14,
            fontVariantNumeric: 'tabular-nums',
          }}
          min={0}
        />
      ) : (
        <div style={isWinner ? scoreCellWinner : scoreCellBase}>
          {score ?? 0}
        </div>
      )}

      {isWinner && !isEditing && (
        <Crown
          className="w-4 h-4"
          style={{ color: 'var(--tl-green)', flexShrink: 0 }}
          aria-hidden
        />
      )}
    </div>
  );
}

export default DoublesEliminationBracket;
