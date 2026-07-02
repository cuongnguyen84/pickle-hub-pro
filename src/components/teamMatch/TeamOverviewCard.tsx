import { Users, Crown, Clock, Check, X, UserPlus, Loader2 } from 'lucide-react';
import { TeamMatchTeam, useTeamMatchTeam, useTeamMatchTeamManagement } from '@/hooks/useTeamMatchTeams';
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
  const { t, language } = useI18n();
  const c = t.teamMatchComponents;
  const { updateRosterStatus, removeRosterMember, isUpdatingRosterStatus, isRemovingMember } =
    useTeamMatchTeamManagement();

  const rosterCount = roster.length;
  const isFull = rosterCount >= maxRosterSize;
  const kind = team.status as StatusKind;

  const pendingMembers = roster.filter((m) => m.status === 'pending' && !m.is_captain);
  const busy = isUpdatingRosterStatus || isRemovingMember;

  const jt = {
    requestsTitle: language === 'vi' ? 'Yêu cầu tham gia' : 'Join requests',
    male: language === 'vi' ? 'Nam' : 'Male',
    female: language === 'vi' ? 'Nữ' : 'Female',
    approve: language === 'vi' ? 'Duyệt' : 'Approve',
    reject: language === 'vi' ? 'Từ chối' : 'Reject',
  };

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

      {/* Join requests — prominent for the captain when players ask to join */}
      {pendingMembers.length > 0 ? (
        <div
          style={{
            padding: 12,
            borderRadius: 'var(--tl-radius)',
            background: 'rgba(233, 182, 73, 0.06)',
            border: '1px solid rgba(233, 182, 73, 0.35)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
            <UserPlus className="h-4 w-4" style={{ color: 'var(--tl-gold)' }} />
            <span style={{ ...fieldLabel, color: 'var(--tl-gold)' }}>
              {jt.requestsTitle} ({pendingMembers.length})
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingMembers.map((m) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '8px 10px',
                  borderRadius: 'var(--tl-radius)',
                  background: 'var(--tl-surface)',
                  border: '1px solid var(--tl-border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span
                    style={{
                      fontFamily: 'Instrument Serif, serif',
                      fontStyle: 'italic',
                      fontSize: 16,
                      color: 'var(--tl-fg)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {m.player_name}
                  </span>
                  <span style={{ ...statusPillBase, background: 'var(--tl-surface)', color: 'var(--tl-fg-2)', border: '1px solid var(--tl-border)' }}>
                    {m.gender === 'male' ? jt.male : jt.female}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    aria-label={jt.approve}
                    className="tl-btn green"
                    style={{ padding: '6px 10px', fontSize: 12 }}
                    disabled={busy}
                    onClick={() => updateRosterStatus({ memberId: m.id, teamId: team.id, status: 'approved' })}
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    {jt.approve}
                  </button>
                  <button
                    type="button"
                    aria-label={jt.reject}
                    className="tl-btn"
                    style={{ padding: '6px 10px', fontSize: 12, color: 'var(--tl-live)', borderColor: 'rgba(255, 65, 54, 0.35)' }}
                    disabled={busy}
                    onClick={() => removeRosterMember({ memberId: m.id, teamId: team.id })}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
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
      )}
    </section>
  );
}
