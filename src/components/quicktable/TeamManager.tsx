import { useState, useEffect } from 'react';
import { useTeamRegistration, type Team } from '@/hooks/useTeamRegistration';
import { useI18n } from '@/i18n';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  Check, X, MoreVertical, Users, Clock, CheckCircle2, XCircle,
  RefreshCw, Swords, UserMinus, Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BracketSetupDialog } from './BracketSetupDialog';
import type { QuickTable } from '@/hooks/useQuickTable';

interface TeamManagerProps {
  tableId: string;
  shareId?: string;
  table?: QuickTable;
  onPendingCountChange?: (count: number) => void;
}

// ─── Shared tokens (mirror W2.1a / W2.1b / RegistrationManager) ─────────
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
  verticalAlign: 'top',
};

type StatusKind = 'approved' | 'pending' | 'rejected' | 'removed' | 'pair-complete' | 'pair-incomplete' | 'neutral';

const statusPillPalette = (kind: StatusKind): { bg: string; fg: string; border?: string } => {
  if (kind === 'approved') return { bg: 'var(--tl-green-glow)', fg: 'var(--tl-green)' };
  if (kind === 'pending') return { bg: 'rgba(233, 182, 73, 0.12)', fg: 'var(--tl-gold)' };
  if (kind === 'rejected') return { bg: 'rgba(255, 65, 54, 0.10)', fg: 'var(--tl-live)' };
  if (kind === 'removed') return { bg: 'var(--tl-surface)', fg: 'var(--tl-fg-3)' };
  if (kind === 'pair-complete')
    return { bg: 'var(--tl-green-glow)', fg: 'var(--tl-green)', border: 'rgba(0, 185, 107, 0.30)' };
  if (kind === 'pair-incomplete')
    return { bg: 'rgba(233, 182, 73, 0.12)', fg: 'var(--tl-gold)', border: 'rgba(233, 182, 73, 0.30)' };
  return { bg: 'var(--tl-surface)', fg: 'var(--tl-fg-3)' };
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

function onRowEnter(e: React.MouseEvent<HTMLTableRowElement>) {
  (e.currentTarget as HTMLElement).style.background = 'var(--tl-bg)';
}
function onRowLeave(e: React.MouseEvent<HTMLTableRowElement>) {
  (e.currentTarget as HTMLElement).style.background = 'transparent';
}

function StatCell({
  icon,
  count,
  label,
  kind,
}: {
  icon: React.ReactNode;
  count: number;
  label: string;
  kind: StatusKind;
}) {
  const palette = statusPillPalette(kind);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16 }}>
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: palette.bg,
          color: palette.fg,
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
        <p style={{ ...fieldLabel, margin: '4px 0 0' }}>{label}</p>
      </div>
    </div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────
