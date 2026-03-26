import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Mail, LayoutGrid, Trophy, Play } from 'lucide-react';
import { useI18n } from '@/i18n';
import {
  RegisteredTeamsSummary,
  TeamOverviewCard,
  AllTeamsOverview,
} from '@/components/teamMatch';
import type { TeamMatchTeam } from '@/hooks/useTeamMatchTeams';

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

  return (
    <div className="space-y-4">
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
          onGenerateMatches={onGenerateMatches}
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
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.teamMatch.view.btcActionsTitle}</CardTitle>
            <CardDescription>
              {pendingTeamsCount > 0
                ? t.teamMatch.view.approvePendingFirst.replace('{count}', String(pendingTeamsCount))
                : t.teamMatch.view.inviteOrSchedule}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onShowInviteTeam}>
              <Mail className="h-4 w-4 mr-2" />
              {t.teamMatch.view.inviteTeamBtn}
            </Button>
            <Button onClick={onShowGroupSetup} disabled={!canStartGroupSetup}>
              <LayoutGrid className="h-4 w-4 mr-2" />
              {t.teamMatch.view.createGroupsBtn} ({approvedTeamsCount} {t.teamMatch.teams})
            </Button>
          </CardContent>
          {pendingTeamsCount > 0 && (
            <CardContent className="pt-0">
              <p className="text-xs text-amber-600">
                ⚠️ {t.teamMatch.view.approveAllBeforeBracket}
              </p>
            </CardContent>
          )}
          {approvedTeamsCount < 6 && pendingTeamsCount === 0 && (
            <CardContent className="pt-0">
              <p className="text-xs text-amber-600">
                ⚠️ {t.teamMatch.view.needMin6Groups}
              </p>
            </CardContent>
          )}
        </Card>
      )}

      {/* Single Elimination format actions */}
      {isOwner && isSingleElimination && tournament.status === 'registration' && !hasMatches && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.teamMatch.view.btcActionsTitle}</CardTitle>
            <CardDescription>
              {pendingTeamsCount > 0
                ? t.teamMatch.view.approvePendingBracket.replace('{count}', String(pendingTeamsCount))
                : t.teamMatch.view.inviteOrBracket}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onShowInviteTeam}>
              <Mail className="h-4 w-4 mr-2" />
              {t.teamMatch.view.inviteTeamBtn}
            </Button>
            <Button onClick={onShowSESetup} disabled={pendingTeamsCount > 0 || approvedTeamsCount < 4}>
              <Trophy className="h-4 w-4 mr-2" />
              {t.teamMatch.view.generateBracketBtn} ({approvedTeamsCount} {t.teamMatch.teams})
            </Button>
          </CardContent>
          {pendingTeamsCount > 0 && (
            <CardContent className="pt-0">
              <p className="text-xs text-amber-600">
                ⚠️ {t.teamMatch.view.approveAllBeforeBracket}
              </p>
            </CardContent>
          )}
        </Card>
      )}

      {/* Round Robin format actions */}
      {isOwner && !isGroupPlayoffFormat && !isSingleElimination && tournament.status === 'registration' && !hasMatches && (
        <Card className="border-primary/50 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t.teamMatch.view.btcActionsTitle}</CardTitle>
            <CardDescription>{t.teamMatch.view.inviteOrSchedule}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={onShowInviteTeam}>
              <Mail className="h-4 w-4 mr-2" />
              {t.teamMatch.view.inviteTeamBtn}
            </Button>
            <Button onClick={onGenerateMatches} disabled={approvedTeamsCount < 2}>
              <Play className="h-4 w-4 mr-2" />
              {t.teamMatch.view.createScheduleBtn}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
