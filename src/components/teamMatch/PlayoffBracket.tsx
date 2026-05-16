import { Trophy, Clock, Play, Check, ClipboardList, Radio } from 'lucide-react';
import { TeamMatchMatch } from '@/hooks/useTeamMatchMatches';
import { useI18n } from '@/i18n';

interface PlayoffBracketProps {
  matches: TeamMatchMatch[];
  userTeamId?: string;
  isOwner?: boolean;
  canEditScores?: boolean;
  onMatchClick?: (match: TeamMatchMatch) => void;
  onLineupClick?: (match: TeamMatchMatch, teamId?: string) => void;
  onScoreMatch?: (match: TeamMatchMatch) => void;
  isSingleElimination?: boolean;
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

interface RenderMatchCardArgs {
  match: TeamMatchMatch;
  userTeamId?: string;
  isOwner?: boolean;
  canEditScores?: boolean;
  isThirdPlace?: boolean;
  thirdPlaceTbd: string;
  txt: {
    notStarted: string;
    lineupLabel: string;
    live: string;
    completed: string;
    scoreBtn: string;
    lineupBtn: string;
  };
  onMatchClick?: (match: TeamMatchMatch) => void;
  onLineupClick?: (match: TeamMatchMatch, teamId?: string) => void;
  onScoreMatch?: (match: TeamMatchMatch) => void;
}

function StatusIconFor(kind: StatusKind) {
  if (kind === 'completed') return Check;
  if (kind === 'in_progress') return Radio;
  if (kind === 'lineup') return ClipboardList;
  return Clock;
}

function statusKindFor(status: string): StatusKind {
  if (status === 'completed' || status === 'in_progress' || status === 'lineup') return status;
  return 'pending';
}

function renderMatchCard({
  match,
  userTeamId,
  isOwner,
  canEditScores,
  isThirdPlace,
  thirdPlaceTbd,
  txt,
  onMatchClick,
  onLineupClick,
  onScoreMatch,
}: RenderMatchCardArgs) {
  const isMyMatch = userTeamId && (match.team_a_id === userTeamId || match.team_b_id === userTeamId);
  const matchStarted = match.status === 'in_progress' || match.status === 'completed';
  const isLive = match.status === 'in_progress';
  const hasBothTeams = match.team_a_id && match.team_b_id;

  const needsLineupA = hasBothTeams && !match.lineup_a_submitted && !matchStarted;
  const needsLineupB = hasBothTeams && !match.lineup_b_submitted && !matchStarted;

  const isReadyToStart = hasBothTeams && match.lineup_a_submitted && match.lineup_b_submitted;
  const canScore = canEditScores && (isReadyToStart || matchStarted);

  const canLineupA = needsLineupA && (isOwner || match.team_a_id === userTeamId);
  const canLineupB = needsLineupB && (isOwner || match.team_b_id === userTeamId);

  const winnerA = match.winner_team_id === match.team_a_id;
  const winnerB = match.winner_team_id === match.team_b_id;

  const kind = statusKindFor(match.status);
  const StatusIcon = StatusIconFor(kind);
  const statusLabel =
    kind === 'completed' ? txt.completed :
    kind === 'in_progress' ? txt.live :
    kind === 'lineup' ? txt.lineupLabel :
    txt.notStarted;

  const accentColor = isThirdPlace ? 'var(--tl-gold)' : 'var(--tl-green)';
  const winnerRowBg = isThirdPlace ? 'rgba(233, 182, 73, 0.10)' : 'var(--tl-green-glow)';
  const winnerColor = isThirdPlace ? 'var(--tl-gold)' : 'var(--tl-green)';

  const cardShadow = isLive
    ? '0 0 0 1px var(--tl-green), 0 0 12px var(--tl-green-glow)'
    : isMyMatch
      ? '0 0 0 1px var(--tl-green-dim)'
      : 'none';

  const cardBorder = isThirdPlace ? 'rgba(233, 182, 73, 0.35)' : 'var(--tl-border)';

  return (
    <div
      key={match.id}
      onClick={() => onMatchClick?.(match)}
      style={{
        ...surfaceCard,
        borderColor: cardBorder,
        padding: 12,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: cardShadow,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Team A row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 10px',
          borderRadius: 6,
          background: winnerA ? winnerRowBg : 'var(--tl-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'Instrument Serif, serif',
              fontStyle: 'italic',
              fontSize: 15,
              fontWeight: winnerA ? 600 : 400,
              letterSpacing: '-0.01em',
              color: winnerA ? 'var(--tl-fg)' : (match.team_a_id === userTeamId ? 'var(--tl-fg)' : 'var(--tl-fg-2)'),
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {(match.team_a as any)?.team_name || (isThirdPlace ? thirdPlaceTbd : 'TBD')}
          </span>
          {match.lineup_a_submitted && (
            <Check className="h-3 w-3 flex-shrink-0" style={{ color: accentColor }} />
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 14,
              fontWeight: 600,
              color: winnerA ? winnerColor : 'var(--tl-fg)',
            }}
          >
            {match.games_won_a}
          </span>
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
              {isOwner ? 'A' : txt.lineupBtn}
            </button>
          )}
        </div>
      </div>

      {/* Team B row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 10px',
          borderRadius: 6,
          background: winnerB ? winnerRowBg : 'var(--tl-surface)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontFamily: 'Instrument Serif, serif',
              fontStyle: 'italic',
              fontSize: 15,
              fontWeight: winnerB ? 600 : 400,
              letterSpacing: '-0.01em',
              color: winnerB ? 'var(--tl-fg)' : (match.team_b_id === userTeamId ? 'var(--tl-fg)' : 'var(--tl-fg-2)'),
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {(match.team_b as any)?.team_name || (isThirdPlace ? thirdPlaceTbd : 'TBD')}
          </span>
          {match.lineup_b_submitted && (
            <Check className="h-3 w-3 flex-shrink-0" style={{ color: accentColor }} />
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 14,
              fontWeight: 600,
              color: winnerB ? winnerColor : 'var(--tl-fg)',
            }}
          >
            {match.games_won_b}
          </span>
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
              {isOwner ? 'B' : txt.lineupBtn}
            </button>
          )}
        </div>
      </div>

      {/* Status row */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        <span
          style={{
            ...statusPillBase,
            ...statusPillStyle(kind),
            ...(isLive ? { animation: 'tl-pulse 1.6s ease-in-out infinite' } : {}),
          }}
        >
          <StatusIcon className="h-3 w-3" />
          {statusLabel}
        </span>
        {canScore && (
          <button
            type="button"
            className="tl-btn green"
            style={{ padding: '4px 9px', fontSize: 11 }}
            onClick={(e) => {
              e.stopPropagation();
              onScoreMatch?.(match);
            }}
          >
            <Play className="h-3 w-3" />
            {txt.scoreBtn}
          </button>
        )}
      </div>
    </div>
  );
}

export function PlayoffBracket({ matches, userTeamId, isOwner, canEditScores, onMatchClick, onLineupClick, onScoreMatch, isSingleElimination }: PlayoffBracketProps) {
  const { t, language } = useI18n();
  const c = t.teamMatchComponents;

  // W2.4a — bilingual round names. Was a const-level VI-only ROUND_NAMES
  // object; converted to a per-render map driven by language.
  const ROUND_NAMES: Record<number, string> = language === 'vi'
    ? {
        1: 'Chung kết',
        2: 'Bán kết',
        3: 'Tứ kết',
        4: 'Vòng 1/8',
        5: 'Vòng 1/16',
      }
    : {
        1: 'Final',
        2: 'Semi-final',
        3: 'Quarter-final',
        4: 'Round of 16',
        5: 'Round of 32',
      };

  const txt = {
    notStarted: language === 'vi' ? 'Chưa đấu' : 'Not started',
    lineupLabel: c.liningUp,
    live: c.live,
    completed: language === 'vi' ? 'Hoàn thành' : 'Completed',
    scoreBtn: c.scoreBtn,
    lineupBtn: language === 'vi' ? 'Line up' : 'Lineup',
    champion: language === 'vi' ? 'Vô địch' : 'Champion',
    thirdPlace: language === 'vi' ? 'Tranh hạng 3' : 'Third place match',
    thirdPlaceTbd: language === 'vi' ? 'Đợi BK' : 'Waiting semis',
    noBracketTitle: isSingleElimination
      ? (language === 'vi' ? 'Chưa có Bracket' : 'No bracket yet')
      : (language === 'vi' ? 'Chưa có vòng Playoff' : 'No playoff round yet'),
    noBracketHint: isSingleElimination
      ? (language === 'vi'
          ? 'Tạo bracket để bắt đầu thi đấu loại trực tiếp'
          : 'Create a bracket to begin single elimination play')
      : (language === 'vi'
          ? 'Hoàn thành vòng tròn để tạo Playoff'
          : 'Complete round robin to create the playoff'),
    fallbackRound: (n: number) => language === 'vi' ? `Vòng ${n}` : `Round ${n}`,
  };

  // Group playoff matches by round - separate third-place match (round 0)
  const allPlayoffMatches = matches.filter(m => m.is_playoff);
  const thirdPlaceMatch = allPlayoffMatches.find(m => (m as any).is_third_place === true || m.playoff_round === 0);
  const regularPlayoffMatches = allPlayoffMatches.filter(m => (m as any).is_third_place !== true && m.playoff_round !== 0);

  const matchesByRound = regularPlayoffMatches
    .reduce((acc, match) => {
      const round = match.playoff_round || 1;
      if (!acc[round]) acc[round] = [];
      acc[round].push(match);
      return acc;
    }, {} as Record<number, TeamMatchMatch[]>);

  const rounds = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => b - a); // Higher round = earlier stage

  if (allPlayoffMatches.length === 0) {
    return (
      <div style={{ ...surfaceCard, padding: 32 }}>
        <div className="tl-empty-card" style={{ margin: 0, padding: '24px 16px' }}>
          <span className="tl-empty-card-mark">
            <Trophy className="h-6 w-6" />
          </span>
          <span className="tl-empty-card-label">{txt.noBracketTitle}</span>
          <span className="tl-empty-card-hint">{txt.noBracketHint}</span>
        </div>
      </div>
    );
  }

  // Find the champion (winner of round 1 = final)
  const finalMatch = matchesByRound[1]?.[0];
  const champion = finalMatch?.winner_team_id
    ? (finalMatch.winner_team_id === finalMatch.team_a_id
        ? (finalMatch.team_a as any)?.team_name
        : (finalMatch.team_b as any)?.team_name)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Champion banner */}
      {champion && (
        <div
          style={{
            ...surfaceCard,
            borderColor: 'var(--tl-gold)',
            background: 'rgba(233, 182, 73, 0.10)',
            padding: '16px 20px',
            textAlign: 'center',
          }}
        >
          <Trophy
            className="h-8 w-8 mx-auto mb-2"
            style={{ color: 'var(--tl-gold)' }}
          />
          <div
            style={{
              ...fieldLabel,
              color: 'var(--tl-gold)',
              marginBottom: 4,
            }}
          >
            {txt.champion}
          </div>
          <h3
            style={{
              fontFamily: 'Instrument Serif, serif',
              fontStyle: 'italic',
              fontSize: 24,
              fontWeight: 400,
              color: 'var(--tl-fg)',
              letterSpacing: '-0.015em',
              margin: 0,
            }}
          >
            {champion}
          </h3>
        </div>
      )}

