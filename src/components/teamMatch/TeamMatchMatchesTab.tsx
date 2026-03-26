import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  standings: Array<{ teamId: string }>;
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
  const { t } = useI18n();
  const isSingleElimination = tournament.format === 'single_elimination';
  const roundRobinMatches = matches?.filter(m => !m.is_playoff) || [];
  const playoffMatches = matches?.filter(m => m.is_playoff) || [];

  return (
    <div className="space-y-4">
      {/* Generate matches (RR) */}
      {isOwner && !hasMatches && tournament.status !== 'completed' && !isSingleElimination && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{t.teamMatch.view.createSchedule}</p>
              <p className="text-sm text-muted-foreground">
                {t.teamMatch.view.teamsReadyForSchedule.replace('{count}', String(approvedTeamsCount))}
              </p>
            </div>
            <Button onClick={onGenerateMatches} disabled={approvedTeamsCount < 2}>
              <Play className="h-4 w-4 mr-2" />
              {t.teamMatch.view.createScheduleBtn}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generate bracket (SE) */}
      {isOwner && !hasMatches && tournament.status !== 'completed' && isSingleElimination && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{t.teamMatch.view.generateBracketBtn}</p>
              <p className="text-sm text-muted-foreground">
                {t.teamMatch.view.teamsReadySE.replace('{count}', String(approvedTeamsCount))}
              </p>
            </div>
            <Button onClick={onShowSESetup} disabled={approvedTeamsCount < 4 || pendingTeamsCount > 0}>
              <Trophy className="h-4 w-4 mr-2" />
              {t.teamMatch.view.generateBracketBtn}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Start tournament */}
      {isOwner && hasMatches && tournament.status === 'registration' && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-green-600">{t.teamMatch.view.startTournamentLabel}</p>
              <p className="text-sm text-muted-foreground">
                {t.teamMatch.view.matchesGeneratedCount.replace('{count}', String(matches?.length))}
              </p>
            </div>
            <Button onClick={onShowStartTournament} className="bg-green-600 hover:bg-green-700">
              <Play className="h-4 w-4 mr-2" />
              {t.teamMatch.view.startBtn}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Create Playoff */}
      {isOwner && roundRobinComplete && !hasPlayoff && (
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="py-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-yellow-600">{t.teamMatch.view.createPlayoffTitle}</p>
              <p className="text-sm text-muted-foreground">
                {t.teamMatch.view.roundRobinDone.replace('{count}', String(standings.length))}
              </p>
            </div>
            <Button onClick={onShowPlayoffDialog} className="bg-yellow-600 hover:bg-yellow-700">
              <Trophy className="h-4 w-4 mr-2" />
              {t.teamMatch.view.createPlayoff}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Playoff bracket */}
      {playoffMatches.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            {isSingleElimination ? t.teamMatch.view.seBracketTitle : t.teamMatch.view.playoffRound}
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
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Gamepad2 className="h-5 w-5" />
            {t.teamMatch.view.groupStageTitle}
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
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Gamepad2 className="h-5 w-5" />
            {t.teamMatch.view.roundRobinTitle}
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
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t.teamMatch.view.noMatchesEmpty}</p>
            <p className="text-sm mt-1">{t.teamMatch.view.noMatchesScheduleDesc}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
