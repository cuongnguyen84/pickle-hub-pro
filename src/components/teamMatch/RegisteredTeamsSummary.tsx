import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Check, Clock, UserCheck, AlertCircle, X, Loader2, Play } from 'lucide-react';
import { TeamMatchTeam, TeamMatchRosterMember, useTeamMatchTeamManagement } from '@/hooks/useTeamMatchTeams';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

interface RegisteredTeamsSummaryProps {
  teams: TeamMatchTeam[];
  maxRosterSize: number;
  isOwner: boolean;
  tournamentId: string;
  hasMatches?: boolean;
  onTeamClick?: (team: TeamMatchTeam) => void;
  onGenerateMatches?: () => void;
}

export function RegisteredTeamsSummary({
  teams,
  maxRosterSize,
  isOwner,
  tournamentId,
  hasMatches,
  onTeamClick,
  onGenerateMatches,
}: RegisteredTeamsSummaryProps) {
  const { updateTeamStatus, isUpdatingStatus } = useTeamMatchTeamManagement();

  // Fetch all rosters for the teams
  const { data: allRosters } = useQuery({
    queryKey: ['team-match-all-rosters', teams.map(t => t.id).join(',')],
    queryFn: async () => {
      if (teams.length === 0) return {};
      
      const { data, error } = await supabase
        .from('team_match_roster')
        .select('*')
        .in('team_id', teams.map(t => t.id));
      
      if (error) throw error;
      
      // Group by team_id
      const grouped: Record<string, TeamMatchRosterMember[]> = {};
      (data as TeamMatchRosterMember[]).forEach(member => {
        if (!grouped[member.team_id]) {
          grouped[member.team_id] = [];
        }
        grouped[member.team_id].push(member);
      });
      return grouped;
    },
    enabled: teams.length > 0,
  });

  // Group teams by status for display
  const pendingTeams = teams.filter(t => t.status === 'pending');
  const approvedTeams = teams.filter(t => t.status === 'approved');
  const rejectedTeams = teams.filter(t => t.status === 'rejected');

  const getTeamRoster = (teamId: string) => allRosters?.[teamId] || [];
  
  const getCaptainName = (teamId: string) => {
    const roster = getTeamRoster(teamId);
    const captain = roster.find(m => m.is_captain);
    return captain?.player_name || 'N/A';
  };

  const getRosterCount = (teamId: string) => {
    return getTeamRoster(teamId).length;
  };

  const isRosterFull = (teamId: string) => {
    return getRosterCount(teamId) >= maxRosterSize;
  };

  const handleApprove = async (e: React.MouseEvent, teamId: string) => {
    e.stopPropagation();
    await updateTeamStatus({ teamId, status: 'approved', tournamentId });
  };

  const handleReject = async (e: React.MouseEvent, teamId: string) => {
    e.stopPropagation();
    await updateTeamStatus({ teamId, status: 'rejected', tournamentId });
  };

  if (teams.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Chưa có đội nào đăng ký</p>
        </CardContent>
      </Card>
    );
  }

  const renderTeamRow = (team: TeamMatchTeam) => {
    const rosterCount = getRosterCount(team.id);
    const isFull = isRosterFull(team.id);
    
    return (
      <div 
        key={team.id}
        className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer gap-2"
        onClick={() => onTeamClick?.(team)}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Users className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{team.team_name}</p>
            <p className="text-xs text-muted-foreground truncate">
              Đội trưởng: {getCaptainName(team.id)}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <Badge 
            variant="outline" 
            className={isFull ? 'bg-green-500/10 text-green-600 border-green-500/20' : 'bg-orange-500/10 text-orange-600 border-orange-500/20'}
          >
            {isFull ? (
              <>
                <UserCheck className="h-3 w-3 mr-1" />
                Đủ đội
              </>
            ) : (
              <>
                <AlertCircle className="h-3 w-3 mr-1" />
                {rosterCount}/{maxRosterSize}
              </>
            )}
          </Badge>
          <Badge variant="outline" className={STATUS_COLORS[team.status]}>
            {team.status === 'approved' && <Check className="h-3 w-3 mr-1" />}
            {team.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
            {STATUS_LABELS[team.status]}
          </Badge>
          
          {/* Approve/Reject actions for owner */}
          {isOwner && team.status === 'pending' && (
            <div className="flex items-center gap-1 ml-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
                onClick={(e) => handleApprove(e, team.id)}
                disabled={isUpdatingStatus}
              >
                {isUpdatingStatus ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-100"
                onClick={(e) => handleReject(e, team.id)}
                disabled={isUpdatingStatus}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
          
          {/* Re-approve action for rejected teams */}
          {isOwner && team.status === 'rejected' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100 ml-1"
              onClick={(e) => handleApprove(e, team.id)}
              disabled={isUpdatingStatus}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4" />
          Đội đã đăng ký ({teams.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="flex items-center gap-2 p-2 rounded bg-green-500/10 text-green-600">
            <Check className="h-4 w-4" />
            <span>{approvedTeams.length} đã duyệt</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-yellow-500/10 text-yellow-600">
            <Clock className="h-4 w-4" />
            <span>{pendingTeams.length} chờ duyệt</span>
          </div>
          <div className="flex items-center gap-2 p-2 rounded bg-muted text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>{rejectedTeams.length} từ chối</span>
          </div>
        </div>

        {/* Quick action: Generate matches button for BTC */}
        {isOwner && !hasMatches && approvedTeams.length >= 2 && onGenerateMatches && (
          <Button 
            onClick={onGenerateMatches}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            Tạo lịch thi đấu ({approvedTeams.length} đội)
          </Button>
        )}

        {/* Team list - show pending first for owner, then approved */}
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {isOwner && pendingTeams.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground">Cần duyệt</p>
              {pendingTeams.map(renderTeamRow)}
            </>
          )}
          
          {approvedTeams.length > 0 && (
            <>
              {isOwner && pendingTeams.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground mt-3">Đã duyệt</p>
              )}
              {approvedTeams.map(renderTeamRow)}
            </>
          )}

          {!isOwner && pendingTeams.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground mt-3">Đang chờ duyệt</p>
              {pendingTeams.map(renderTeamRow)}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