      {/* Bracket display */}
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 24, minWidth: 'max-content', padding: 4 }}>
          {rounds.map((round) => {
            const roundMatches = matchesByRound[round];
            const roundName = ROUND_NAMES[round] || txt.fallbackRound(round);

            return (
              <div key={round} style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 240 }}>
                <h4
                  style={{
                    ...fieldLabel,
                    textAlign: 'center',
                    color: 'var(--tl-fg-3)',
                    margin: 0,
                  }}
                >
                  {roundName}
                </h4>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, justifyContent: 'space-around', flex: 1 }}>
                  {roundMatches
                    .sort((a, b) => (a.bracket_position || 0) - (b.bracket_position || 0))
                    .map((match) => renderMatchCard({
                      match,
                      userTeamId,
                      isOwner,
                      canEditScores,
                      isThirdPlace: false,
                      thirdPlaceTbd: txt.thirdPlaceTbd,
                      txt,
                      onMatchClick,
                      onLineupClick,
                      onScoreMatch,
                    }))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Third-place match */}
      {thirdPlaceMatch && (
        <div style={{ marginTop: 8 }}>
          <h4
            style={{
              ...fieldLabel,
              textAlign: 'center',
              color: 'var(--tl-gold)',
              marginBottom: 10,
            }}
          >
            {txt.thirdPlace}
          </h4>
          <div style={{ maxWidth: 320, margin: '0 auto' }}>
            {renderMatchCard({
              match: thirdPlaceMatch,
              userTeamId,
              isOwner,
              canEditScores,
              isThirdPlace: true,
              thirdPlaceTbd: txt.thirdPlaceTbd,
              txt,
              onMatchClick,
              onLineupClick,
              onScoreMatch,
            })}
          </div>
        </div>
      )}
    </div>
  );
}
