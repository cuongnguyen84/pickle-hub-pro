import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuickTable, type QuickTable } from '@/hooks/useQuickTable';
import { useI18n } from '@/i18n';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trash2, Plus, ArrowRight, Shuffle, Users, Wand2, Hand } from 'lucide-react';
import { toast } from 'sonner';
import { ManualGroupAssignment } from './ManualGroupAssignment';

interface PlayerInput {
  id: string;
  name: string;
  team: string;
  seed: string;
}

interface BracketSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  table: QuickTable;
  shareId: string;
  approvedPlayers: {
    name: string;
    team: string | null;
    skill: number | null;
  }[];
}

type AssignmentMode = 'auto' | 'manual';
type Step = 'input' | 'assignment';

// ─── Shared tokens (mirror W2.1a/b/c) ───────────────────────────────────
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

const tinyPill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10.5,
  fontWeight: 500,
  padding: '2px 8px',
  borderRadius: 999,
  background: 'var(--tl-surface)',
  border: '1px solid var(--tl-border)',
  color: 'var(--tl-fg-3)',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
};

const inputBase: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13.5,
  color: 'var(--tl-fg)',
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius)',
  padding: '7px 10px',
  outline: 'none',
  height: 36,
  boxSizing: 'border-box',
};

export function BracketSetupDialog({
  open,
  onOpenChange,
  table,
  shareId,
  approvedPlayers,
}: BracketSetupDialogProps) {
  const navigate = useNavigate();
  const { language } = useI18n();
  const {
    addPlayers,
    createGroups,
    assignPlayersToGroups,
    createGroupMatches,
    updateTableStatus,
    getTableByShareId,
  } = useQuickTable();

  const [saving, setSaving] = useState(false);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('auto');
  const [step, setStep] = useState<Step>('input');
  const [players, setPlayers] = useState<PlayerInput[]>(() =>
    approvedPlayers.map((p, idx) => ({
      id: `approved-${idx}`,
      name: p.name,
      team: p.team || '',
      seed: '',
    })),
  );

  // Bilingual labels — inline ternary, scoped to BTC bracket-setup chrome
  const txt = {
    titleManual: language === 'vi' ? 'Chia bảng thủ công' : 'Manual bracket assignment',
    titleAuto: language === 'vi' ? 'Chia bảng' : 'Create brackets',
    formatRoundRobin: language === 'vi' ? 'Round Robin' : 'Round Robin',
    formatPlayoff: language === 'vi' ? 'Playoff đông người' : 'Large playoff',
    groups: (n: number) => (language === 'vi' ? `${n} bảng` : `${n} groups`),
    playerCount: (n: number) => (language === 'vi' ? `${n} VĐV` : `${n} players`),
    playersApproved: (n: number) =>
      language === 'vi' ? `${n} VĐV đã duyệt` : `${n} approved players`,
    playerListTitle: language === 'vi' ? 'Danh sách VĐV' : 'Player list',
    shuffle: language === 'vi' ? 'Xáo trộn' : 'Shuffle',
    namePlaceholder: language === 'vi' ? 'Tên VĐV *' : 'Player name *',
    teamPlaceholder: language === 'vi' ? 'Team' : 'Team',
    seedPlaceholder: language === 'vi' ? 'Seed' : 'Seed',
    addPlayer: language === 'vi' ? 'Thêm VĐV' : 'Add player',
    methodTitle: language === 'vi' ? 'Phương thức chia bảng' : 'Assignment method',
    autoTitle: language === 'vi' ? 'Tự động' : 'Auto',
    autoDesc: language === 'vi' ? 'Chia đều, tránh cùng team' : 'Balanced, avoids same team',
    manualTitle: language === 'vi' ? 'Thủ công' : 'Manual',
    manualDesc:
      language === 'vi' ? 'Tự chọn VĐV vào từng bảng' : 'Pick players for each group',
    tipsTitle: language === 'vi' ? 'Mẹo chia bảng tốt:' : 'Tips for good groups:',
    tip1: language === 'vi'
      ? 'Nhập Team để tránh cùng team vào cùng bảng'
      : 'Enter Team to avoid same-team players in one group',
    tip2: language === 'vi'
      ? 'Đánh số Seed (1 = mạnh nhất) để rải hạt giống đều các bảng'
      : 'Number Seeds (1 = strongest) to spread seeds evenly across groups',
    tipAuto: language === 'vi'
      ? 'Hệ thống sẽ tự động chia người chơi vào các bảng đều nhau'
      : 'System will distribute players evenly across groups',
    tipManual: language === 'vi'
      ? 'Bạn sẽ tự phân VĐV vào từng bảng ở bước tiếp theo'
      : 'You will assign players to groups in the next step',
    cancel: language === 'vi' ? 'Hủy' : 'Cancel',
    proceedManual: language === 'vi' ? 'Tiếp tục chia bảng' : 'Proceed to assignment',
    createBracket: language === 'vi' ? 'Tạo bảng đấu' : 'Create brackets',
    processing: language === 'vi' ? 'Đang xử lý…' : 'Processing…',
    minPlayersToast: language === 'vi' ? 'Cần ít nhất 2 người chơi' : 'Need at least 2 players',
    failedToAdd: language === 'vi' ? 'Không thể thêm VĐV' : 'Failed to add players',
    failedGroups: language === 'vi' ? 'Không thể tạo bảng' : 'Failed to create groups',
    failedRefresh: language === 'vi' ? 'Không thể làm mới dữ liệu' : 'Failed to refresh data',
    successAuto: language === 'vi' ? 'Đã tạo bảng đấu thành công!' : 'Brackets created!',
    successManual: language === 'vi' ? 'Đã chia bảng thủ công thành công!' : 'Manual assignment saved!',
    genericError: language === 'vi' ? 'Có lỗi xảy ra, vui lòng thử lại' : 'Something went wrong, please try again',
    seqIndex: '#',
    remove: language === 'vi' ? 'Xóa' : 'Remove',
  };

  const updatePlayer = (index: number, field: keyof PlayerInput, value: string) => {
    setPlayers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addPlayerSlot = () => {
    setPlayers(prev => [
      ...prev,
      { id: `new-${prev.length}`, name: '', team: '', seed: '' },
    ]);
  };

  const removePlayerSlot = (index: number) => {
    if (players.length <= 2) return;
    setPlayers(prev => prev.filter((_, i) => i !== index));
  };

  const shufflePlayers = () => {
    setPlayers(prev => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
  };

  const filledPlayers = players.filter(p => p.name.trim());

  const handleProceedToAssignment = () => {
    if (filledPlayers.length < 2) {
      toast.error(txt.minPlayersToast);
      return;
    }

    if (assignmentMode === 'manual' && table.format === 'round_robin' && table.group_count) {
      setStep('assignment');
    } else {
      handleAutoSubmit();
    }
  };

  const handleAutoSubmit = async () => {
    setSaving(true);
    try {
      const playerData = filledPlayers.map(p => ({
        name: p.name.trim(),
        team: p.team.trim() || undefined,
        seed: p.seed ? parseInt(p.seed) : undefined,
      }));

      const createdPlayers = await addPlayers(table.id, playerData);
      if (createdPlayers.length === 0) throw new Error(txt.failedToAdd);

      if (table.format === 'round_robin' && table.group_count) {
        const groups = await createGroups(table.id, table.group_count);
        if (groups.length === 0) throw new Error(txt.failedGroups);

        await assignPlayersToGroups(createdPlayers, groups);

        const refreshed = await getTableByShareId(shareId);
        if (!refreshed) throw new Error(txt.failedRefresh);

        for (const group of groups) {
          const groupPlayers = refreshed.players.filter(p => p.group_id === group.id);
          if (groupPlayers.length >= 2) {
            await createGroupMatches(table.id, group.id, groupPlayers.map(p => p.id));
          }
        }

        await updateTableStatus(table.id, 'group_stage');
      } else {
        await updateTableStatus(table.id, 'group_stage');
      }

      toast.success(txt.successAuto);
      onOpenChange(false);
      navigate(`/tools/quick-tables/${shareId}?tab=groups`);
    } catch (error) {
      console.error('[BracketSetupDialog] auto submit failed:', error);
      toast.error(txt.genericError);
    } finally {
      setSaving(false);
    }
  };

  const handleManualAssignmentComplete = async (groupAssignments: Map<number, PlayerInput[]>) => {
    if (!table.group_count) return;
    setSaving(true);

    try {
      const playerData = filledPlayers.map(p => ({
        name: p.name.trim(),
        team: p.team.trim() || undefined,
        seed: p.seed ? parseInt(p.seed) : undefined,
      }));

      const createdPlayers = await addPlayers(table.id, playerData);
      if (createdPlayers.length === 0) throw new Error(txt.failedToAdd);

      const playerMap = new Map<string, typeof createdPlayers[0]>();
      filledPlayers.forEach((inputPlayer, index) => {
        playerMap.set(inputPlayer.id, createdPlayers[index]);
      });

      const groups = await createGroups(table.id, table.group_count);
      if (groups.length === 0) throw new Error(txt.failedGroups);

      for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
        const group = groups[groupIndex];
        const assignedInputPlayers = groupAssignments.get(groupIndex) || [];

        const playersToAssign = assignedInputPlayers
          .map(ip => playerMap.get(ip.id))
          .filter(Boolean) as typeof createdPlayers;

        if (playersToAssign.length > 0) {
          await assignPlayersToGroups(playersToAssign, [group]);
        }
      }

      const refreshed = await getTableByShareId(shareId);
      if (!refreshed) throw new Error(txt.failedRefresh);

      for (const group of groups) {
        const groupPlayers = refreshed.players.filter(p => p.group_id === group.id);
        if (groupPlayers.length >= 2) {
          await createGroupMatches(table.id, group.id, groupPlayers.map(p => p.id));
        }
      }

      await updateTableStatus(table.id, 'group_stage');

      toast.success(txt.successManual);
      onOpenChange(false);
      navigate(`/tools/quick-tables/${shareId}?tab=groups`);
    } catch (error) {
      console.error('[BracketSetupDialog] manual assignment failed:', error);
      toast.error(txt.genericError);
    } finally {
      setSaving(false);
    }
  };

  // ─── Step: manual assignment ────────────────────────────────────────────
  if (step === 'assignment' && table.group_count) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Hand className="w-5 h-5" style={{ color: 'var(--tl-fg-2)' }} />
              {txt.titleManual} — {table.name}
            </DialogTitle>
            <DialogDescription>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                <span style={tinyPill}>
                  {table.format === 'round_robin' ? txt.formatRoundRobin : txt.formatPlayoff}
                </span>
                <span style={tinyPill}>{txt.groups(table.group_count)}</span>
                <span style={{ color: 'var(--tl-fg-3)' }}>•</span>
                <span style={{ color: 'var(--tl-fg-3)', fontSize: 13 }}>
                  {txt.playerCount(filledPlayers.length)}
                </span>
              </span>
            </DialogDescription>
          </DialogHeader>

          <ManualGroupAssignment
            players={filledPlayers}
            groupCount={table.group_count}
            onComplete={handleManualAssignmentComplete}
            onCancel={() => setStep('input')}
          />

          {saving && (
            <div
              style={{
                textAlign: 'center',
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 11,
                color: 'var(--tl-fg-3)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {txt.processing}
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  // ─── Step: input ────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {txt.titleAuto} — {table.name}
          </DialogTitle>
          <DialogDescription>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
              <span style={tinyPill}>
                {table.format === 'round_robin' ? txt.formatRoundRobin : txt.formatPlayoff}
              </span>
              {table.group_count && <span style={tinyPill}>{txt.groups(table.group_count)}</span>}
              <span style={{ color: 'var(--tl-fg-3)' }}>•</span>
              <span style={{ color: 'var(--tl-fg-3)', fontSize: 13 }}>
                {txt.playersApproved(players.length)}
              </span>
            </span>
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <h3 style={{ ...sectionTitle, fontSize: 16 }}>{txt.playerListTitle}</h3>
            <button
              type="button"
              className="tl-btn"
              onClick={shufflePlayers}
              style={{ padding: '5px 10px', fontSize: 12 }}
            >
              <Shuffle className="w-4 h-4" />
              {txt.shuffle}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 280,
              overflowY: 'auto',
              padding: 2,
            }}
          >
            {players.map((player, index) => (
              <div key={player.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    width: 24,
                    flexShrink: 0,
                    textAlign: 'center',
                    fontFamily: 'Geist Mono, ui-monospace, monospace',
                    fontSize: 12,
                    color: 'var(--tl-fg-3)',
                    letterSpacing: '0.04em',
                  }}
                >
                  {index + 1}
                </span>
                <input
                  id={`bracket-player-name-${index}`}
                  name={`bracket-player-name-${index}`}
                  value={player.name}
                  onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                  placeholder={txt.namePlaceholder}
                  style={{ ...inputBase, flex: 1, minWidth: 0 }}
                />
                <input
                  id={`bracket-player-team-${index}`}
                  name={`bracket-player-team-${index}`}
                  value={player.team}
                  onChange={(e) => updatePlayer(index, 'team', e.target.value)}
                  placeholder={txt.teamPlaceholder}
                  style={{ ...inputBase, width: 96, flexShrink: 0 }}
                />
                <input
                  id={`bracket-player-seed-${index}`}
                  name={`bracket-player-seed-${index}`}
                  type="number"
                  value={player.seed}
                  onChange={(e) => updatePlayer(index, 'seed', e.target.value)}
                  placeholder={txt.seedPlaceholder}
                  min={1}
                  style={{ ...inputBase, width: 70, flexShrink: 0 }}
                />
                <button
                  type="button"
                  onClick={() => removePlayerSlot(index)}
                  disabled={players.length <= 2}
                  aria-label={txt.remove}
                  style={{
                    width: 36,
                    height: 36,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: '1px solid transparent',
                    borderRadius: 'var(--tl-radius)',
                    color: players.length <= 2 ? 'var(--tl-fg-4)' : 'var(--tl-fg-3)',
                    cursor: players.length <= 2 ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                    transition: 'color 0.15s, border-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (players.length > 2) {
                      (e.currentTarget as HTMLElement).style.color = 'var(--tl-live)';
                      (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color =
                      players.length <= 2 ? 'var(--tl-fg-4)' : 'var(--tl-fg-3)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="tl-btn"
            onClick={addPlayerSlot}
            style={{ width: '100%', justifyContent: 'center', padding: '8px 12px' }}
          >
            <Plus className="w-4 h-4" />
            {txt.addPlayer}
          </button>

          {/* Assignment Mode — only for round_robin with groups */}
          {table.format === 'round_robin' && table.group_count && (
            <div style={{ paddingTop: 12, borderTop: '1px solid var(--tl-border)' }}>
              <p style={{ ...fieldLabel, marginBottom: 10 }}>{txt.methodTitle}</p>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                }}
              >
                {(['auto', 'manual'] as const).map((mode) => {
                  const checked = assignmentMode === mode;
                  return (
                    <label
                      key={mode}
                      htmlFor={`dialog-mode-${mode}`}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: 12,
                        borderRadius: 'var(--tl-radius)',
                        border: `1px solid ${checked ? 'var(--tl-green)' : 'var(--tl-border)'}`,
                        background: checked ? 'var(--tl-green-glow)' : 'var(--tl-bg-elev)',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s, background 0.15s',
                      }}
                    >
                      <input
                        type="radio"
                        id={`dialog-mode-${mode}`}
                        name="dialog-assignment-mode"
                        value={mode}
                        checked={checked}
                        onChange={() => setAssignmentMode(mode)}
                        style={{
                          position: 'absolute',
                          width: 1,
                          height: 1,
                          padding: 0,
                          margin: -1,
                          overflow: 'hidden',
                          clip: 'rect(0,0,0,0)',
                          whiteSpace: 'nowrap',
                          border: 0,
                        }}
                      />
                      {mode === 'auto' ? (
                        <Wand2
                          className="w-5 h-5"
                          style={{ color: checked ? 'var(--tl-green)' : 'var(--tl-fg-2)', flexShrink: 0, marginTop: 2 }}
                        />
                      ) : (
                        <Hand
                          className="w-5 h-5"
                          style={{ color: checked ? 'var(--tl-green)' : 'var(--tl-fg-2)', flexShrink: 0, marginTop: 2 }}
                        />
                      )}
                      <div>
                        <p
                          style={{
                            fontFamily: 'Instrument Serif, serif',
                            fontStyle: 'italic',
                            fontSize: 16,
                            color: 'var(--tl-fg)',
                            margin: 0,
                            lineHeight: 1.2,
                          }}
                        >
                          {mode === 'auto' ? txt.autoTitle : txt.manualTitle}
                        </p>
                        <p
                          style={{
                            fontSize: 12,
                            color: 'var(--tl-fg-3)',
                            margin: '4px 0 0',
                            lineHeight: 1.4,
                          }}
                        >
                          {mode === 'auto' ? txt.autoDesc : txt.manualDesc}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tips panel */}
          <div
            style={{
              padding: 12,
              borderRadius: 'var(--tl-radius)',
              background: 'var(--tl-bg)',
              border: '1px solid var(--tl-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <Users className="w-4 h-4" style={{ color: 'var(--tl-green)', flexShrink: 0, marginTop: 2 }} />
              <div>
                <p style={{ ...fieldLabel, margin: 0, color: 'var(--tl-fg-2)' }}>{txt.tipsTitle}</p>
                <ul
                  style={{
                    fontSize: 12.5,
                    color: 'var(--tl-fg-3)',
                    margin: '6px 0 0',
                    paddingLeft: 18,
                    lineHeight: 1.6,
                  }}
                >
                  <li>{txt.tip1}</li>
                  <li>{txt.tip2}</li>
                  {assignmentMode === 'auto' && <li>{txt.tipAuto}</li>}
                  {assignmentMode === 'manual' && <li>{txt.tipManual}</li>}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            className="tl-btn"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {txt.cancel}
          </button>
          <button
            type="button"
            className="tl-btn green"
            onClick={handleProceedToAssignment}
            disabled={saving || filledPlayers.length < 2}
          >
            {saving
              ? txt.processing
              : assignmentMode === 'manual' && table.format === 'round_robin' && table.group_count
                ? txt.proceedManual
                : txt.createBracket}
            <ArrowRight className="w-4 h-4" />
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
