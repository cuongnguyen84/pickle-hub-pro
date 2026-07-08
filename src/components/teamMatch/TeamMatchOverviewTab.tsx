import { Mail, LayoutGrid, Trophy, Play, AlertTriangle } from 'lucide-react';
import { useI18n } from '@/i18n';
import {
  RegisteredTeamsSummary,
  TeamOverviewCard,
  AllTeamsOverview,
} from '@/components/teamMatch';
import type { TeamMatchTeam } from '@/hooks/useTeamMatchTeams';

// ─── W2.4b shared tokens (mirror MatchList/PlayoffBracket from #103) ─────
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

const sectionDescription: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--tl-fg-2)',
  marginTop: 4,
};

const warningStripe: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  marginTop: 12,
  padding: '8px 10px',
  borderRadius: 'var(--tl-radius)',
  background: 'rgba(233, 182, 73, 0.08)',
  border: '1px solid rgba(233, 182, 73, 0.35)',
  color: 'var(--tl-fg-2)',
  fontSize: 12.5,
};

interface TeamMatchOverviewTabProps {
  tournament: {
    id: string;
    format: string;
    status: string;
    team_roster_size: number;
    top_per_group?: number;
  };
  isOwner: boolean;
  userTeam: TeamMatchTeam | null;
  displayTeams: TeamMatchTeam[];
  hasMatches: boolean;
  hasGroups: boolean;
  approvedTeamsCount: number;
  pendingTeamsCount: number;
  canStartGroupSetup: boolean;
  onTeamClick: (team: TeamMatchTeam) => void;
  onGenerateMatches: () => void;
  onShowInviteTeam: () => void;
  onShowGroupSetup: () => void;
  onShowSESetup: () => void;
}

export function TeamMatchOverviewTab({
  tournament,
  isOwner,
  userTeam,
  displayTeams,
  hasMatches,
  hasGroups,
  approvedTeamsCount,
  pendingTeamsCount,
  canStartGroupSetup,
  onTeamClick,
  onGenerateMatches,
  onShowInviteTeam,
  onShowGroupSetup,
  onShowSESetup,
}: TeamMatchOverviewTabProps) {
  const { t } = useI18n();
  const isGroupPlayoffFormat = tournament.format === 'rr_playoff';
  const isSingleElimination = tournament.format === 'single_elimination';

  const renderActionCard = (
    description: string,
    actions: React.ReactNode,
    warnings: string[] = [],
  ) => (
    <section style={{ ...surfaceCard, padding: 16 }}>
      <header style={{ marginBottom: 12 }}>
        <h3 style={sectionTitle}>{t.teamMatch.view.btcActionsTitle}</h3>
        <p style={sectionDescription}>{description}</p>
      </header>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {actions}
      </div>
      {warnings.map((msg, idx) => (
        <div key={idx} style={warningStripe}>
          <AlertTriangle className="h-4 w-4 mt-0.5" style={{ color: 'var(--tl-gold)', flexShrink: 0 }} />
          <span>{msg}</span>
        </div>
      ))}
    </section>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {userTeam && !isOwner && (
        <>
          <TeamOverviewCard
            team={userTeam}
            maxRosterSize={tournament.team_roster_size}
            totalTeamsRegistered={displayTeams.length}
          />
          <AllTeamsOverview
            teams={displayTeams}
            tournamentId={tournament.id}
            maxRosterSize={tournament.team_roster_size}
          />
        </>
      )}

      {isOwner && displayTeams.length > 0 && (
        <RegisteredTeamsSummary
          teams={displayTeams}
          maxRosterSize={tournament.team_roster_size}
          isOwner={isOwner}
          tournamentId={tournament.id}
          hasMatches={hasMatches}
          onTeamClick={onTeamClick}
          // Group/single-elim schedule from Chia bảng / bracket, not a flat
          // all-teams RR — only offer the flat generator for plain round robin.
          onGenerateMatches={isGroupPlayoffFormat || isSingleElimination ? undefined : onGenerateMatches}
        />
      )}

      {!isOwner && !userTeam && displayTeams.length > 0 && (
        <RegisteredTeamsSummary
          teams={displayTeams}
          maxRosterSize={tournament.team_roster_size}
          isOwner={false}
          tournamentId={tournament.id}
          onTeamClick={onTeamClick}
        />
      )}

      {/* Group Playoff format actions */}
      {isOwner && isGroupPlayoffFormat && tournament.status === 'registration' && !hasGroups && (
        renderActionCard(
          pendingTeamsCount > 0
            ? t.teamMatch.view.approvePendingFirst.replace('{count}', String(pendingTeamsCount))
            : t.teamMatch.view.inviteOrSchedule,
          (
            <>
              <button type="button" className="tl-btn" onClick={onShowInviteTeam}>
                <Mail className="h-4 w-4" />
                {t.teamMatch.view.inviteTeamBtn}
              </button>
              <button
                type="button"
                className="tl-btn green"
                onClick={onShowGroupSetup}
                disabled={!canStartGroupSetup}
                style={!canStartGroupSetup ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                <LayoutGrid className="h-4 w-4" />
                {t.teamMatch.view.createGroupsBtn} ({approvedTeamsCount} {t.teamMatch.teams})
              </button>
            </>
          ),
          [
            ...(pendingTeamsCount > 0 ? [t.teamMatch.view.approveAllBeforeBracket] : []),
            ...(approvedTeamsCount < 6 && pendingTeamsCount === 0 ? [t.teamMatch.view.needMin6Groups] : []),
          ],
        )
      )}

      {/* Single Elimination format actions */}
      {isOwner && isSingleElimination && tournament.status === 'registration' && !hasMatches && (
        renderActionCard(
          pendingTeamsCount > 0
            ? t.teamMatch.view.approvePendingBracket.replace('{count}', String(pendingTeamsCount))
            : t.teamMatch.view.inviteOrBracket,
          (
            <>
              <button type="button" className="tl-btn" onClick={onShowInviteTeam}>
                <Mail className="h-4 w-4" />
                {t.teamMatch.view.inviteTeamBtn}
              </button>
              <button
                type="button"
                className="tl-btn green"
                onClick={onShowSESetup}
                disabled={pendingTeamsCount > 0 || approvedTeamsCount < 4}
                style={pendingTeamsCount > 0 || approvedTeamsCount < 4 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                <Trophy className="h-4 w-4" />
                {t.teamMatch.view.generateBracketBtn} ({approvedTeamsCount} {t.teamMatch.teams})
              </button>
            </>
          ),
          pendingTeamsCount > 0 ? [t.teamMatch.view.approveAllBeforeBracket] : [],
        )
      )}

      {/* Round Robin format actions */}
      {isOwner && !isGroupPlayoffFormat && !isSingleElimination && tournament.status === 'registration' && !hasMatches && (
        renderActionCard(
          t.teamMatch.view.inviteOrSchedule,
          (
            <>
              <button type="button" className="tl-btn" onClick={onShowInviteTeam}>
                <Mail className="h-4 w-4" />
                {t.teamMatch.view.inviteTeamBtn}
              </button>
              <button
                type="button"
                className="tl-btn green"
                onClick={onGenerateMatches}
                disabled={approvedTeamsCount < 2}
                style={approvedTeamsCount < 2 ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                <Play className="h-4 w-4" />
                {t.teamMatch.view.createScheduleBtn}
              </button>
            </>
          ),
        )
      )}
    </div>
  );
}
