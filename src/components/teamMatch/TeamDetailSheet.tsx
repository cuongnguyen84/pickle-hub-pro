import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { TeamRosterManager } from './TeamRosterManager';
import { TeamJoinPanel } from './TeamJoinPanel';
import { TeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';

// ─── W2.4d shared tokens ─────────────────────────────────────────────────
const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 20,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
};

const statusPillBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10.5,
  fontWeight: 500,
  padding: '3px 9px',
  borderRadius: 4,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  whiteSpace: 'nowrap',
};

type StatusKind = 'approved' | 'pending' | 'rejected';

function statusPillStyle(kind: StatusKind): React.CSSProperties {
  if (kind === 'approved') return { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' };
  if (kind === 'pending') return { background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)' };
  return { background: 'rgba(255, 65, 54, 0.10)', color: 'var(--tl-live)' };
}

interface TeamDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: TeamMatchTeam | null;
  maxRosterSize: number;
  isOwner?: boolean;
  /** Join context — when provided, players can request to join this team. */
  tournament?: {
    status: string;
    require_dupr?: boolean;
    dupr_max_male?: number | null;
    dupr_max_female?: number | null;
  };
}

export function TeamDetailSheet({
  open,
  onOpenChange,
  team,
  maxRosterSize,
  isOwner = false,
  tournament,
}: TeamDetailSheetProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const c = t.teamMatchComponents;

  const STATUS_LABELS: Record<StatusKind, string> = {
    pending: c.statusPending,
    approved: c.statusApproved,
    rejected: c.statusRejected,
  };

  if (!team) return null;

  const isCaptain = user?.id === team.captain_user_id;
  const statusKind = team.status as StatusKind;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <SheetTitle style={sectionTitle}>{team.team_name}</SheetTitle>
            <span style={{ ...statusPillBase, ...statusPillStyle(statusKind) }}>
              {STATUS_LABELS[statusKind]}
            </span>
          </div>
          <SheetDescription
            style={{
              marginTop: 4,
              fontFamily: 'inherit',
              fontSize: 13,
              color: 'var(--tl-fg-3)',
            }}
          >
            {isOwner
              ? c.manageAsOrganizer
              : isCaptain
                ? c.youAreCaptain
                : c.viewTeamInfo}
          </SheetDescription>
        </SheetHeader>

        {tournament && (
          <div style={{ marginTop: 20 }}>
            <TeamJoinPanel
              teamId={team.id}
              teamName={team.team_name}
              tournamentId={team.tournament_id}
              teamStatus={team.status}
              tournamentStatus={tournament.status}
              isCaptain={isCaptain}
              requireDupr={tournament.require_dupr ?? false}
              duprMaxMale={tournament.dupr_max_male ?? null}
              duprMaxFemale={tournament.dupr_max_female ?? null}
            />
          </div>
        )}

        <div style={{ marginTop: 20 }}>
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
