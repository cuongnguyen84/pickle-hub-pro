import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gamepad2, Trophy, Clock, Play, ClipboardList, Check, AlertTriangle, Users, Radio } from 'lucide-react';
import { useTeamMatchMatches, TeamMatchMatch } from '@/hooks/useTeamMatchMatches';
import { useTeamMatchGroups, TeamMatchGroup } from '@/hooks/useTeamMatchGroups';
import { useI18n } from '@/i18n';

interface GroupMatchListProps {
  tournamentId: string;
  userTeamId?: string;
  isOwner?: boolean;
  canEditScores?: boolean;
  /** Total-score format → show cumulative points (not games won) as the score. */
  isTotalScore?: boolean;
  onMatchClick?: (match: TeamMatchMatch) => void;
  onLineupClick?: (match: TeamMatchMatch, teamId?: string) => void;
  onStartRound?: (roundNumber: number, groupId?: string) => void;
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

type StatusKind = 'pending' | 'lineup' | 'in_progress' | 'completed';

function statusPillStyle(kind: StatusKind): React.CSSProperties {
  if (kind === 'completed') return { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' };
  if (kind === 'in_progress') return { background: 'rgba(255, 65, 54, 0.10)', color: 'var(--tl-live)' };
  if (kind === 'lineup') return { background: 'rgba(120, 165, 255, 0.10)', color: 'var(--tl-fg-2)' };
  return { background: 'var(--tl-surface)', color: 'var(--tl-fg-3)' };
}

interface StatusEntry {
  label: string;
  kind: StatusKind;
  icon: typeof Clock;
}

export function GroupMatchList({
  tournamentId,
  userTeamId,
  isOwner,
  canEditScores,
  isTotalScore,
  onMatchClick,
  onLineupClick,
  onStartRound,
  onScoreMatch,
}: GroupMatchListProps) {
  const { data: matches, isLoading: isLoadingMatches } = useTeamMatchMatches(tournamentId);
  const { data: groups, isLoading: isLoadingGroups } = useTeamMatchGroups(tournamentId);
  const { t, language } = useI18n();
  const c = t.teamMatchComponents;
  const v = t.teamMatch.view;

  const txt = {
    lineupBtn: language === 'vi' ? 'Line up' : 'Lineup',
    noMatchesTitle: v.noMatches,
    noMatchesHint: c.noMatchesCreateSchedule,
    noGroupsTitle: c.noGroupsYet,
  };

  const STATUS_CONFIG: Record<StatusKind, StatusEntry> = {
    pending: { label: c.notStarted, kind: 'pending', icon: Clock },
    lineup: { label: c.liningUp, kind: 'lineup', icon: ClipboardList },
    in_progress: { label: c.live, kind: 'in_progress', icon: Radio },
    completed: { label: c.ended, kind: 'completed', icon: Trophy },
  };

  if (isLoadingMatches || isLoadingGroups) {
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

  // Group matches by group_id
  const roundRobinMatches = matches.filter(m => !m.is_playoff);
  const matchesByGroup = new Map<string, TeamMatchMatch[]>();

  roundRobinMatches.forEach(match => {
    const groupId = match.group_id || 'no-group';
    if (!matchesByGroup.has(groupId)) {
      matchesByGroup.set(groupId, []);
    }
    matchesByGroup.get(groupId)!.push(match);
  });

  // Sort groups by display_order
  const sortedGroups = groups?.sort((a, b) => a.display_order - b.display_order) || [];

  if (sortedGroups.length === 0) {
    return (
      <div style={{ ...surfaceCard, padding: 32 }}>
        <div className="tl-empty-card" style={{ margin: 0, padding: '24px 16px' }}>
          <span className="tl-empty-card-mark">
            <Users className="h-6 w-6" />
          </span>
          <span className="tl-empty-card-label">{txt.noGroupsTitle}</span>
        </div>
      </div>
    );
  }

  return (
    <Tabs defaultValue={sortedGroups[0]?.id} className="w-full">
      <TabsList className="w-full flex-wrap h-auto gap-1 p-1">
        {sortedGroups.map((group) => (
          <TabsTrigger key={group.id} value={group.id} className="flex-1 min-w-[100px]">
            {group.name}
          </TabsTrigger>
        ))}
      </TabsList>

      {sortedGroups.map((group) => (
        <TabsContent key={group.id} value={group.id} className="mt-4">
          <GroupMatches
            group={group}
            matches={matchesByGroup.get(group.id) || []}
            userTeamId={userTeamId}
            isOwner={isOwner}
            canEditScores={canEditScores}
            isTotalScore={isTotalScore}
            statusConfig={STATUS_CONFIG}
            c={c}
            language={language}
            lineupBtnLabel={txt.lineupBtn}
            onMatchClick={onMatchClick}
            onLineupClick={onLineupClick}
            onStartRound={(round) => onStartRound?.(round, group.id)}
            onScoreMatch={onScoreMatch}
          />
        </TabsContent>
      ))}
    </Tabs>
  );
}

// Sub-component for matches within a group
function GroupMatches({
  group,
  matches,
  userTeamId,
  isOwner,
  canEditScores,
  isTotalScore,
  statusConfig,
  c,
  language,
  lineupBtnLabel,
  onMatchClick,
  onLineupClick,
  onStartRound,
  onScoreMatch,
}: {
  group: TeamMatchGroup;
  matches: TeamMatchMatch[];
  userTeamId?: string;
  isOwner?: boolean;
  canEditScores?: boolean;
  isTotalScore?: boolean;
  statusConfig: Record<StatusKind, StatusEntry>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  c: any;
  language: 'vi' | 'en';
  lineupBtnLabel: string;
  onMatchClick?: (match: TeamMatchMatch) => void;
  onLineupClick?: (match: TeamMatchMatch, teamId?: string) => void;
  onStartRound?: (roundNumber: number) => void;
  onScoreMatch?: (match: TeamMatchMatch) => void;
}) {
  if (matches.length === 0) {
    return (
      <div style={{ ...surfaceCard, padding: 24 }}>
        <div className="tl-empty-card" style={{ margin: 0, padding: '16px 12px' }}>
          <span className="tl-empty-card-label">{c.noMatchesInGroup} {group.name}</span>
        </div>
      </div>
    );
  }

  // Group by round
  const matchesByRound = matches.reduce((acc, match) => {
    const round = match.round_number || 0;
    if (!acc[round]) acc[round] = [];
    acc[round].push(match);
    return acc;
  }, {} as Record<number, TeamMatchMatch[]>);

  const rounds = Object.keys(matchesByRound).map(Number).filter(r => r > 0).sort((a, b) => a - b);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {rounds.map((round) => {
        const roundMatches = matchesByRound[round];

        const allLineupsSubmitted = roundMatches.every(match =>
          match.lineup_a_submitted && match.lineup_b_submitted
        );

        const roundStarted = roundMatches.some(match =>
          match.status === 'in_progress' || match.status === 'completed'
        );

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
                marginBottom: 10,
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <h4 style={{ ...fieldLabel, color: 'var(--tl-fg-3)' }}>
                {c.roundLabel} {round}
              </h4>

              {isOwner && !roundStarted && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {allLineupsSubmitted ? (
                    <button
                      type="button"
                      className="tl-btn green"
                      style={{ padding: '5px 10px', fontSize: 11.5 }}
                      onClick={() => onStartRound?.(round)}
                    >
                      <Play className="h-3 w-3" />
                      {c.startRound}
                    </button>
                  ) : (
                    <span style={{ ...statusPillBase, background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)' }}>
                      <Clock className="h-3 w-3" />
                      {c.waitingLineup}
                    </span>
                  )}
                </div>
              )}
            </div>

            {isOwner && !roundStarted && missingLineups.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginBottom: 10,
                  padding: '8px 10px',
                  borderRadius: 'var(--tl-radius)',
                  background: 'rgba(233, 182, 73, 0.08)',
                  border: '1px solid rgba(233, 182, 73, 0.35)',
                  color: 'var(--tl-fg-2)',
                  fontSize: 11.5,
                }}
              >
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5" style={{ color: 'var(--tl-gold)' }} />
                <span>
                  {c.missingLineup} {missingLineups.join(', ')}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {roundMatches.map((match) => {
                const config = statusConfig[match.status as StatusKind] || statusConfig.pending;
                const StatusIcon = config.icon;
                const isMyMatch = userTeamId && (match.team_a_id === userTeamId || match.team_b_id === userTeamId);
                const isLive = match.status === 'in_progress';
                const matchStarted = match.status === 'in_progress' || match.status === 'completed';

                const needsLineupA = !match.lineup_a_submitted && !matchStarted;
                const needsLineupB = !match.lineup_b_submitted && !matchStarted;

                const canLineupA = needsLineupA && (isOwner || match.team_a_id === userTeamId);
                const canLineupB = needsLineupB && (isOwner || match.team_b_id === userTeamId);

                const isTeamA = match.team_a_id === userTeamId;
                const myLineupSubmitted = isMyMatch && (isTeamA ? match.lineup_a_submitted : match.lineup_b_submitted);

                const winnerA = match.winner_team_id === match.team_a_id;
                const winnerB = match.winner_team_id === match.team_b_id;
                const teamAColor = winnerA ? 'var(--tl-fg)' : (matchStarted && !winnerA && match.status === 'completed' ? 'var(--tl-fg-3)' : 'var(--tl-fg)');
                const teamBColor = winnerB ? 'var(--tl-fg)' : (matchStarted && !winnerB && match.status === 'completed' ? 'var(--tl-fg-3)' : 'var(--tl-fg)');

                const cardShadow = isLive
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
                      padding: 12,
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, box-shadow 0.15s',
                      boxShadow: cardShadow,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                              fontSize: 16,
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
                              gap: 6,
                              padding: '4px 10px',
                              borderRadius: 6,
                              background: 'var(--tl-surface)',
                              border: '1px solid var(--tl-border)',
                              minWidth: 70,
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 17,
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
                                fontSize: 17,
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
                              fontSize: 16,
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
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
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

                        {/* BTC lineup buttons */}
                        {isOwner && (canLineupA || canLineupB) && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            {canLineupA && (
                              <button
                                type="button"
                                className="tl-btn"
                                style={{ padding: '3px 7px', fontSize: 10.5 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onLineupClick?.(match, match.team_a_id!);
                                }}
                              >
                                <ClipboardList className="h-3 w-3" />
                                A
                              </button>
                            )}
                            {canLineupB && (
                              <button
                                type="button"
                                className="tl-btn"
                                style={{ padding: '3px 7px', fontSize: 10.5 }}
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

                        {/* Captain lineup button */}
                        {!isOwner && isMyMatch && !myLineupSubmitted && !matchStarted && (
                          <button
                            type="button"
                            className="tl-btn green"
                            style={{ padding: '5px 9px', fontSize: 11 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onLineupClick?.(match, userTeamId);
                            }}
                          >
                            <ClipboardList className="h-3 w-3" />
                            {lineupBtnLabel}
                          </button>
                        )}

                        {/* Captain already lined up badge */}
                        {!isOwner && myLineupSubmitted && !matchStarted && (
                          <span
                            style={{
                              ...statusPillBase,
                              ...statusPillStyle('completed'),
                            }}
                          >
                            <Check className="h-3 w-3" />
                            {c.lineupDone}
                          </span>
                        )}

                        {/* Referee Score Button */}
                        {canEditScores && (
                          (match.lineup_a_submitted && match.lineup_b_submitted) ||
                          match.status === 'in_progress' ||
                          match.status === 'completed'
                        ) && (
                          <button
                            type="button"
                            className="tl-btn green"
                            style={{ padding: '5px 9px', fontSize: 11 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onScoreMatch?.(match);
                            }}
                          >
                            <Play className="h-3 w-3" />
                            {c.scoreBtn}
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
