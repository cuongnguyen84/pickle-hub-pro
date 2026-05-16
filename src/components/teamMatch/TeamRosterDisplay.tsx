import { Skeleton } from '@/components/ui/skeleton';
import { Users, Crown, ChevronRight } from 'lucide-react';
import { TeamMatchTeam, useTeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useI18n } from '@/i18n';

// ─── W2.4b shared tokens (mirror MatchList/PlayoffBracket from #103) ─────
const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

const teamNameLine: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 22,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
};

const playerName: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 17,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
};

const subLabel: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10.5,
  letterSpacing: '0.04em',
  color: 'var(--tl-fg-3)',
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

interface TeamRosterDisplayProps {
  team: TeamMatchTeam;
  maxRosterSize: number;
  onManageClick: () => void;
}

export function TeamRosterDisplay({ team, maxRosterSize, onManageClick }: TeamRosterDisplayProps) {
  const { roster, isLoading } = useTeamMatchTeam(team.id);
  const { t, language } = useI18n();
  const c = t.teamMatchComponents;

  const rosterCount = roster.length;
  const isFull = rosterCount >= maxRosterSize;

  const txt = {
    captain: language === 'vi' ? 'Đội trưởng' : 'Captain',
    male: c.male,
    female: c.female,
    rosterFull: c.rosterFull,
    rosterIncomplete: c.rosterIncomplete,
    manageTeam: c.manageTeam,
    emptySlot: language === 'vi' ? 'Vị trí trống' : 'Empty slot',
  };

  if (isLoading) {
    return (
      <div style={{ ...surfaceCard, padding: 16 }}>
        <Skeleton className="h-6 w-32 mb-4" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section style={{ ...surfaceCard, padding: 16 }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Users className="h-5 w-5" style={{ color: 'var(--tl-fg-2)', flexShrink: 0 }} />
          <h2 style={teamNameLine}>{team.team_name}</h2>
        </div>
        <span
          style={{
            ...statusPillBase,
            ...(isFull
              ? { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' }
              : { background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)' }),
          }}
        >
          {rosterCount}/{maxRosterSize} · {isFull ? txt.rosterFull : txt.rosterIncomplete}
        </span>
      </header>

      {/* Roster list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {roster.map((member) => (
          <div
            key={member.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 14px',
              borderRadius: 'var(--tl-radius)',
              background: 'var(--tl-surface)',
              border: '1px solid var(--tl-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {member.is_captain ? (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(233, 182, 73, 0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Crown className="h-4 w-4" style={{ color: 'var(--tl-gold)' }} />
                </div>
              ) : (
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--tl-bg-elev)',
                    border: '1px solid var(--tl-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'var(--tl-fg-2)',
                  }}
                >
                  <Users className="h-4 w-4" />
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <p style={playerName}>{member.player_name}</p>
                {member.is_captain && (
                  <p style={subLabel}>{txt.captain}</p>
                )}
              </div>
            </div>
            <span
              style={{
                ...statusPillBase,
                background: 'var(--tl-bg-elev)',
                color: 'var(--tl-fg-2)',
                border: '1px solid var(--tl-border)',
              }}
            >
              {member.gender === 'male' ? txt.male : txt.female}
            </span>
          </div>
        ))}
      </div>

      {/* Empty slots */}
      {!isFull && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {Array.from({ length: maxRosterSize - rosterCount }).map((_, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 14px',
                borderRadius: 'var(--tl-radius)',
                border: '1px dashed var(--tl-border-2)',
                background: 'transparent',
                color: 'var(--tl-fg-3)',
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 12,
                letterSpacing: '0.04em',
              }}
            >
              {txt.emptySlot} {rosterCount + i + 1}
            </div>
          ))}
        </div>
      )}

      {/* Action button */}
      <button
        type="button"
        className="tl-btn green"
        style={{ width: '100%', justifyContent: 'center', padding: '12px 16px' }}
        onClick={onManageClick}
      >
        {txt.manageTeam}
        <ChevronRight className="h-4 w-4" />
      </button>
    </section>
  );
}
