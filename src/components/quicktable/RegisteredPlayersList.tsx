import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, Clock, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/i18n';

interface RegisteredPlayersListProps {
  tableId: string;
  isDoubles?: boolean;
}

// W2.1a — shared container style. Mirrors the surface-card pattern used
// across PR A/B/C/D so this list reads as part of the same design system
// as the rest of the tournament tools (e.g. PlayerPool, GroupSelector,
// TeamMatch overview cards).
const surfaceCardStyle: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

// Native HTML table cell defaults. Geist Mono on numeric / status / meta
// columns; the player-name column inherits this padding but overrides
// font to Instrument Serif inline (see render below).
const headStyle: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-3)',
  padding: '10px 12px',
  textAlign: 'left',
  borderBottom: '1px solid var(--tl-border)',
  whiteSpace: 'nowrap',
  background: 'transparent',
};

const cellStyle: React.CSSProperties = {
  padding: '12px',
  fontSize: 13,
  color: 'var(--tl-fg)',
  borderBottom: '1px solid var(--tl-border)',
  fontVariantNumeric: 'tabular-nums',
  verticalAlign: 'middle',
};

// W2.1a — status pill colour map shared across the anchor + the
// player-form / BTC management PRs (W2.1b / W2.1c). Adding a new
// status here keeps all three components in sync without touching
// the-line.css.
const statusPillStyle = (kind: 'approved' | 'pending' | 'rejected' | 'neutral'): React.CSSProperties => {
  if (kind === 'approved') return { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' };
  if (kind === 'pending') return { background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)' };
  if (kind === 'rejected') return { background: 'rgba(255, 65, 54, 0.10)', color: 'var(--tl-live)' };
  return { background: 'var(--tl-surface)', color: 'var(--tl-fg-3)' };
};

// W2.1a — DUPR rating pill placeholder. The `formatSkill` helper already
// returns a 'DUPR 4.5' string when rating_system === 'DUPR'. Once the
// DUPR integration ships (1-2 weeks, see PR W2.1 spec), this pill will
// pick up the live rating from the API. For now it shows the
// self-declared rating or an em-dash so the column always has visual
// weight — no layout shift when DUPR data lands.
const duprPillStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10.5,
  fontWeight: 500,
  padding: '2px 8px',
  borderRadius: 999,
  background: 'var(--tl-surface)',
  color: 'var(--tl-fg-2)',
  border: '1px solid var(--tl-border)',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
};

function onRowEnter(e: React.MouseEvent<HTMLTableRowElement>) {
  (e.currentTarget as HTMLElement).style.background = 'var(--tl-bg)';
}
function onRowLeave(e: React.MouseEvent<HTMLTableRowElement>) {
  (e.currentTarget as HTMLElement).style.background = 'transparent';
}

// Hook to fetch all registered players (pending + approved) for singles
function useAllRegistrations(tableId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['all-registrations', tableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_table_registrations')
        .select('id, display_name, team, status, rating_system, skill_level, skill_system_name, skill_description')
        .eq('table_id', tableId)
        .in('status', ['pending', 'approved'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!tableId,
  });
}

// Hook to fetch all registered teams (pending + approved) for doubles
function useAllTeams(tableId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['all-teams-registered', tableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('quick_table_teams')
        .select('*')
        .eq('table_id', tableId)
        .not('team_status', 'in', '(rejected,removed)')
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: enabled && !!tableId,
  });
}

interface HeaderProps {
  count: number | null;
  label: string;
}

function ListHeader({ count, label }: HeaderProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        padding: '14px 16px',
        borderBottom: '1px solid var(--tl-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Users className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />
        <h3
          style={{
            fontFamily: 'Instrument Serif, serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 18,
            letterSpacing: '-0.015em',
            color: 'var(--tl-fg)',
            margin: 0,
          }}
        >
          {label}
        </h3>
      </div>
      {count !== null && (
        <span
          style={{
            fontFamily: 'Geist Mono, ui-monospace, monospace',
            fontSize: 10.5,
            fontWeight: 500,
            padding: '2px 8px',
            borderRadius: 999,
            background: 'var(--tl-surface)',
            border: '1px solid var(--tl-border)',
            color: 'var(--tl-fg-3)',
            letterSpacing: '0.04em',
          }}
        >
          {count}
        </span>
      )}
    </div>
  );
}

