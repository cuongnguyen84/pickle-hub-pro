import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Crown, Clock, Check, X } from 'lucide-react';
import { TeamMatchTeam, useTeamMatchTeam } from '@/hooks/useTeamMatchTeams';

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

interface TeamOverviewCardProps {
  team: TeamMatchTeam;
  maxRosterSize: number;
  totalTeamsRegistered: number;
}

export function TeamOverviewCard({ team, maxRosterSize, totalTeamsRegistered }: TeamOverviewCardProps) {
  const { roster } = useTeamMatchTeam(team.id);
  
  const rosterCount = roster.length;
  const isFull = rosterCount >= maxRosterSize;

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            Đội của bạn
          </CardTitle>
          <Badge variant="outline" className={STATUS_COLORS[team.status]}>
            {team.status === 'approved' && <Check className="h-3 w-3 mr-1" />}
            {team.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
            {team.status === 'rejected' && <X className="h-3 w-3 mr-1" />}
            {STATUS_LABELS[team.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Team name */}
        <div>
          <h3 className="text-lg font-semibold">{team.team_name}</h3>
          <p className="text-sm text-muted-foreground">
            Bạn là đội trưởng của đội này
          </p>
        </div>

        {/* Summary info - NO member list */}
        <div className="grid grid-cols-2 gap-3">
          {/* Roster status */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Thành viên</span>
            </div>
            <Badge variant={isFull ? 'default' : 'secondary'}>
              {rosterCount}/{maxRosterSize}
            </Badge>
          </div>

          {/* Roster completeness */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
            <span className="text-sm">Trạng thái</span>
            <Badge variant={isFull ? 'default' : 'outline'} className={isFull ? '' : 'text-yellow-600 border-yellow-500/20'}>
              {isFull ? '✓ Đủ đội' : 'Chưa đủ'}
            </Badge>
          </div>
        </div>

        {/* Tournament info */}
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-sm text-muted-foreground">
            Giải đấu có <span className="font-semibold text-foreground">{totalTeamsRegistered}</span> đội đã đăng ký
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
