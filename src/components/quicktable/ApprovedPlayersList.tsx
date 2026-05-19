import { useApprovedRegistrations } from '@/hooks/useSupabaseData';
import { useI18n } from '@/i18n';
import { Users, CheckCircle2, RefreshCw } from 'lucide-react';

interface ApprovedPlayersListProps {
  tableId: string;
  tableName?: string;
}

// ─── Shared tokens (mirror W2.1a / b / c) ───────────────────────────────
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

const countPill: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10.5,
  fontWeight: 500,
  padding: '2px 8px',
  borderRadius: 999,
  background: 'var(--tl-surface)',
  border: '1px solid var(--tl-border)',
  color: 'var(--tl-fg-3)',
  letterSpacing: '0.04em',
};

function onRowEnter(e: React.MouseEvent<HTMLTableRowElement>) {
  (e.currentTarget as HTMLElement).style.background = 'var(--tl-bg)';
}
function onRowLeave(e: React.MouseEvent<HTMLTableRowElement>) {
  (e.currentTarget as HTMLElement).style.background = 'transparent';
}

export function ApprovedPlayersList({ tableId }: ApprovedPlayersListProps) {
  const { data: registrations = [], isLoading } = useApprovedRegistrations(tableId);
  const { language } = useI18n();

  const txt = {
    title: language === 'vi' ? 'VĐV đã được duyệt' : 'Approved players',
    empty: language === 'vi' ? 'Chưa có VĐV nào được duyệt.' : 'No players approved yet.',
    name: language === 'vi' ? 'Tên VĐV' : 'Player',
    team: language === 'vi' ? 'Team' : 'Team',
    skill: language === 'vi' ? 'Trình độ' : 'Skill',
    noRating: language === 'vi' ? 'Chưa khai' : 'Not declared',
    other: language === 'vi' ? 'Khác' : 'Other',
  };

  const renderSkillPill = (reg: typeof registrations[0]) => {
    if (reg.rating_system === 'DUPR') {
      return <span style={duprPillStyle}>DUPR {reg.skill_level ?? '—'}</span>;
    }
    if (reg.rating_system === 'other') {
      const systemName = reg.skill_system_name || txt.other;
      return (
        <span style={duprPillStyle}>
          {systemName}
          {reg.skill_level != null ? `: ${reg.skill_level}` : ''}
        </span>
      );
    }
    if (reg.skill_description) {
      return <span style={duprPillStyle}>{reg.skill_description}</span>;
    }
    return <span style={{ color: 'var(--tl-fg-4)' }}>—</span>;
  };

  if (isLoading) {
    return (
      <div style={surfaceCard}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 16px',
            borderBottom: '1px solid var(--tl-border)',
          }}
        >
          <Users className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />
          <h3 style={sectionTitle}>{txt.title}</h3>
        </div>
        <div style={{ padding: 32, textAlign: 'center' }}>
          <RefreshCw
            className="w-5 h-5 animate-spin"
            style={{ color: 'var(--tl-fg-3)', margin: '0 auto 6px' }}
          />
        </div>
      </div>
    );
  }

  if (registrations.length === 0) {
    return (
      <div style={surfaceCard}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '14px 16px',
            borderBottom: '1px solid var(--tl-border)',
          }}
        >
          <Users className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />
          <h3 style={sectionTitle}>{txt.title}</h3>
        </div>
        <div style={{ padding: '32px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--tl-fg-3)', margin: 0 }}>{txt.empty}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={surfaceCard}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 16px',
          borderBottom: '1px solid var(--tl-border)',
        }}
      >
        <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />
        <h3 style={sectionTitle}>{txt.title}</h3>
        <span style={countPill}>{registrations.length}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...headStyle, width: 40, textAlign: 'center' }}>#</th>
              <th style={headStyle}>{txt.name}</th>
              <th style={{ ...headStyle }} className="hidden sm:table-cell">
                {txt.team}
              </th>
              <th style={{ ...headStyle, textAlign: 'right', width: 160 }}>
                DUPR / {txt.skill}
              </th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((reg, idx) => (
              <tr
                key={reg.id}
                onMouseEnter={onRowEnter}
                onMouseLeave={onRowLeave}
                style={{ transition: 'background 0.15s' }}
              >
                <td
                  style={{
                    ...cellStyle,
                    textAlign: 'center',
                    color: 'var(--tl-fg-2)',
                    fontWeight: 600,
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
                  {reg.display_name}
                </td>
                <td
                  style={{ ...cellStyle, color: 'var(--tl-fg-3)' }}
                  className="hidden sm:table-cell"
                >
                  {reg.team || '—'}
                </td>
                <td style={{ ...cellStyle, textAlign: 'right' }}>{renderSkillPill(reg)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default ApprovedPlayersList;
