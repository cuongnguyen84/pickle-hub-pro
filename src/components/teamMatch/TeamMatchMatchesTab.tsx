import { Gamepad2, Play, Trophy } from 'lucide-react';
import { useI18n } from '@/i18n';
import {
  MatchList,
  GroupMatchList,
  PlayoffBracket,
} from '@/components/teamMatch';
import type { TeamMatchMatch } from '@/hooks/useTeamMatchMatches';
import type { TeamMatchTeam } from '@/hooks/useTeamMatchTeams';

interface TeamMatchMatchesTabProps {
  tournament: {
    id: string;
    format: string;
    status: string;
    has_dreambreaker: boolean;
    has_third_place_match?: boolean;
  };
  isOwner: boolean;
  userTeam: TeamMatchTeam | null;
  matches: TeamMatchMatch[] | undefined;
  hasMatches: boolean;
  hasGroups: boolean;
  hasPlayoff: boolean;
  roundRobinComplete: boolean;
  standings: Array<{ team: { id: string } }>;
  approvedTeamsCount: number;
  pendingTeamsCount: number;
  userRole: { canEditScores: boolean };
  isUpdatingStatus: boolean;
  onGenerateMatches: () => void;
  onShowSESetup: () => void;
  onShowStartTournament: () => void;
  onShowPlayoffDialog: () => void;
  onMatchClick: (match: TeamMatchMatch) => void;
  onLineupClick: (match: TeamMatchMatch, teamId?: string) => void;
  onStartRound: (roundNumber: number) => void;
  onScoreMatch: (match: TeamMatchMatch) => void;
  onStartTournament: () => void;
}

// ─── W2.4a shared tokens (mirror QuickTable cluster) ─────────────────────
const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 22,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
};

const promptTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 18,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
};

const promptSub: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11.5,
  color: 'var(--tl-fg-3)',
  letterSpacing: '0.02em',
  marginTop: 4,
};

interface ActionPromptProps {
  accent: 'neutral' | 'green' | 'gold';
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
  ctaIcon: React.ReactNode;
  ctaVariant: 'neutral' | 'green' | 'gold';
  ctaDisabled?: boolean;
  onCtaClick: () => void;
}

/**
 * W2.4a — BTC action prompt card. Replaces the four shadcn `<Card>` blocks
 * that used Tailwind palette borders (border-primary/50, border-green-500/50,
 * border-yellow-500/50). Accent maps to TheLine token glow + ring.
 */
