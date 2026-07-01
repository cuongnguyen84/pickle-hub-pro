import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Users, AlertCircle, Shuffle, Sparkles, RotateCcw } from 'lucide-react';
import { suggestGroupConfigs, distributePlayersToGroups } from '@/hooks/useQuickTable';
import type { TeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useI18n } from '@/i18n';

// ─── W2.4d shared tokens ─────────────────────────────────────────────────
const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 20,
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
  gap: 4,
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10.5,
  fontWeight: 500,
  padding: '3px 9px',
  borderRadius: 4,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  background: 'var(--tl-surface)',
  color: 'var(--tl-fg-2)',
  border: '1px solid var(--tl-border)',
};

// Reveal cadence per pick (ms). Kept snappy so a 24-team draw stays ~11s.
const PICK_MS = 450;

interface DrawTeam {
  id: string;
  name: string;
  seed?: number;
}

interface GroupSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamMatchTeam[];
  isCreating: boolean;
  onConfirm: (groupCount: number, distribution: Array<Array<{ id: string; name: string }>>) => void;
}

type Phase = 'config' | 'drawing' | 'done';

export function GroupSetupDialog({
  open,
  onOpenChange,
  teams,
  isCreating,
  onConfirm,
}: GroupSetupDialogProps) {
  const [selectedGroupCount, setSelectedGroupCount] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('config');
  const [revealed, setRevealed] = useState(0);
  const { language, t } = useI18n();
  const c = t.teamMatchComponents;
  const vi = language === 'vi';

  const approvedTeams = useMemo(() => teams.filter((tm) => tm.status === 'approved'), [teams]);
  const teamCount = approvedTeams.length;

  const txt = {
    title: c.groupSetupTitle,
    desc: vi
      ? `Chọn số bảng rồi bốc thăm chia đội (${teamCount} đội đã duyệt)`
      : `Pick the group count, then run the draw (${teamCount} approved teams)`,
    chooseGroups: vi ? 'Chọn số bảng' : 'Pick group count',
    nGroups: (n: number) => (vi ? `${n} bảng` : `${n} groups`),
    teamsPerGroupRange: (min: number, max: number) =>
      vi ? `${min}-${max} đội/bảng` : `${min}-${max} teams/group`,
    recommended: vi ? 'Đề xuất' : 'Recommended',
    notEnoughTeams: vi
      ? 'Cần ít nhất 6 đội để chia bảng (mỗi bảng tối thiểu 3 đội)'
      : 'Need at least 6 teams to create groups (minimum 3 teams per group)',
    groupName: (i: number) => (vi ? `Bảng ${String.fromCharCode(65 + i)}` : `Group ${String.fromCharCode(65 + i)}`),
    snakeHint: vi
      ? 'Đội được rải theo thứ tự hạt giống (snake draft) để các bảng cân sức.'
      : 'Teams are seeded in snake-draft order so groups stay balanced.',
    cancel: vi ? 'Hủy' : 'Cancel',
    startDraw: vi ? 'Bốc thăm chia bảng' : 'Run the draw',
    drawing: vi ? 'Đang bốc thăm…' : 'Drawing…',
    drawingPick: (name: string, group: string) =>
      vi ? `Đang bốc: ${name} → ${group}` : `Drawing: ${name} → ${group}`,
    pickCounter: (a: number, b: number) => `${a}/${b}`,
    skip: vi ? 'Bỏ qua hiệu ứng' : 'Skip animation',
    redraw: vi ? 'Bốc lại' : 'Redraw',
    done: vi ? 'Bốc thăm hoàn tất' : 'Draw complete',
    confirm: vi ? 'Xác nhận chia bảng' : 'Confirm groups',
    processing: vi ? 'Đang tạo…' : 'Creating…',
    emptySlot: vi ? 'Chờ bốc…' : 'Awaiting…',
  };

  const groupSuggestions = useMemo(() => suggestGroupConfigs(teamCount), [teamCount]);

  const distribution = useMemo(() => {
    if (!selectedGroupCount) return null;
    const teamsForDistribution = approvedTeams.map((tm) => ({
      id: tm.id,
      name: tm.team_name,
      team: undefined,
      seed: tm.seed || undefined,
    }));
    return distributePlayersToGroups(teamsForDistribution, selectedGroupCount) as DrawTeam[][];
  }, [selectedGroupCount, approvedTeams]);

  // Draw order = flatten the distribution round-by-round in snake direction.
  // Since the distribution was built snake-first from seed order, this recovers
  // the true pick order (seed 1, 2, 3, …) so the reveal reads like a real draw.
  const drawSequence = useMemo(() => {
    if (!distribution) return [] as Array<{ team: DrawTeam; groupIndex: number }>;
    const maxLen = Math.max(...distribution.map((g) => g.length), 0);
    const seq: Array<{ team: DrawTeam; groupIndex: number }> = [];
    for (let round = 0; round < maxLen; round++) {
      const order =
        round % 2 === 0
          ? distribution.map((_, gi) => gi)
          : distribution.map((_, gi) => gi).reverse();
      for (const gi of order) {
        const team = distribution[gi][round];
        if (team) seq.push({ team, groupIndex: gi });
      }
    }
    return seq;
  }, [distribution]);

  const total = drawSequence.length;
  const revealedIds = useMemo(
    () => new Set(drawSequence.slice(0, revealed).map((d) => d.team.id)),
    [drawSequence, revealed],
  );
  const currentPick = phase === 'drawing' && revealed < total ? drawSequence[revealed] : null;

  // Reset to config whenever the dialog reopens or the group count changes.
  useEffect(() => {
    setPhase('config');
    setRevealed(0);
  }, [open, selectedGroupCount]);

  // Drive the reveal timer while drawing.
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (phase !== 'drawing') return;
    timerRef.current = setInterval(() => {
      setRevealed((r) => {
        if (r + 1 >= total) {
          if (timerRef.current) clearInterval(timerRef.current);
          setPhase('done');
          return total;
        }
        return r + 1;
      });
    }, PICK_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase, total]);

  const startDraw = () => {
    if (!selectedGroupCount || total === 0) return;
    setRevealed(0);
    setPhase('drawing');
  };

  const skipAnimation = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRevealed(total);
    setPhase('done');
  };

  const handleConfirm = () => {
    if (!selectedGroupCount || !distribution) return;
    onConfirm(
      selectedGroupCount,
      distribution.map((g) => g.map((tm) => ({ id: tm.id, name: tm.name }))),
    );
  };

  const showBoard = (phase === 'drawing' || phase === 'done') && distribution;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <style>{`
          @keyframes tmDrawIn {
            0% { opacity: 0; transform: translateY(-8px) scale(0.92); }
            60% { opacity: 1; transform: translateY(0) scale(1.03); }
            100% { opacity: 1; transform: none; }
          }
          @keyframes tmSpotlight {
            0%,100% { box-shadow: 0 0 0 1px var(--tl-green-dim); }
            50% { box-shadow: 0 0 0 2px var(--tl-green), 0 0 18px -2px var(--tl-green); }
          }
        `}</style>

        <DialogHeader>
          <DialogTitle style={sectionTitle}>{txt.title}</DialogTitle>
          <DialogDescription
            style={{ marginTop: 4, fontFamily: 'inherit', fontSize: 13, color: 'var(--tl-fg-3)' }}
          >
            {txt.desc}
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '8px 0' }}>
          {/* ── Group count selection (config phase) ── */}
          {phase === 'config' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h4 style={fieldLabel}>{txt.chooseGroups}</h4>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                  gap: 10,
                }}
              >
                {groupSuggestions.map((suggestion) => {
                  const checked = selectedGroupCount === suggestion.groupCount;
                  return (
                    <label
                      key={suggestion.groupCount}
                      htmlFor={`group-count-${suggestion.groupCount}`}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        padding: 14,
                        borderRadius: 'var(--tl-radius)',
                        border: `1px solid ${checked ? 'var(--tl-green)' : 'var(--tl-border)'}`,
                        background: checked ? 'var(--tl-green-glow)' : 'var(--tl-bg-elev)',
                        cursor: 'pointer',
                        transition: 'border-color 0.15s, background 0.15s',
                        position: 'relative',
                      }}
                    >
                      <input
                        type="radio"
                        id={`group-count-${suggestion.groupCount}`}
                        name="group-count"
                        value={suggestion.groupCount}
                        checked={checked}
                        onChange={() => setSelectedGroupCount(suggestion.groupCount)}
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
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                        <div>
                          <div
                            style={{
                              fontFamily: 'Instrument Serif, serif',
                              fontStyle: 'italic',
                              fontSize: 19,
                              color: 'var(--tl-fg)',
                              lineHeight: 1.1,
                            }}
                          >
                            {txt.nGroups(suggestion.groupCount)}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--tl-fg-3)', marginTop: 2 }}>
                            {txt.teamsPerGroupRange(
                              suggestion.playersPerGroup[0],
                              suggestion.playersPerGroup[suggestion.playersPerGroup.length - 1],
                            )}
                          </div>
                        </div>
                        {suggestion.isRecommended && <span style={tinyPill}>{txt.recommended}</span>}
                      </div>
                      <p style={{ fontSize: 11.5, color: 'var(--tl-fg-3)', margin: 0, lineHeight: 1.5 }}>
                        {suggestion.reason}
                      </p>
                      {checked && <Check className="h-4 w-4" style={{ color: 'var(--tl-green)', alignSelf: 'flex-end' }} />}
                    </label>
                  );
                })}
              </div>

              {groupSuggestions.length === 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '12px 14px',
                    borderRadius: 'var(--tl-radius)',
                    background: 'rgba(233, 182, 73, 0.08)',
                    border: '1px solid rgba(233, 182, 73, 0.35)',
                    color: 'var(--tl-fg-2)',
                    fontSize: 13,
                  }}
                >
                  <AlertCircle className="h-4 w-4" style={{ color: 'var(--tl-gold)' }} />
                  <p style={{ margin: 0 }}>{txt.notEnoughTeams}</p>
                </div>
              )}
            </div>
          )}

          {/* ── Draw spotlight ── */}
          {phase !== 'config' && (
            <div
              style={{
                ...surfaceCard,
                padding: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                background: phase === 'done' ? 'var(--tl-green-glow)' : 'var(--tl-bg-elev)',
                border: `1px solid ${phase === 'done' ? 'var(--tl-green-dim)' : 'var(--tl-border)'}`,
                minHeight: 64,
              }}
            >
              {phase === 'done' ? (
                <Sparkles className="h-5 w-5" style={{ color: 'var(--tl-green)', flexShrink: 0 }} />
              ) : (
                <Shuffle className="h-5 w-5" style={{ color: 'var(--tl-green)', flexShrink: 0 }} />
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {currentPick ? (
                  <div key={currentPick.team.id} style={{ animation: 'tmDrawIn 0.35s ease' }}>
                    <div style={{ fontSize: 12, color: 'var(--tl-fg-3)', ...fieldLabel }}>
                      {txt.drawing} {txt.pickCounter(revealed + 1, total)}
                    </div>
                    <div
                      style={{
                        fontFamily: 'Instrument Serif, serif',
                        fontStyle: 'italic',
                        fontSize: 20,
                        color: 'var(--tl-fg)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {currentPick.team.name}
                      <span style={{ color: 'var(--tl-green)' }}> → {txt.groupName(currentPick.groupIndex)}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontSize: 20, color: 'var(--tl-fg)' }}>
                    {txt.done}
                  </div>
                )}
              </div>
              {phase === 'drawing' && (
                <button
                  type="button"
                  className="tl-btn"
                  onClick={skipAnimation}
                  style={{ padding: '6px 10px', fontSize: 12, flexShrink: 0 }}
                >
                  {txt.skip}
                </button>
              )}
            </div>
          )}

          {/* ── Group board (fills progressively) ── */}
          {showBoard && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: 12,
                }}
              >
                {distribution!.map((group, gi) => {
                  const filled = group.filter((tm) => revealedIds.has(tm.id)).length;
                  const isTarget = currentPick?.groupIndex === gi;
                  return (
                    <div
                      key={gi}
                      style={{
                        ...surfaceCard,
                        padding: 14,
                        animation: isTarget ? 'tmSpotlight 0.45s ease' : undefined,
                        borderColor: isTarget ? 'var(--tl-green)' : 'var(--tl-border)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <span style={{ ...tinyPill, background: 'var(--tl-bg-elev)' }}>{txt.groupName(gi)}</span>
                        <span style={{ fontSize: 12, color: 'var(--tl-fg-3)' }}>
                          {txt.pickCounter(filled, group.length)}
                        </span>
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {group.map((team, slot) => {
                          const shown = revealedIds.has(team.id);
                          return (
                            <li
                              key={team.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 13,
                                minHeight: 30,
                                padding: '5px 8px',
                                borderRadius: 'var(--tl-radius)',
                                border: shown ? '1px solid var(--tl-border)' : '1px dashed var(--tl-border-2)',
                                background: shown ? 'var(--tl-surface)' : 'transparent',
                                color: shown ? 'var(--tl-fg)' : 'var(--tl-fg-3)',
                                animation: shown ? 'tmDrawIn 0.4s ease' : undefined,
                              }}
                            >
                              <span
                                style={{
                                  width: 22,
                                  height: 22,
                                  flexShrink: 0,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  borderRadius: 999,
                                  background: shown ? 'var(--tl-green-glow)' : 'var(--tl-surface)',
                                  color: shown ? 'var(--tl-green)' : 'var(--tl-fg-3)',
                                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                                  fontSize: 11,
                                  fontWeight: 600,
                                }}
                              >
                                {slot + 1}
                              </span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {shown ? team.name : txt.emptySlot}
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  );
                })}
              </div>

              <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--tl-fg-3)', margin: 0 }}>
                <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{txt.snakeHint}</span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <button type="button" className="tl-btn" onClick={() => onOpenChange(false)} disabled={isCreating}>
            {txt.cancel}
          </button>

          {phase === 'config' && (
            <button
              type="button"
              className="tl-btn green"
              onClick={startDraw}
              disabled={!selectedGroupCount || total === 0}
            >
              <Shuffle className="h-4 w-4" />
              {txt.startDraw}
            </button>
          )}

          {phase === 'drawing' && (
            <button type="button" className="tl-btn green" disabled>
              {txt.drawing} {txt.pickCounter(revealed, total)}
            </button>
          )}

          {phase === 'done' && (
            <>
              <button type="button" className="tl-btn" onClick={startDraw} disabled={isCreating}>
                <RotateCcw className="h-4 w-4" />
                {txt.redraw}
              </button>
              <button type="button" className="tl-btn green" onClick={handleConfirm} disabled={isCreating}>
                {isCreating ? txt.processing : txt.confirm}
              </button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