export function TeamManager({ tableId, shareId, table, onPendingCountChange }: TeamManagerProps) {
  const { t, language } = useI18n();
  const { getTableTeams, btcManageTeam } = useTeamRegistration();

  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBracketSetup, setShowBracketSetup] = useState(false);
  const [noteDialog, setNoteDialog] = useState<{ team: Team; action: 'approve' | 'reject' | 'remove' } | null>(null);
  const [notes, setNotes] = useState('');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // Bilingual labels — inline ternary, scoped to BTC chrome only
  const txt = {
    team: language === 'vi' ? 'Đội' : 'Team',
    player1: language === 'vi' ? 'VĐV 1' : 'Player 1',
    player2: language === 'vi' ? 'VĐV 2 (Partner)' : 'Player 2 (Partner)',
    skill: language === 'vi' ? 'Trình độ' : 'Skill',
    status: language === 'vi' ? 'Trạng thái' : 'Status',
    actions: language === 'vi' ? 'Thao tác' : 'Actions',
    pairComplete: language === 'vi' ? 'Đủ đội' : 'Full pair',
    pairIncomplete: language === 'vi' ? 'Thiếu partner' : 'Missing partner',
    waitingPartner: language === 'vi' ? 'Chờ partner accept' : 'Awaiting partner',
    noPartnerYet: language === 'vi' ? 'Chưa có' : 'None yet',
    removeFromTour: language === 'vi' ? 'Loại khỏi giải' : 'Remove from event',
    pendingTeams: language === 'vi' ? 'Đội chờ duyệt' : 'Pending teams',
    approvedTeams: language === 'vi' ? 'Đội đã duyệt' : 'Approved teams',
    rejectedTeams: language === 'vi' ? 'Đội bị từ chối / loại' : 'Rejected / removed teams',
    allRegistered: language === 'vi' ? 'Các đội đã đăng ký' : 'Registered teams',
    fullPairs: language === 'vi' ? 'Đủ đội' : 'Full pairs',
    rejectedOrRemoved: language === 'vi' ? 'Từ chối / Loại' : 'Rejected / Removed',
    minTeamsToast: language === 'vi' ? 'Cần ít nhất 3 đội được duyệt' : 'Need at least 3 approved teams',
    selected: language === 'vi' ? 'đã chọn' : 'selected',
    approveSelected: language === 'vi' ? 'Duyệt' : 'Approve',
    rejectSelected: language === 'vi' ? 'Từ chối' : 'Reject',
    rejectTeam: language === 'vi' ? 'Từ chối đội' : 'Reject team',
    removeTeam: language === 'vi' ? 'Loại đội khỏi giải' : 'Remove team from event',
    noteOptional: language === 'vi' ? 'Ghi chú (tùy chọn)' : 'Note (optional)',
    notePlaceholder: language === 'vi' ? 'Lý do từ chối hoặc loại...' : 'Reason for rejection or removal...',
    cancel: language === 'vi' ? 'Hủy' : 'Cancel',
    rejectConfirm: language === 'vi' ? 'Từ chối' : 'Reject',
    removeConfirm: language === 'vi' ? 'Loại khỏi giải' : 'Remove from event',
    selectAll: language === 'vi' ? 'Chọn tất cả' : 'Select all',
    readyToBracket: language === 'vi' ? 'Sẵn sàng chia bảng' : 'Ready to create brackets',
    teamsApprovedCount: (n: number) =>
      language === 'vi' ? `Có ${n} đội đã được duyệt` : `${n} teams approved`,
    createBracket: language === 'vi' ? 'Chia bảng' : 'Create brackets',
    noTeamsYet: language === 'vi' ? 'Chưa có đội nào đăng ký' : 'No teams have registered yet',
    shareLink: language === 'vi' ? 'Chia sẻ link đăng ký để VĐV có thể tham gia' : 'Share the registration link so players can join',
    btcApprovedToast: (n: number) =>
      language === 'vi' ? `Đã duyệt ${n} đội` : `Approved ${n} teams`,
    btcRejectedToast: (n: number) =>
      language === 'vi' ? `Đã từ chối ${n} đội` : `Rejected ${n} teams`,
    chooseName: (name: string) =>
      language === 'vi' ? `Chọn ${name}` : `Select ${name}`,
    notesLabel: language === 'vi' ? 'Ghi chú' : 'Notes',
    btcRemoved: language === 'vi' ? 'Đã loại' : 'Removed',
    btcRejected: language === 'vi' ? 'Từ chối' : 'Rejected',
    btcApproved: language === 'vi' ? 'Đã duyệt' : 'Approved',
    btcPending: language === 'vi' ? 'Chờ duyệt' : 'Pending',
  };

  const loadTeams = async () => {
    setLoading(true);
    const data = await getTableTeams(tableId);
    setTeams(data);
    setLoading(false);

    const pendingCount = data.filter(
      tm => !tm.btc_approved && tm.team_status !== 'rejected' && tm.team_status !== 'removed',
    ).length;
    onPendingCountChange?.(pendingCount);
  };

  useEffect(() => {
    loadTeams();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`teams-${tableId}:${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'quick_table_teams',
            filter: `table_id=eq.${tableId}`,
          },
          () => {
            loadTeams();
          },
        )
        .subscribe();
    } catch (err) {
      console.warn('[TeamManager] Realtime setup failed:', err);
    }

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [tableId]);

  const allRegisteredTeams = teams.filter(tm => tm.team_status !== 'rejected' && tm.team_status !== 'removed');
  const pendingTeams = teams.filter(
    tm => !tm.btc_approved && tm.team_status !== 'rejected' && tm.team_status !== 'removed',
  );
  const approvedTeams = teams.filter(tm => tm.btc_approved && tm.team_status !== 'removed');
  const rejectedTeams = teams.filter(tm => tm.team_status === 'rejected');
  const removedTeams = teams.filter(tm => tm.team_status === 'removed');

  const handleAction = async (teamId: string, action: 'approve' | 'reject' | 'remove', actionNotes?: string) => {
    const success = await btcManageTeam(teamId, action, actionNotes);
    if (success) {
      loadTeams();
      setNoteDialog(null);
      setNotes('');
      setSelectedIds(prev => prev.filter(id => id !== teamId));
    }
  };

  const handleBatchApprove = async () => {
    if (selectedIds.length === 0) return;
    setBatchLoading(true);
    let successCount = 0;
    for (const id of selectedIds) {
      const success = await btcManageTeam(id, 'approve');
      if (success) successCount++;
    }
    setBatchLoading(false);
    setSelectedIds([]);
    loadTeams();
    if (successCount > 0) toast.success(txt.btcApprovedToast(successCount));
  };

  const handleBatchReject = async () => {
    if (selectedIds.length === 0) return;
    setBatchLoading(true);
    let successCount = 0;
    for (const id of selectedIds) {
      const success = await btcManageTeam(id, 'reject');
      if (success) successCount++;
    }
    setBatchLoading(false);
    setSelectedIds([]);
    loadTeams();
    if (successCount > 0) toast.success(txt.btcRejectedToast(successCount));
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const toggleSelectAllPending = () => {
    const pendingIds = pendingTeams.map(tm => tm.id);
    const allSelected = pendingIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !pendingIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...pendingIds])]);
    }
  };

  const handleStartBracket = () => {
    if (approvedTeams.length < 3) {
      toast.error(txt.minTeamsToast);
      return;
    }
    setShowBracketSetup(true);
  };

  // ─── Helpers: pair pill + status pill + skill pill ──────────────────────
  const renderPairStatus = (team: Team) => {
    if (team.player2_user_id) {
      const p = statusPillPalette('pair-complete');
      return (
        <span style={{ ...statusPillBase, background: p.bg, color: p.fg, border: `1px solid ${p.border}` }}>
          <Users className="w-3 h-3" />
          {txt.pairComplete}
        </span>
      );
    }
    const p = statusPillPalette('pair-incomplete');
    return (
      <span style={{ ...statusPillBase, background: p.bg, color: p.fg, border: `1px solid ${p.border}` }}>
        <UserMinus className="w-3 h-3" />
        {txt.pairIncomplete}
      </span>
    );
  };

  const renderTeamStatusPill = (team: Team) => {
    if (team.team_status === 'removed') {
      const p = statusPillPalette('removed');
      return (
        <span style={{ ...statusPillBase, background: p.bg, color: p.fg }}>
          <Trash2 className="w-3 h-3" />
          {txt.btcRemoved}
        </span>
      );
    }
    if (team.team_status === 'rejected') {
      const p = statusPillPalette('rejected');
      return (
        <span style={{ ...statusPillBase, background: p.bg, color: p.fg }}>
          <XCircle className="w-3 h-3" />
          {txt.btcRejected}
        </span>
      );
    }
    if (team.btc_approved) {
      const p = statusPillPalette('approved');
      return (
        <span style={{ ...statusPillBase, background: p.bg, color: p.fg }}>
          <CheckCircle2 className="w-3 h-3" />
          {txt.btcApproved}
        </span>
      );
    }
    const p = statusPillPalette('pending');
    return (
      <span style={{ ...statusPillBase, background: p.bg, color: p.fg }}>
        <Clock className="w-3 h-3" />
        {txt.btcPending}
      </span>
    );
  };

  // DUPR / Skill pill per player (slot reserved for upcoming DUPR integration)
  const renderPlayerSkillPill = (
    skillLevel: number | null | undefined,
    ratingSystem: string | null | undefined,
    profileLink: string | null | undefined,
  ) => {
    if (ratingSystem === 'DUPR' && skillLevel != null) {
      return <span style={duprPillStyle}>DUPR {skillLevel}</span>;
    }
    if (ratingSystem === 'other' && skillLevel != null) {
      const labelMatch = profileLink?.startsWith('[') ? profileLink.match(/\[(.*?)\]/)?.[1] : null;
      return (
        <span style={duprPillStyle}>
          {labelMatch ? `${labelMatch} ` : ''}
          {skillLevel}
        </span>
      );
    }
    if (skillLevel != null) {
      return <span style={duprPillStyle}>{skillLevel}</span>;
    }
    return <span style={{ color: 'var(--tl-fg-4)', fontSize: 12 }}>—</span>;
  };

  // ─── Loading ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ ...surfaceCard, padding: 32, textAlign: 'center' }}>
        <RefreshCw
          className="w-6 h-6 animate-spin"
          style={{ color: 'var(--tl-fg-3)', margin: '0 auto 8px' }}
        />
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
      {/* Stats — 4 cells */}
      <div
        style={{
          ...surfaceCard,
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 1,
          background: 'var(--tl-border)',
          overflow: 'hidden',
        }}
        className="md:!grid-cols-4"
      >
        <div style={{ background: 'var(--tl-bg-elev)' }}>
          <StatCell icon={<Clock className="w-5 h-5" />} count={pendingTeams.length} label={txt.pendingTeams} kind="pending" />
        </div>
        <div style={{ background: 'var(--tl-bg-elev)' }}>
          <StatCell
            icon={<CheckCircle2 className="w-5 h-5" />}
            count={approvedTeams.length}
            label={txt.approvedTeams}
            kind="approved"
          />
        </div>
        <div style={{ background: 'var(--tl-bg-elev)' }}>
          <StatCell
            icon={<Users className="w-5 h-5" />}
            count={approvedTeams.filter(tm => tm.player2_user_id).length}
            label={txt.fullPairs}
            kind="pair-complete"
          />
        </div>
        <div style={{ background: 'var(--tl-bg-elev)' }}>
          <StatCell
            icon={<XCircle className="w-5 h-5" />}
            count={rejectedTeams.length + removedTeams.length}
            label={txt.rejectedOrRemoved}
            kind="rejected"
          />
        </div>
      </div>

      {/* Ready-to-bracket banner */}
      {approvedTeams.length >= 3 && (
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
              <Swords
                className="inline w-4 h-4 mr-2"
                style={{ color: 'var(--tl-green)', verticalAlign: 'middle' }}
              />
              {txt.readyToBracket}
            </h3>
            <p style={{ fontSize: 13.5, color: 'var(--tl-fg-2)', margin: 0 }}>
              {txt.teamsApprovedCount(approvedTeams.length)}
            </p>
          </div>
          <button type="button" className="tl-btn green" onClick={handleStartBracket}>
            <Swords className="w-4 h-4" />
            {txt.createBracket}
          </button>
        </div>
      )}

      {/* Registered teams */}
      {allRegisteredTeams.length > 0 && (
        <div style={surfaceCard}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '14px 16px',
              borderBottom: '1px solid var(--tl-border)',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />
              <h3 style={sectionTitle}>{txt.allRegistered}</h3>
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
                {allRegisteredTeams.length}
              </span>
            </div>
            {pendingTeams.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {selectedIds.length > 0 && (
                  <span
                    style={{
                      fontFamily: 'Geist Mono, ui-monospace, monospace',
                      fontSize: 11,
                      color: 'var(--tl-fg-3)',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {selectedIds.length} {txt.selected}
                  </span>
                )}
                <button
                  type="button"
                  className="tl-btn"
                  onClick={handleBatchApprove}
                  disabled={selectedIds.length === 0 || batchLoading}
                  style={{
                    padding: '5px 10px',
                    fontSize: 12,
                    color: 'var(--tl-green)',
                  }}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {txt.approveSelected} ({selectedIds.length})
                </button>
                <button
                  type="button"
                  className="tl-btn"
                  onClick={handleBatchReject}
                  disabled={selectedIds.length === 0 || batchLoading}
                  style={{
                    padding: '5px 10px',
                    fontSize: 12,
                    color: 'var(--tl-live)',
                  }}
                >
                  <XCircle className="w-4 h-4" />
                  {txt.rejectSelected} ({selectedIds.length})
                </button>
              </div>
            )}
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {pendingTeams.length > 0 && (
                    <th style={{ ...headStyle, width: 44 }}>
                      <Checkbox
                        checked={pendingTeams.length > 0 && pendingTeams.every(tm => selectedIds.includes(tm.id))}
                        onCheckedChange={toggleSelectAllPending}
                        aria-label={txt.selectAll}
                      />
                    </th>
                  )}
                  <th style={{ ...headStyle, width: 36, textAlign: 'center' }}>#</th>
                  <th style={headStyle}>{txt.team}</th>
                  <th style={headStyle}>{txt.player1}</th>
                  <th style={headStyle}>{txt.player2}</th>
                  <th style={{ ...headStyle, width: 160 }}>
                    DUPR / {txt.skill}
                  </th>
                  <th style={{ ...headStyle, width: 130 }}>{txt.status}</th>
                  <th style={{ ...headStyle, textAlign: 'right', width: 110 }}>{txt.actions}</th>
                </tr>
              </thead>
              <tbody>
                {allRegisteredTeams.map((team, idx) => (
                  <tr
                    key={team.id}
                    onMouseEnter={onRowEnter}
                    onMouseLeave={onRowLeave}
                    style={{ transition: 'background 0.15s' }}
                  >
                    {pendingTeams.length > 0 && (
                      <td style={cellStyle}>
                        {!team.btc_approved && (
                          <Checkbox
                            checked={selectedIds.includes(team.id)}
                            onCheckedChange={() => toggleSelect(team.id)}
                            aria-label={txt.chooseName(team.player1_display_name)}
                          />
                        )}
                      </td>
                    )}
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
                    <td style={cellStyle}>{renderPairStatus(team)}</td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span
                          style={{
                            fontFamily: 'Instrument Serif, serif',
                            fontStyle: 'italic',
                            fontSize: 17,
                            fontWeight: 400,
                            letterSpacing: '-0.01em',
                            color: 'var(--tl-fg)',
                          }}
                        >
                          {team.player1_display_name}
                        </span>
                        {team.player1_team && (
                          <span style={{ fontSize: 12, color: 'var(--tl-fg-3)' }}>{team.player1_team}</span>
                        )}
                      </div>
                    </td>
                    <td style={cellStyle}>
                      {team.player2_user_id ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span
                            style={{
                              fontFamily: 'Instrument Serif, serif',
                              fontStyle: 'italic',
                              fontSize: 17,
                              fontWeight: 400,
                              letterSpacing: '-0.01em',
                              color: 'var(--tl-fg)',
                            }}
                          >
                            {team.player2_display_name}
                          </span>
                          {team.player2_team && (
                            <span style={{ fontSize: 12, color: 'var(--tl-fg-3)' }}>{team.player2_team}</span>
                          )}
                        </div>
                      ) : (
                        <span
                          style={{
                            fontStyle: 'italic',
                            color: 'var(--tl-fg-4)',
                            fontSize: 13,
                          }}
                        >
                          {txt.noPartnerYet}
                        </span>
                      )}
                    </td>
                    <td style={cellStyle}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontFamily: 'Geist Mono, ui-monospace, monospace',
                              fontSize: 10,
                              color: 'var(--tl-fg-4)',
                              letterSpacing: '0.04em',
                              minWidth: 24,
                            }}
                          >
                            P1
                          </span>
                          {renderPlayerSkillPill(
                            team.player1_skill_level,
                            team.player1_rating_system,
                            team.player1_profile_link,
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              fontFamily: 'Geist Mono, ui-monospace, monospace',
                              fontSize: 10,
                              color: 'var(--tl-fg-4)',
                              letterSpacing: '0.04em',
                              minWidth: 24,
                            }}
                          >
                            P2
                          </span>
                          {team.player2_user_id
                            ? renderPlayerSkillPill(
                                team.player2_skill_level,
                                team.player2_rating_system,
                                team.player2_profile_link,
                              )
                            : <span style={{ color: 'var(--tl-fg-4)', fontSize: 12 }}>—</span>}
                        </div>
                      </div>
                    </td>
                    <td style={cellStyle}>{renderTeamStatusPill(team)}</td>
                    <td style={{ ...cellStyle, textAlign: 'right' }}>
                      {!team.btc_approved ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <button
                            type="button"
                            className="tl-btn"
                            onClick={() => handleAction(team.id, 'approve')}
                            aria-label={t.quickTable.approve}
                            style={{ padding: '5px 8px', color: 'var(--tl-green)' }}
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            className="tl-btn"
                            onClick={() => setNoteDialog({ team, action: 'reject' })}
                            aria-label={t.quickTable.reject}
                            style={{ padding: '5px 8px', color: 'var(--tl-live)' }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
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
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setNoteDialog({ team, action: 'remove' })}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              {txt.removeFromTour}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rejected / Removed (faded) */}
      {(rejectedTeams.length > 0 || removedTeams.length > 0) && (
        <div style={{ ...surfaceCard, opacity: 0.7 }}>
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
            <h3 style={{ ...sectionTitle, color: 'var(--tl-fg-2)' }}>{txt.rejectedTeams}</h3>
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
              {rejectedTeams.length + removedTeams.length}
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={headStyle}>{txt.team}</th>
                  <th style={{ ...headStyle, width: 140 }}>{txt.status}</th>
                  <th style={headStyle}>{txt.notesLabel}</th>
                </tr>
              </thead>
              <tbody>
                {[...rejectedTeams, ...removedTeams].map(team => (
                  <tr
                    key={team.id}
                    onMouseEnter={onRowEnter}
                    onMouseLeave={onRowLeave}
                    style={{ transition: 'background 0.15s' }}
                  >
                    <td
                      style={{
                        ...cellStyle,
                        fontFamily: 'Instrument Serif, serif',
                        fontStyle: 'italic',
                        fontSize: 16,
                      }}
                    >
                      {team.player1_display_name}
                      {team.player2_display_name && (
                        <span style={{ color: 'var(--tl-fg-3)' }}> / {team.player2_display_name}</span>
                      )}
                    </td>
                    <td style={cellStyle}>{renderTeamStatusPill(team)}</td>
                    <td style={{ ...cellStyle, fontSize: 12.5, color: 'var(--tl-fg-3)' }}>
                      {team.btc_notes || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {teams.length === 0 && (
        <div className="tl-empty-card" style={{ padding: '48px 24px' }}>
          <span className="tl-empty-card-mark">◌</span>
          <span className="tl-empty-card-label">{txt.noTeamsYet}</span>
          <p className="tl-empty-card-hint">{txt.shareLink}</p>
        </div>
      )}

      {/* Note Dialog (reject / remove confirm) */}
      <Dialog open={!!noteDialog} onOpenChange={() => setNoteDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {noteDialog?.action === 'reject' && txt.rejectTeam}
              {noteDialog?.action === 'remove' && txt.removeTeam}
            </DialogTitle>
            <DialogDescription>
              {noteDialog?.team.player1_display_name}
              {noteDialog?.team.player2_display_name && ` / ${noteDialog.team.player2_display_name}`}
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="space-y-2">
              <Label htmlFor="btcRejectNotes" style={fieldLabel}>
                {txt.noteOptional}
              </Label>
              <Textarea
                id="btcRejectNotes"
                name="btcRejectNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={txt.notePlaceholder}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <button type="button" className="tl-btn" onClick={() => setNoteDialog(null)}>
              {txt.cancel}
            </button>
            <button
              type="button"
              className="tl-btn"
              onClick={() => noteDialog && handleAction(noteDialog.team.id, noteDialog.action, notes)}
              style={{ color: 'var(--tl-live)' }}
            >
              {noteDialog?.action === 'reject' ? txt.rejectConfirm : txt.removeConfirm}
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
          approvedPlayers={approvedTeams.map(team => ({
            name: `${team.player1_display_name}${team.player2_display_name ? ` / ${team.player2_display_name}` : ''}`,
            team: team.player1_team || team.player2_team,
            skill: team.player1_skill_level || null,
          }))}
        />
      )}
    </div>
  );
}

export default TeamManager;
