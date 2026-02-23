import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Users, Crown, Clock, Check, X, ChevronRight } from 'lucide-react';
import { TeamMatchTeam, useTeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useI18n } from '@/i18n';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  approved: 'bg-green-500/10 text-green-600 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
};

interface MyTeamCardProps {
  team: TeamMatchTeam;
  maxRosterSize: number;
  onManageClick: () => void;
}

export function MyTeamCard({ team, maxRosterSize, onManageClick }: MyTeamCardProps) {
  const { roster, isLoading } = useTeamMatchTeam(team.id);
  const { t } = useI18n();
  const c = t.teamMatchComponents;

  const STATUS_LABELS: Record<string, string> = {
    pending: c.statusPending,
    approved: c.statusApproved,
    rejected: c.statusRejected,
  };
  
  const rosterCount = roster.length;
  const isFull = rosterCount >= maxRosterSize;

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Crown className="h-4 w-4 text-amber-500" />
            {c.yourTeam}
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
        <div>
          <h3 className="text-lg font-semibold">{team.team_name}</h3>
          <p className="text-sm text-muted-foreground">
            {c.youAreCaptain}
          </p>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg bg-background border">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{c.members}</span>
          </div>
          <Badge variant={isFull ? 'default' : 'secondary'}>
            {rosterCount}/{maxRosterSize}
            {isFull ? ` ✓ ${c.rosterFull}` : ` - ${c.rosterIncomplete}`}
          </Badge>
        </div>

        {!isLoading && roster.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{c.memberList}</p>
            <div className="space-y-2">
              {roster.map((member) => (
                <div 
                  key={member.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-background border"
                >
                  <div className="flex items-center gap-2">
                    {member.is_captain && <Crown className="h-4 w-4 text-amber-500" />}
                    <span className="text-base font-medium">{member.player_name}</span>
                  </div>
                  <Badge variant="secondary" className="text-sm">
                    {member.gender === 'male' ? c.male : c.female}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button onClick={onManageClick} className="w-full">
          {c.manageTeam}
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