export function RegisteredPlayersList({ tableId, isDoubles = false }: RegisteredPlayersListProps) {
  const { t } = useI18n();
  const { data: singlesData = [], isLoading: singlesLoading } = useAllRegistrations(tableId, !isDoubles);
  const { data: teamsData = [], isLoading: teamsLoading } = useAllTeams(tableId, isDoubles);

  const isLoading = isDoubles ? teamsLoading : singlesLoading;
  const data = isDoubles ? teamsData : singlesData;

  // Format skill display — the formatSkill helper looks for DUPR /
  // other rating systems first, then falls back to skill_description.
  // The DUPR integration coming in 1-2 weeks will populate
  // rating_system + skill_level via API, and this same renderer will
  // pick up the value with no change here.
  const formatSkill = (reg: any): string | null => {
    if (reg.rating_system === 'DUPR' || reg.player1_rating_system === 'DUPR') {
      const level = reg.skill_level || reg.player1_skill_level;
      return level ? `DUPR ${level}` : 'DUPR';
    }
    if (reg.rating_system === 'other' || reg.player1_rating_system === 'other') {
      const systemName = reg.skill_system_name || 'Other';
      const level = reg.skill_level || reg.player1_skill_level;
      return level ? `${systemName} ${level}` : systemName;
    }
    return reg.skill_description || null;
  };

  const isApproved = (item: any) => {
    if (isDoubles) {
      return item.btc_approved || item.team_status === 'approved';
    }
    return item.status === 'approved';
  };

  const getDisplayName = (item: any) => {
    if (isDoubles) {
      let name = item.player1_display_name;
      if (item.player2_display_name) {
        name += ` & ${item.player2_display_name}`;
      }
      return name;
    }
    return item.display_name;
  };

  const getTeam = (item: any) => {
    if (isDoubles) {
      const teams = [item.player1_team, item.player2_team].filter(Boolean);
      return teams.length > 0 ? teams.join(' / ') : null;
    }
    return item.team;
  };

  const getPartnerStatus = (item: any) => {
    if (!isDoubles) return null;
    if (item.player2_user_id) {
      return t.quickTable.hasPartnerStatus;
    }
    return t.quickTable.noPartnerStatus;
  };

  if (isLoading) {
    return (
      <div style={surfaceCardStyle}>
        <ListHeader count={null} label={t.quickTable.registeredPlayers} />
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 40,
                borderRadius: 'var(--tl-radius)',
                background: 'var(--tl-surface)',
                opacity: 0.5,
                animation: 'tl-pulse 1.6s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={surfaceCardStyle}>
        <ListHeader count={0} label={t.quickTable.registeredPlayers} />
        <div style={{ padding: 24 }}>
          <div className="tl-empty-card" style={{ padding: '24px 16px', margin: 0 }}>
            <span className="tl-empty-card-mark">◌</span>
            <span className="tl-empty-card-label">{t.quickTable.noRegisteredPlayers}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={surfaceCardStyle}>
      <ListHeader count={data.length} label={t.quickTable.registeredPlayers} />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, width: 36, textAlign: 'center' }}>#</th>
              <th style={headStyle}>
                {isDoubles ? t.quickTable.teamName : t.quickTable.playerName}
              </th>
              <th style={{ ...headStyle, display: 'none' }} className="sm:table-cell">
                {t.quickTable.club}
              </th>
              {/* W2.1a — DUPR slot column. Title intentionally short ("DUPR /
                  Skill") because once DUPR is live this becomes the canonical
                  rating display and the header still reads cleanly when the
                  legacy free-text skill_description renders alongside. */}
              <th style={{ ...headStyle, textAlign: 'center', width: 120 }}>
                DUPR / Skill
              </th>
              <th style={{ ...headStyle, textAlign: 'center', width: 110 }}>
                {t.quickTable.statusHeader}
              </th>
              {isDoubles && (
                <th
                  style={{ ...headStyle, textAlign: 'center', width: 110, display: 'none' }}
                  className="md:table-cell"
                >
                  Partner
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.map((item: any, idx: number) => {
              const approved = isApproved(item);
              const teamLabel = getTeam(item);
              const skill = formatSkill(item);
              return (
                <tr
                  key={item.id}
                  onMouseEnter={onRowEnter}
                  onMouseLeave={onRowLeave}
                  style={{ transition: 'background 0.15s' }}
                >
                  <td
                    style={{
                      ...cellStyle,
                      textAlign: 'center',
                      fontWeight: 600,
                      color: 'var(--tl-fg-2)',
                      fontFamily: 'Geist Mono, ui-monospace, monospace',
                    }}
                  >
                    {idx + 1}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      fontFamily: 'Instrument Serif, serif',
                      fontStyle: 'italic',
                      fontSize: 17,
                      fontWeight: 400,
                      letterSpacing: '-0.01em',
                      color: 'var(--tl-fg)',
                    }}
                  >
                    {getDisplayName(item)}
                  </td>
                  <td
                    style={{ ...cellStyle, color: 'var(--tl-fg-3)', display: 'none' }}
                    className="sm:table-cell"
                  >
                    {teamLabel || '—'}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>
                    {skill ? (
                      <span style={duprPillStyle}>{skill}</span>
                    ) : (
                      <span style={{ color: 'var(--tl-fg-4)' }}>—</span>
                    )}
                  </td>
                  <td style={{ ...cellStyle, textAlign: 'center' }}>
                    {approved ? (
                      <span
                        style={{
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
                          ...statusPillStyle('approved'),
                        }}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {t.quickTable.approved}
                      </span>
                    ) : (
                      <span
                        style={{
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
                          ...statusPillStyle('pending'),
                        }}
                      >
                        <Clock className="w-3 h-3" />
                        {t.quickTable.pending}
                      </span>
                    )}
                  </td>
                  {isDoubles && (
                    <td
                      style={{
                        ...cellStyle,
                        textAlign: 'center',
                        fontFamily: 'Geist Mono, ui-monospace, monospace',
                        fontSize: 11,
                        color: 'var(--tl-fg-3)',
                        letterSpacing: '0.04em',
                        display: 'none',
                      }}
                      className="md:table-cell"
                    >
                      {getPartnerStatus(item)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default RegisteredPlayersList;
