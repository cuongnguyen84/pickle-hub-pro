import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Crown, Clock, Check, X, ChevronRight } from 'lucide-react';
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

interface MyTeamCardProps {
  team: TeamMatchTeam;
  maxRosterSize: number;
  onManageClick: () => void;
}

export function MyTeamCard({ team, maxRosterSize, onManageClick }: MyTeamCardProps) {
  const { roster, isLoading } = useTeamMatchTeam(team.id);
  
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
        {/* Team name and status */}
        <div>
          <h3 className="text-lg font-semibold">{team.team_name}</h3>
          <p className="text-sm text-muted-foreground">
            Bạn là đội trưởng của đội này
          </p>
        </div>

        {/* Roster status */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Thành viên</span>
          </div>
          <Badge variant={isFull ? 'default' : 'secondary'}>
            {rosterCount}/{maxRosterSize}
            {isFull ? ' ✓ Đủ đội' : ' - Chưa đủ'}
          </Badge>
        </div>

        {/* Quick roster preview */}
        {!isLoading && roster.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Danh sách thành viên:</p>
            <div className="flex flex-wrap gap-1">
              {roster.slice(0, 6).map((member) => (
                <Badge key={member.id} variant="outline" className="text-xs">
                  {member.is_captain && <Crown className="h-3 w-3 mr-1 text-amber-500" />}
                  {member.player_name}
                  <span className="ml-1 opacity-60">
                    ({member.gender === 'male' ? 'Nam' : 'Nữ'})
                  </span>
                </Badge>
              ))}
              {roster.length > 6 && (
                <Badge variant="outline" className="text-xs">
                  +{roster.length - 6}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Action button */}
        <Button onClick={onManageClick} className="w-full">
          Quản lý đội
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
