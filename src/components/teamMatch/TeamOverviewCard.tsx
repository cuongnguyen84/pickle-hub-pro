import { Users, Crown, Clock, Check, X } from 'lucide-react';
import { TeamMatchTeam, useTeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useI18n } from '@/i18n';

// ─── W2.4b shared tokens (mirror MatchList/PlayoffBracket from #103) ─────
const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 18,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
};

const teamNameLine: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 24,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
};

const fieldLabel: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-2)',
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

interface TeamOverviewCardProps {
  team: TeamMatchTeam;
  maxRosterSize: number;
  totalTeamsRegistered: number;
}

export function TeamOverviewCard({ team, maxRosterSize, totalTeamsRegistered }: TeamOverviewCardProps) {
  const { roster } = useTeamMatchTeam(team.id);
  const { t } = useI18n();
  const c = t.teamMatchComponents;

  const rosterCount = roster.length;
  const isFull = rosterCount >= maxRosterSize;
  const kind = team.status as StatusKind;

  const STATUS_LABELS: Record<StatusKind, string> = {
    pending: c.statusPending,
    approved: c.statusApproved,
    rejected: c.statusRejected,
  };

  return (
    <section
      style={{
        ...surfaceCard,
        padding: 18,
        boxShadow: '0 0 0 1px var(--tl-green-dim)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Crown className="h-4 w-4" style={{ color: 'var(--tl-gold)' }} />
          <h3 style={sectionTitle}>{c.yourTeam}</h3>
        </div>
        <span style={{ ...statusPillBase, ...statusPillStyle(kind) }}>
          {team.status === 'approved' && <Check className="h-3 w-3" />}
          {team.status === 'pending' && <Clock className="h-3 w-3" />}
          {team.status === 'rejected' && <X className="h-3 w-3" />}
          {STATUS_LABELS[kind]}
        </span>
      </header>

      {/* Team name */}
      <div style={{ marginBottom: 16 }}>
        <h2 style={teamNameLine}>{team.team_name}</h2>
        <p style={{ fontSize: 13, color: 'var(--tl-fg-2)', margin: '4px 0 0' }}>
          {c.youAreCaptain}
        </p>
      </div>

      {/* Summary info - NO member list */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 10,
          marginBottom: 14,
        }}
      >
        {/* Roster status */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderRadius: 'var(--tl-radius)',
            background: 'var(--tl-surface)',
            border: '1px solid var(--tl-border)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users className="h-4 w-4" style={{ color: 'var(--tl-fg-2)' }} />
            <span style={fieldLabel}>{c.members}</span>
          </div>
          <span
            style={{
              ...statusPillBase,
              ...(isFull
                ? { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' }
                : { background: 'var(--tl-surface)', color: 'var(--tl-fg-2)', border: '1px solid var(--tl-border)' }),
            }}
          >
            {rosterCount}/{maxRosterSize}
          </span>
        </div>

        {/* Roster completeness */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderRadius: 'var(--tl-radius)',
            background: 'var(--tl-surface)',
            border: '1px solid var(--tl-border)',
          }}
        >
          <span style={fieldLabel}>{c.rosterStatus}</span>
          <span
            style={{
              ...statusPillBase,
              ...(isFull
                ? { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' }
                : { background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)' }),
            }}
          >
            {isFull && <Check className="h-3 w-3" />}
            {isFull ? c.rosterFull : c.rosterIncomplete}
          </span>
        </div>
      </div>

      {/* Tournament info */}
      <div
        style={{
          padding: '10px 12px',
          borderRadius: 'var(--tl-radius)',
          background: 'var(--tl-bg)',
          border: '1px solid var(--tl-border)',
          fontSize: 13,
          color: 'var(--tl-fg-2)',
        }}
      >
        {c.registeredTeams.replace('{count}', String(totalTeamsRegistered))}
      </div>
    </section>
  );
}
