import { useState, useEffect } from 'react';
import { useRegistration, type Registration } from '@/hooks/useRegistration';
import { useI18n } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Check, X, MoreVertical, Pencil, Users, Clock, CheckCircle2, XCircle, RefreshCw, Swords, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BracketSetupDialog } from './BracketSetupDialog';
import type { QuickTable } from '@/hooks/useQuickTable';

interface RegistrationManagerProps {
  tableId: string;
  shareId?: string;
  table?: QuickTable;
  onPendingCountChange?: (count: number) => void;
}

// ─── Shared tokens (mirror W2.1a anchor + W2.1b forms) ──────────────────
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

const fieldLabel: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-2)',
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

const statusPillStyle = (kind: 'approved' | 'pending' | 'rejected' | 'neutral'): React.CSSProperties => {
  if (kind === 'approved') return { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' };
  if (kind === 'pending') return { background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)' };
  if (kind === 'rejected') return { background: 'rgba(255, 65, 54, 0.10)', color: 'var(--tl-live)' };
  return { background: 'var(--tl-surface)', color: 'var(--tl-fg-3)' };
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

const duprPillOverrideStyle: React.CSSProperties = {
  ...duprPillStyle,
  background: 'var(--tl-green-glow)',
  color: 'var(--tl-green)',
  border: '1px solid rgba(0, 185, 107, 0.30)',
};

function onRowEnter(e: React.MouseEvent<HTMLTableRowElement>) {
  (e.currentTarget as HTMLElement).style.background = 'var(--tl-bg)';
}
function onRowLeave(e: React.MouseEvent<HTMLTableRowElement>) {
  (e.currentTarget as HTMLElement).style.background = 'transparent';
}

// Stat cell helper for the 3-up stats row
function StatCell({
  icon,
  count,
  label,
  kind,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
  kind: 'approved' | 'pending' | 'rejected';
}) {
  const palette = statusPillStyle(kind);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: palette.background,
          color: palette.color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <p
          style={{
            fontFamily: 'Geist Mono, ui-monospace, monospace',
            fontVariantNumeric: 'tabular-nums',
            fontSize: 24,
            fontWeight: 600,
            color: 'var(--tl-fg)',
            margin: 0,
            lineHeight: 1,
          }}
        >
          {count}
        </p>
        <p
          style={{
            ...fieldLabel,
            margin: '4px 0 0',
          }}
        >
          {label}
        </p>
      </div>
    </div>
  );
}

export function RegistrationManager({ tableId, shareId, table, onPendingCountChange }: RegistrationManagerProps) {
  const { t, language } = useI18n();
  const {
    getTableRegistrations,
    approveRegistration,
    rejectRegistration,
    bulkApprove,
    updateBTCOverride,
  } = useRegistration();

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingRegistration, setEditingRegistration] = useState<Registration | null>(null);
  const [overrideSkill, setOverrideSkill] = useState('');
  const [btcNotes, setBtcNotes] = useState('');
  const [showBracketSetup, setShowBracketSetup] = useState(false);

  // Bilingual labels — inline ternary to avoid bloating i18n files for
  // BTC-only strings that won't be reused elsewhere. Matches the
  // pattern PR A/B/C/D have used for chrome-only labels.
  const txt = {
    player: language === 'vi' ? 'VĐV' : 'Player',
    email: 'Email',
    team: language === 'vi' ? 'Team' : 'Team',
    skill: language === 'vi' ? 'Trình độ' : 'Skill',
    actions: language === 'vi' ? 'Thao tác' : 'Actions',
    viewProfile: language === 'vi' ? 'Xem hồ sơ' : 'View profile',
    noPlayersYet: language === 'vi' ? 'Chưa có VĐV nào đăng ký' : 'No players have registered yet',
    sharePrompt: language === 'vi'
      ? 'Chia sẻ link giải để VĐV có thể đăng ký tham dự'
      : 'Share the tournament link so players can register',
    editTitle: language === 'vi' ? 'Chỉnh sửa thông tin VĐV' : 'Edit player details',
    editDesc: language === 'vi'
      ? 'Thông tin do BTC ghi đè sẽ được sử dụng thay cho thông tin VĐV tự khai'
      : 'Organizer overrides take precedence over self-declared player info',
    selfDeclared: language === 'vi' ? 'Trình độ tự khai' : 'Self-declared skill',
    btcConfirmed: language === 'vi' ? 'Trình độ do BTC xác nhận' : 'Skill confirmed by organizer',
    btcConfirmedHelp: language === 'vi' ? 'Để trống nếu sử dụng trình độ tự khai' : 'Leave empty to use self-declared skill',
    internalNotes: language === 'vi' ? 'Ghi chú nội bộ' : 'Internal notes',
    internalNotesPlaceholder: language === 'vi'
      ? 'VD: BTC xác nhận trình độ qua giải ABC'
      : 'E.g. organizer verified at tournament ABC',
    cancel: language === 'vi' ? 'Hủy' : 'Cancel',
    saveChanges: language === 'vi' ? 'Lưu thay đổi' : 'Save changes',
    minPlayersToast: language === 'vi' ? 'Cần ít nhất 6 VĐV được duyệt' : 'Need at least 6 approved players',
    duprExample: language === 'vi' ? 'VD: 3.50' : 'e.g. 3.50',
    btcMarker: language === 'vi' ? 'BTC' : 'BTC',
    noRating: language === 'vi' ? 'Chưa có rating' : 'No rating',
  };

  const loadRegistrations = async () => {
    setLoading(true);
    const data = await getTableRegistrations(tableId);
    setRegistrations(data);
    setLoading(false);

    const pendingCount = data.filter(r => r.status === 'pending').length;
    onPendingCountChange?.(pendingCount);
  };

  useEffect(() => {
    loadRegistrations();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`registrations-${tableId}:${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'quick_table_registrations',
            filter: `table_id=eq.${tableId}`,
          },
          () => {
            loadRegistrations();
          },
        )
        .subscribe();
    } catch (err) {
      console.warn('[RegistrationManager] Realtime setup failed:', err);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [tableId]);

  const pendingRegistrations = registrations.filter(r => r.status === 'pending');
  const approvedRegistrations = registrations.filter(r => r.status === 'approved');
  const rejectedRegistrations = registrations.filter(r => r.status === 'rejected');

  const handleApprove = async (id: string) => {
    const success = await approveRegistration(id);
    if (success) loadRegistrations();
  };

  const handleReject = async (id: string) => {
    const success = await rejectRegistration(id);
    if (success) loadRegistrations();
  };

  const handleBulkApprove = async () => {
    if (selectedIds.length === 0) return;
    const success = await bulkApprove(selectedIds);
    if (success) {
      setSelectedIds([]);
      loadRegistrations();
    }
  };

  const handleEditSubmit = async () => {
    if (!editingRegistration) return;

    const success = await updateBTCOverride(
      editingRegistration.id,
      overrideSkill ? parseFloat(overrideSkill) : null,
      btcNotes || null,
    );

    if (success) {
      setEditingRegistration(null);
      loadRegistrations();
    }
  };

  const openEditDialog = (reg: Registration) => {
    setEditingRegistration(reg);
    setOverrideSkill(reg.btc_override_skill?.toString() || '');
    setBtcNotes(reg.btc_notes || '');
  };

  const handleStartBracket = () => {
    if (approvedRegistrations.length < 6) {
      toast.error(txt.minPlayersToast);
      return;
    }
    setShowBracketSetup(true);
  };

  // DUPR / Skill pill — W2.1c FIX: dedicated column rendering as token
  // pill so the DUPR integration can light up rows without UI changes.
  const renderSkillPill = (reg: Registration) => {
    if (reg.btc_override_skill) {
      return (
        <span style={duprPillOverrideStyle}>
          {reg.btc_override_skill}
          <span style={{ marginLeft: 4, opacity: 0.7, fontSize: 9 }}>{txt.btcMarker}</span>
        </span>
      );
    }
    if (reg.rating_system === 'DUPR') {
      return <span style={duprPillStyle}>DUPR {reg.skill_level ?? '—'}</span>;
    }
    if (reg.rating_system === 'other') {
      return <span style={duprPillStyle}>{reg.skill_level?.toString() || '—'}</span>;
    }
    if (reg.skill_description) {
      return <span style={duprPillStyle}>{reg.skill_description}</span>;
    }
    return <span style={{ color: 'var(--tl-fg-4)' }}>—</span>;
  };

  const renderStatusPill = (status: string) => {
    if (status === 'pending') {
      return (
        <span style={{ ...statusPillBase, ...statusPillStyle('pending') }}>
          <Clock className="w-3 h-3" />
          {t.quickTable.pending}
        </span>
      );
    }
    if (status === 'approved') {
      return (
        <span style={{ ...statusPillBase, ...statusPillStyle('approved') }}>
          <CheckCircle2 className="w-3 h-3" />
          {t.quickTable.approved}
        </span>
      );
    }
    if (status === 'rejected') {
      return (
        <span style={{ ...statusPillBase, ...statusPillStyle('rejected') }}>
          <XCircle className="w-3 h-3" />
          {t.quickTable.rejected}
        </span>
      );
    }
    return null;
  };

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ ...surfaceCard, padding: 32, textAlign: 'center' }}>
        <RefreshCw className="w-6 h-6 animate-spin" style={{ color: 'var(--tl-fg-3)', margin: '0 auto 8px' }} />
        <p
          style={{
            fontFamily: 'Geist Mono, ui-monospace, monospace',
            fontSize: 12,
            color: 'var(--tl-fg-3)',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            margin: 0,
          }}
        >
          {t.quickTable.loading}
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats row — 3 cells */}
      <div
        style={{
          ...surfaceCard,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 1,
          background: 'var(--tl-border)',
          overflow: 'hidden',
        }}
      >
        <div style={{ background: 'var(--tl-bg-elev)' }}>
          <StatCell
            icon={<Clock className="w-5 h-5" />}
            count={pendingRegistrations.length}
            label={t.quickTable.pending}
            kind="pending"
          />
        </div>
        <div style={{ background: 'var(--tl-bg-elev)' }}>
          <StatCell
            icon={<CheckCircle2 className="w-5 h-5" />}
            count={approvedRegistrations.length}
            label={t.quickTable.approved}
            kind="approved"
          />
        </div>
        <div style={{ background: 'var(--tl-bg-elev)' }}>
          <StatCell
            icon={<XCircle className="w-5 h-5" />}
            count={rejectedRegistrations.length}
            label={t.quickTable.rejected}
            kind="rejected"
          />
        </div>
      </div>

      {/* Ready-to-bracket banner.
          Sprint B2 follow-up (2026-05-27) — hide once the table moves
          past setup (group_stage / playoff / completed). The "Chia bảng"
          button was still showing after bracket creation, letting the
          organizer trigger a duplicate generation. */}
      {approvedRegistrations.length >= 6 && table?.status === 'setup' && (
        <div
          style={{
            ...surfaceCard,
            borderColor: 'var(--tl-green)',
            background: 'var(--tl-green-glow)',
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h3 style={{ ...sectionTitle, fontSize: 20, marginBottom: 4 }}>
              <Swords className="inline w-4 h-4 mr-2" style={{ color: 'var(--tl-green)', verticalAlign: 'middle' }} />
              {t.quickTable.readyToBracket}
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--tl-fg-2)', margin: 0 }}>
              {t.quickTable.readyToBracketDesc.replace('{count}', approvedRegistrations.length.toString())}
            </p>
          </div>
          <button type="button" className="tl-btn green" onClick={handleStartBracket}>
            <Swords className="w-4 h-4" />
            {t.quickTable.createBracket}
          </button>
        </div>
      )}

      {/* Not enough players warning */}
      {approvedRegistrations.length > 0 && approvedRegistrations.length < 6 && (
        <div
          style={{
            ...surfaceCard,
            background: 'rgba(233, 182, 73, 0.10)',
            border: '1px solid rgba(233, 182, 73, 0.30)',
            padding: 14,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <AlertCircle className="w-4 h-4" style={{ color: 'var(--tl-gold)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: 13, color: 'var(--tl-fg-2)', margin: 0, lineHeight: 1.5 }}>
            {t.quickTable.needMinPlayers.replace('{count}', approvedRegistrations.length.toString())}
          </p>
        </div>
      )}

      {/* Pending registrations */}
      {pendingRegistrations.length > 0 && (
        <div style={surfaceCard}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '14px 16px',
              borderBottom: '1px solid var(--tl-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock className="w-4 h-4" style={{ color: 'var(--tl-gold)' }} />
              <h3 style={sectionTitle}>
                {t.quickTable.pendingRegistrations}
              </h3>
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
                {pendingRegistrations.length}
              </span>
            </div>
            {selectedIds.length > 0 && (
              <button type="button" className="tl-btn green" onClick={handleBulkApprove}>
                <Check className="w-4 h-4" />
                {t.quickTable.approveSelected.replace('{count}', selectedIds.length.toString())}
              </button>
            )}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...headStyle, width: 44 }}>
                    <Checkbox
                      checked={selectedIds.length === pendingRegistrations.length && pendingRegistrations.length > 0}
                      onCheckedChange={() => {
                        if (selectedIds.length === pendingRegistrations.length) {
                          setSelectedIds([]);
                        } else {
                          setSelectedIds(pendingRegistrations.map(r => r.id));
                        }
                      }}
                    />
                  </th>
                  <th style={headStyle}>{txt.player}</th>
                  <th style={headStyle}>{txt.email}</th>
                  <th style={headStyle}>{txt.team}</th>
                  <th style={{ ...headStyle, width: 140 }}>DUPR / {txt.skill}</th>
                  <th style={{ ...headStyle, textAlign: 'right', width: 130 }}>{txt.actions}</th>
                </tr>
              </thead>
              <tbody>
                {pendingRegistrations.map((reg) => (
                  <tr
                    key={reg.id}
                    onMouseEnter={onRowEnter}
                    onMouseLeave={onRowLeave}
                    style={{ transition: 'background 0.15s' }}
                  >
                    <td style={cellStyle}>
                      <Checkbox
                        checked={selectedIds.includes(reg.id)}
                        onCheckedChange={() => {
                          setSelectedIds(prev =>
                            prev.includes(reg.id) ? prev.filter(i => i !== reg.id) : [...prev, reg.id],
                          );
                        }}
                      />
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
                    <td style={{ ...cellStyle, color: 'var(--tl-fg-3)' }}>{reg.email || '—'}</td>
                    <td style={{ ...cellStyle, color: 'var(--tl-fg-3)' }}>{reg.team || '—'}</td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                        {renderSkillPill(reg)}
                        {reg.profile_link && (
                          <a
                            href={reg.profile_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              fontFamily: 'Geist Mono, ui-monospace, monospace',
                              fontSize: 10.5,
                              color: 'var(--tl-green)',
                              textDecoration: 'underline',
                              letterSpacing: '0.04em',
                            }}
                          >
                            {txt.viewProfile}
                          </a>
                        )}
                      </div>
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          className="tl-btn"
                          onClick={() => handleApprove(reg.id)}
                          aria-label={t.quickTable.approve}
                          style={{ padding: '5px 8px', color: 'var(--tl-green)', borderColor: 'var(--tl-border)' }}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          className="tl-btn"
                          onClick={() => handleReject(reg.id)}
                          aria-label={t.quickTable.reject}
                          style={{ padding: '5px 8px', color: 'var(--tl-live)', borderColor: 'var(--tl-border)' }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="tl-btn"
                              style={{ padding: '5px 8px' }}
                              aria-label="more"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(reg)}>
                              <Pencil className="w-4 h-4 mr-2" />
                              {t.quickTable.editSkillLevel}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approved registrations */}
      {approvedRegistrations.length > 0 && (
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
            <h3 style={sectionTitle}>
              {t.quickTable.approvedPlayers}
            </h3>
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
              {approvedRegistrations.length}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...headStyle, width: 36, textAlign: 'center' }}>#</th>
                  <th style={headStyle}>{txt.player}</th>
                  <th style={headStyle}>{txt.email}</th>
                  <th style={headStyle}>{txt.team}</th>
                  <th style={{ ...headStyle, width: 140 }}>DUPR / {txt.skill}</th>
                  <th style={headStyle}>{t.quickTable.btcNote}</th>
                  <th style={{ ...headStyle, textAlign: 'right', width: 60 }}>{txt.actions}</th>
                </tr>
              </thead>
              <tbody>
                {approvedRegistrations.map((reg, idx) => (
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
                    <td style={{ ...cellStyle, color: 'var(--tl-fg-3)' }}>{reg.email || '—'}</td>
                    <td style={{ ...cellStyle, color: 'var(--tl-fg-3)' }}>{reg.team || '—'}</td>
                    <td style={cellStyle}>{renderSkillPill(reg)}</td>
                    <td
                      style={{
                        ...cellStyle,
                        color: 'var(--tl-fg-3)',
                        maxWidth: 200,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {reg.btc_notes || '—'}
                    </td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="tl-btn"
                            style={{ padding: '5px 8px' }}
                            aria-label="more"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDialog(reg)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            {t.common.edit}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleReject(reg.id)}
                          >
                            <X className="w-4 h-4 mr-2" />
                            {t.quickTable.cancelApproval}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rejected registrations */}
      {rejectedRegistrations.length > 0 && (
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
            <XCircle className="w-4 h-4" style={{ color: 'var(--tl-fg-3)' }} />
            <h3 style={{ ...sectionTitle, color: 'var(--tl-fg-2)' }}>
              {t.quickTable.rejectedRegistrations}
            </h3>
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
              {rejectedRegistrations.length}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={headStyle}>{txt.player}</th>
                  <th style={headStyle}>{txt.email}</th>
                  <th style={headStyle}>{txt.team}</th>
                  <th style={{ ...headStyle, width: 140 }}>DUPR / {txt.skill}</th>
                  <th style={{ ...headStyle, textAlign: 'right', width: 110 }}>{txt.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rejectedRegistrations.map((reg) => (
                  <tr
                    key={reg.id}
                    onMouseEnter={onRowEnter}
                    onMouseLeave={onRowLeave}
                    style={{ opacity: 0.6, transition: 'background 0.15s' }}
                  >
                    <td
                      style={{
                        ...cellStyle,
                        fontFamily: 'Instrument Serif, serif',
                        fontStyle: 'italic',
                        fontSize: 16,
                      }}
                    >
                      {reg.display_name}
                    </td>
                    <td style={{ ...cellStyle, color: 'var(--tl-fg-3)' }}>{reg.email || '—'}</td>
                    <td style={{ ...cellStyle, color: 'var(--tl-fg-3)' }}>{reg.team || '—'}</td>
                    <td style={cellStyle}>{renderSkillPill(reg)}</td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      <button
                        type="button"
                        className="tl-btn"
                        onClick={() => handleApprove(reg.id)}
                        style={{ padding: '4px 10px', fontSize: 12 }}
                      >
                        {t.quickTable.approve}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {registrations.length === 0 && (
        <div className="tl-empty-card" style={{ padding: '48px 24px' }}>
          <span className="tl-empty-card-mark">◌</span>
          <span className="tl-empty-card-label">{txt.noPlayersYet}</span>
          <p className="tl-empty-card-hint">{txt.sharePrompt}</p>
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingRegistration} onOpenChange={() => setEditingRegistration(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{txt.editTitle}</DialogTitle>
            <DialogDescription>{txt.editDesc}</DialogDescription>
          </DialogHeader>

          {editingRegistration && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div
                style={{
                  padding: 14,
                  borderRadius: 'var(--tl-radius)',
                  background: 'var(--tl-bg)',
                  border: '1px solid var(--tl-border)',
                }}
              >
                <p
                  style={{
                    fontFamily: 'Instrument Serif, serif',
                    fontStyle: 'italic',
                    fontSize: 18,
                    color: 'var(--tl-fg)',
                    margin: 0,
                  }}
                >
                  {editingRegistration.display_name}
                </p>
                <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', margin: '6px 0 0' }}>
                  {txt.selfDeclared}:{' '}
                  {editingRegistration.rating_system === 'DUPR'
                    ? `DUPR ${editingRegistration.skill_level || '—'}`
                    : editingRegistration.rating_system === 'other'
                      ? editingRegistration.skill_level?.toString() || '—'
                      : editingRegistration.skill_description || txt.noRating}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="overrideSkill" style={fieldLabel}>
                  {txt.btcConfirmed}
                </Label>
                <Input
                  id="overrideSkill"
                  name="overrideSkill"
                  type="number"
                  step="0.01"
                  min="1"
                  max="8"
                  value={overrideSkill}
                  onChange={(e) => setOverrideSkill(e.target.value)}
                  placeholder={txt.duprExample}
                />
                <p style={{ fontSize: 12, color: 'var(--tl-fg-3)', margin: '4px 0 0' }}>
                  {txt.btcConfirmedHelp}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="btcNotes" style={fieldLabel}>
                  {txt.internalNotes}
                </Label>
                <Textarea
                  id="btcNotes"
                  name="btcNotes"
                  value={btcNotes}
                  onChange={(e) => setBtcNotes(e.target.value)}
                  placeholder={txt.internalNotesPlaceholder}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <button type="button" className="tl-btn" onClick={() => setEditingRegistration(null)}>
              {txt.cancel}
            </button>
            <button type="button" className="tl-btn green" onClick={handleEditSubmit}>
              {txt.saveChanges}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bracket Setup Dialog — child component, refresh tracked in W2.1d audit */}
      {table && shareId && (
        <BracketSetupDialog
          open={showBracketSetup}
          onOpenChange={setShowBracketSetup}
          table={table}
          shareId={shareId}
          approvedPlayers={approvedRegistrations.map(reg => ({
            name: reg.display_name,
            team: reg.team,
            skill: reg.btc_override_skill || reg.skill_level || null,
            user_id: reg.user_id ?? null,
            player1_name: reg.display_name,
          }))}
        />
      )}
    </div>
  );
}

export default RegistrationManager;
