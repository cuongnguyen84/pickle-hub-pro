import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Crown, ChevronRight } from 'lucide-react';
import { TeamMatchTeam, useTeamMatchTeam } from '@/hooks/useTeamMatchTeams';

interface TeamRosterDisplayProps {
  team: TeamMatchTeam;
  maxRosterSize: number;
  onManageClick: () => void;
}

export function TeamRosterDisplay({ team, maxRosterSize, onManageClick }: TeamRosterDisplayProps) {
  const { roster, isLoading } = useTeamMatchTeam(team.id);
  
  const rosterCount = roster.length;
  const isFull = rosterCount >= maxRosterSize;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="h-5 w-5" />
            {team.team_name}
          </CardTitle>
          <Badge variant={isFull ? 'default' : 'secondary'}>
            {rosterCount}/{maxRosterSize}
            {isFull ? ' ✓ Đủ đội' : ' - Chưa đủ'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Roster list - large, mobile-friendly */}
        <div className="space-y-3">
          {roster.map((member) => (
            <div 
              key={member.id} 
              className="flex items-center justify-between p-4 rounded-xl bg-muted/50 border"
            >
              <div className="flex items-center gap-3">
                {member.is_captain && (
                  <div className="h-8 w-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Crown className="h-4 w-4 text-amber-600" />
                  </div>
                )}
                {!member.is_captain && (
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div>
                  <p className="text-lg font-medium">{member.player_name}</p>
                  {member.is_captain && (
                    <p className="text-xs text-muted-foreground">Đội trưởng</p>
                  )}
                </div>
              </div>
              <Badge variant="outline" className="text-base px-3 py-1">
                {member.gender === 'male' ? 'Nam' : 'Nữ'}
              </Badge>
            </div>
          ))}
        </div>

        {/* Empty slots */}
        {!isFull && (
          <div className="space-y-2">
            {Array.from({ length: maxRosterSize - rosterCount }).map((_, i) => (
              <div 
                key={i} 
                className="flex items-center justify-center p-4 rounded-xl border-2 border-dashed text-muted-foreground"
              >
                <span className="text-base">Vị trí trống {rosterCount + i + 1}</span>
              </div>
            ))}
          </div>
        )}

        {/* Action button */}
        <Button onClick={onManageClick} className="w-full" size="lg">
          Quản lý đội
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