function ActionPrompt({
  accent,
  icon,
  title,
  description,
  ctaLabel,
  ctaIcon,
  ctaVariant,
  ctaDisabled,
  onCtaClick,
}: ActionPromptProps) {
  const ringByAccent: Record<typeof accent, string> = {
    neutral: 'var(--tl-border-2)',
    green: 'var(--tl-green)',
    gold: 'var(--tl-gold)',
  };
  const glowByAccent: Record<typeof accent, string> = {
    neutral: 'transparent',
    green: 'var(--tl-green-glow)',
    gold: 'rgba(233, 182, 73, 0.10)',
  };
  const iconColorByAccent: Record<typeof accent, string> = {
    neutral: 'var(--tl-fg-2)',
    green: 'var(--tl-green)',
    gold: 'var(--tl-gold)',
  };

  const ctaStyleByVariant: Record<typeof ctaVariant, React.CSSProperties> = {
    neutral: {},
    green: {},
    gold: {
      background: 'var(--tl-gold)',
      color: 'var(--tl-bg)',
      borderColor: 'var(--tl-gold)',
    },
  };

  return (
    <div
      style={{
        ...surfaceCard,
        borderColor: ringByAccent[accent],
        background: accent === 'neutral' ? 'var(--tl-bg-elev)' : glowByAccent[accent],
        padding: '14px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            borderRadius: 'var(--tl-radius)',
            background: 'var(--tl-surface)',
            color: iconColorByAccent[accent],
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <div style={{ minWidth: 0 }}>
          <p style={promptTitle}>{title}</p>
          <p style={promptSub}>{description}</p>
        </div>
      </div>
      <button
        type="button"
        className={ctaVariant === 'green' ? 'tl-btn green' : 'tl-btn'}
        style={{
          padding: '8px 14px',
          fontSize: 12.5,
          opacity: ctaDisabled ? 0.5 : 1,
          cursor: ctaDisabled ? 'not-allowed' : 'pointer',
          ...ctaStyleByVariant[ctaVariant],
        }}
        disabled={ctaDisabled}
        onClick={onCtaClick}
      >
        {ctaIcon}
        {ctaLabel}
      </button>
    </div>
  );
}

export function TeamMatchMatchesTab({
  tournament,
  isOwner,
  userTeam,
  matches,
  hasMatches,
  hasGroups,
  hasPlayoff,
  roundRobinComplete,
  standings,
  approvedTeamsCount,
  pendingTeamsCount,
  userRole,
  isUpdatingStatus,
  onGenerateMatches,
  onShowSESetup,
  onShowStartTournament,
  onShowPlayoffDialog,
  onMatchClick,
  onLineupClick,
  onStartRound,
  onScoreMatch,
  onStartTournament,
}: TeamMatchMatchesTabProps) {
  const { t, language } = useI18n();
  const v = t.teamMatch.view;
  const isSingleElimination = tournament.format === 'single_elimination';
  const roundRobinMatches = matches?.filter(m => !m.is_playoff) || [];
  const playoffMatches = matches?.filter(m => m.is_playoff) || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Generate matches (RR) */}
      {isOwner && !hasMatches && tournament.status !== 'completed' && !isSingleElimination && (
        <ActionPrompt
          accent="neutral"
          icon={<Play className="h-5 w-5" />}
          title={v.createSchedule}
          description={v.teamsReadyForSchedule.replace('{count}', String(approvedTeamsCount))}
          ctaLabel={v.createScheduleBtn}
          ctaIcon={<Play className="h-4 w-4" />}
          ctaVariant="neutral"
          ctaDisabled={approvedTeamsCount < 2}
          onCtaClick={onGenerateMatches}
        />
      )}

      {/* Generate bracket (SE) */}
      {isOwner && !hasMatches && tournament.status !== 'completed' && isSingleElimination && (
        <ActionPrompt
          accent="neutral"
          icon={<Trophy className="h-5 w-5" />}
          title={v.generateBracketBtn}
          description={v.teamsReadySE.replace('{count}', String(approvedTeamsCount))}
          ctaLabel={v.generateBracketBtn}
          ctaIcon={<Trophy className="h-4 w-4" />}
          ctaVariant="neutral"
          ctaDisabled={approvedTeamsCount < 4 || pendingTeamsCount > 0}
          onCtaClick={onShowSESetup}
        />
      )}

      {/* Start tournament */}
      {isOwner && hasMatches && tournament.status === 'registration' && (
        <ActionPrompt
          accent="green"
          icon={<Play className="h-5 w-5" />}
          title={v.startTournamentLabel}
          description={v.matchesGeneratedCount.replace('{count}', String(matches?.length))}
          ctaLabel={v.startBtn}
          ctaIcon={<Play className="h-4 w-4" />}
          ctaVariant="green"
          onCtaClick={onShowStartTournament}
        />
      )}

      {/* Create Playoff */}
      {isOwner && roundRobinComplete && !hasPlayoff && (
        <ActionPrompt
          accent="gold"
          icon={<Trophy className="h-5 w-5" />}
          title={v.createPlayoffTitle}
          description={v.roundRobinDone.replace('{count}', String(standings.length))}
          ctaLabel={v.createPlayoff}
          ctaIcon={<Trophy className="h-4 w-4" />}
          ctaVariant="gold"
          onCtaClick={onShowPlayoffDialog}
        />
      )}

      {/* Playoff bracket */}
      {playoffMatches.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3
            style={{
              ...sectionTitle,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Trophy className="h-5 w-5" style={{ color: 'var(--tl-gold)' }} />
            {isSingleElimination ? v.seBracketTitle : v.playoffRound}
          </h3>
          <PlayoffBracket
            matches={playoffMatches}
            userTeamId={userTeam?.id}
            isOwner={isOwner}
            canEditScores={userRole.canEditScores}
            onMatchClick={onMatchClick}
            onLineupClick={(match, teamId) => onLineupClick(match, teamId)}
            onScoreMatch={onScoreMatch}
            isSingleElimination={isSingleElimination}
          />
        </div>
      )}

      {/* Group-based matches */}
      {hasGroups && roundRobinMatches.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3
            style={{
              ...sectionTitle,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Gamepad2 className="h-5 w-5" style={{ color: 'var(--tl-fg-2)' }} />
            {v.groupStageTitle}
          </h3>
          <GroupMatchList
            tournamentId={tournament.id}
            userTeamId={userTeam?.id}
            isOwner={isOwner}
            canEditScores={userRole.canEditScores}
            onMatchClick={onMatchClick}
            onLineupClick={(match, teamId) => onLineupClick(match, teamId)}
            onStartRound={onStartRound}
            onScoreMatch={onScoreMatch}
          />
        </div>
      )}

      {/* Regular RR matches */}
      {!hasGroups && roundRobinMatches.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h3
            style={{
              ...sectionTitle,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <Gamepad2 className="h-5 w-5" style={{ color: 'var(--tl-fg-2)' }} />
            {v.roundRobinTitle}
          </h3>
          <MatchList
            tournamentId={tournament.id}
            userTeamId={userTeam?.id}
            isOwner={isOwner}
            canEditScores={userRole.canEditScores}
            onMatchClick={onMatchClick}
            onLineupClick={(match, teamId) => onLineupClick(match, teamId)}
            onStartRound={onStartRound}
            onScoreMatch={onScoreMatch}
          />
        </div>
      )}

      {/* Empty */}
      {!hasMatches && !isOwner && (
        <div style={{ ...surfaceCard, padding: 32 }}>
          <div className="tl-empty-card" style={{ margin: 0, padding: '24px 16px' }}>
            <span className="tl-empty-card-mark">
              <Gamepad2 className="h-6 w-6" />
            </span>
            <span className="tl-empty-card-label">{v.noMatchesEmpty}</span>
            <span className="tl-empty-card-hint">
              {language === 'vi'
                ? v.noMatchesScheduleDesc
                : v.noMatchesScheduleDesc}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
