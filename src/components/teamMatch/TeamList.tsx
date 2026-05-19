import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Users, Trash2, ChevronRight, Check, Clock, X } from 'lucide-react';
import { useTeamMatchTeams, useTeamMatchTeamManagement, TeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useI18n } from '@/i18n';

// ─── W2.4b shared tokens (mirror MatchList/PlayoffBracket from #103) ─────
const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

const inlineTeamName: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 17,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
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

function onRowEnter(e: React.MouseEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.background = 'var(--tl-bg)';
}
function onRowLeave(e: React.MouseEvent<HTMLElement>) {
  (e.currentTarget as HTMLElement).style.background = 'transparent';
}

interface TeamListProps {
  tournamentId: string;
  isOwner: boolean;
  onTeamClick?: (team: TeamMatchTeam) => void;
}

export function TeamList({ tournamentId, isOwner, onTeamClick }: TeamListProps) {
  const { data: teams, isLoading } = useTeamMatchTeams(tournamentId);
  const { deleteTeam, isDeletingTeam } = useTeamMatchTeamManagement();
  const { t } = useI18n();
  const c = t.teamMatchComponents;

  const STATUS_LABELS: Record<StatusKind, string> = {
    pending: c.statusPending,
    approved: c.statusApproved,
    rejected: c.statusRejected,
  };

  const handleDelete = async (teamId: string) => {
    await deleteTeam({ teamId, tournamentId });
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const displayTeams = isOwner
    ? teams?.filter(t => t.status !== 'rejected') || []
    : teams?.filter(t => t.status === 'approved') || [];

  if (!displayTeams || displayTeams.length === 0) {
    return (
      <div style={{ ...surfaceCard, padding: 32 }}>
        <div className="tl-empty-card" style={{ margin: 0, padding: '32px 16px' }}>
          <span className="tl-empty-card-mark">
            <Users className="h-6 w-6" />
          </span>
          <span className="tl-empty-card-label">{c.noTeams}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {displayTeams.map((team) => (
        <TeamCard
          key={team.id}
          team={team}
          isOwner={isOwner}
          statusLabels={STATUS_LABELS}
          c={c}
          onDelete={() => handleDelete(team.id)}
          onClick={() => onTeamClick?.(team)}
          isProcessing={isDeletingTeam}
        />
      ))}
    </div>
  );
}

interface TeamCardProps {
  team: TeamMatchTeam;
  isOwner: boolean;
  statusLabels: Record<StatusKind, string>;
  c: any;
  onDelete?: () => void;
  onClick?: () => void;
  isProcessing?: boolean;
}

function TeamCard({
  team,
  isOwner,
  statusLabels,
  c,
  onDelete,
  onClick,
  isProcessing,
}: TeamCardProps) {
  const kind = team.status as StatusKind;

  return (
    <div
      onClick={onClick}
      onMouseEnter={onRowEnter}
      onMouseLeave={onRowLeave}
      style={{
        ...surfaceCard,
        padding: 14,
        cursor: 'pointer',
        transition: 'background 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--tl-surface)',
              border: '1px solid var(--tl-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: 'var(--tl-fg-2)',
            }}
          >
            <Users className="h-5 w-5" />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ ...inlineTeamName, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {team.team_name}
              </span>
              {team.seed && (
                <span
                  style={{
                    ...statusPillBase,
                    background: 'var(--tl-surface)',
                    color: 'var(--tl-fg-2)',
                    border: '1px solid var(--tl-border)',
                  }}
                >
                  Seed #{team.seed}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{ ...statusPillBase, ...statusPillStyle(kind) }}>
                {team.status === 'approved' && <Check className="h-3 w-3" />}
                {team.status === 'pending' && <Clock className="h-3 w-3" />}
                {team.status === 'rejected' && <X className="h-3 w-3" />}
                {statusLabels[kind]}
              </span>
            </div>
          </div>
        </div>

        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {isOwner && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  style={{ color: 'var(--tl-live)' }}
                  disabled={isProcessing}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{c.deleteTeamTitle}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {c.deleteTeamDesc.replace('{name}', team.team_name)}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{c.cancelBtn}</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDelete}
                    style={{ background: 'var(--tl-live)', color: 'var(--tl-bg)' }}
                  >
                    {c.deleteBtn}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <ChevronRight className="h-4 w-4" style={{ color: 'var(--tl-fg-3)' }} />
        </div>
      </div>
    </div>
  );
}
