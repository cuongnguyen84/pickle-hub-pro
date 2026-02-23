import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { TeamRosterManager } from './TeamRosterManager';
import { TeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import { useI18n } from '@/i18n';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  approved: 'bg-green-500/10 text-green-600 border-green-500/20',
  rejected: 'bg-red-500/10 text-red-600 border-red-500/20',
};

interface TeamDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: TeamMatchTeam | null;
  maxRosterSize: number;
  isOwner?: boolean;
}

export function TeamDetailSheet({
  open,
  onOpenChange,
  team,
  maxRosterSize,
  isOwner = false,
}: TeamDetailSheetProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const c = t.teamMatchComponents;

  const STATUS_LABELS: Record<string, string> = {
    pending: c.statusPending,
    approved: c.statusApproved,
    rejected: c.statusRejected,
  };

  if (!team) return null;

  const isCaptain = user?.id === team.captain_user_id;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-2">
            <SheetTitle>{team.team_name}</SheetTitle>
            <Badge variant="outline" className={STATUS_COLORS[team.status]}>
              {STATUS_LABELS[team.status]}
            </Badge>
          </div>
          <SheetDescription>
            {isOwner 
              ? c.manageAsOrganizer
              : isCaptain
                ? c.youAreCaptain
                : c.viewTeamInfo}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <TeamRosterManager
            teamId={team.id}
            maxRosterSize={maxRosterSize}
            isCaptain={isCaptain}
            isOwner={isOwner}
            inviteCode={team.invite_code}
            masterTeamId={team.master_team_id}
            tournamentId={team.tournament_id}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
