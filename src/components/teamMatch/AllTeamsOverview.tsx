import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Check, Clock, ClipboardList, X } from 'lucide-react';
import { TeamMatchTeam, useTeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useTeamMatchMatches } from '@/hooks/useTeamMatchMatches';

interface AllTeamsOverviewProps {
  teams: TeamMatchTeam[];
  tournamentId: string;
  maxRosterSize: number;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  approved: 'bg-green-500/10 text-green-600 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Chờ duyệt',
  approved: 'Đã duyệt',
  rejected: 'Từ chối',
};

function TeamLineupStatus({ teamId, tournamentId }: { teamId: string; tournamentId: string }) {
  const { data: matches } = useTeamMatchMatches(tournamentId);
  
  if (!matches || matches.length === 0) return null;
  
  // Check lineup status across all matches for this team
  const teamMatches = matches.filter(
    m => m.team_a_id === teamId || m.team_b_id === teamId
  );
  
  if (teamMatches.length === 0) return null;
  
  // Count submitted lineups
  const submittedCount = teamMatches.reduce((count, match) => {
    const isTeamA = match.team_a_id === teamId;
    const isSubmitted = isTeamA ? match.lineup_a_submitted : match.lineup_b_submitted;
    return count + (isSubmitted ? 1 : 0);
  }, 0);
  
  const allSubmitted = submittedCount === teamMatches.length;
  
  return (
    <Badge 
      variant="outline" 
      className={allSubmitted 
        ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' 
        : 'bg-muted text-muted-foreground'
      }
    >
      <ClipboardList className="h-3 w-3 mr-1" />
      {allSubmitted ? 'Đã line up' : `Line up: ${submittedCount}/${teamMatches.length}`}
    </Badge>
  );
}

function TeamRosterCount({ teamId, maxRosterSize }: { teamId: string; maxRosterSize: number }) {
  const { roster } = useTeamMatchTeam(teamId);
  const count = roster.length;
  const isFull = count >= maxRosterSize;
  
  return (
    <Badge variant={isFull ? 'default' : 'secondary'}>
      <Users className="h-3 w-3 mr-1" />
      {count}/{maxRosterSize}
    </Badge>
  );
}

export function AllTeamsOverview({ teams, tournamentId, maxRosterSize }: AllTeamsOverviewProps) {
  // Filter out rejected teams
  const visibleTeams = teams.filter(t => t.status !== 'rejected');
  
  if (visibleTeams.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Chưa có đội nào đăng ký</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Danh sách đội ({visibleTeams.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibleTeams.map((team) => (
          <div
            key={team.id}
            className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="font-medium text-base truncate">{team.team_name}</p>
            </div>
            
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Roster count */}
              <TeamRosterCount teamId={team.id} maxRosterSize={maxRosterSize} />
              
              {/* Approval status */}
              <Badge variant="outline" className={STATUS_COLORS[team.status]}>
                {team.status === 'approved' && <Check className="h-3 w-3 mr-1" />}
                {team.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                {team.status === 'rejected' && <X className="h-3 w-3 mr-1" />}
                {STATUS_LABELS[team.status]}
              </Badge>
              
              {/* Lineup status (only shown if matches exist) */}
              <TeamLineupStatus teamId={team.id} tournamentId={tournamentId} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
