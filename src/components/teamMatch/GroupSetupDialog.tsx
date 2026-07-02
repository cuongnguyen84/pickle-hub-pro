import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Check, Users, AlertCircle, AlertTriangle, Shuffle, Sparkles, RotateCcw, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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

// Draw pacing (ms) — ~4.5s per pick: scan → reveal (highlighted) → fly into group.
const FLICK_MS = 70;
const SCAN_MS = 2000;
const REVEAL_MS = 1500;
const FLY_MS = 950;

type SubPhase = 'scan' | 'reveal' | 'fly';
type Phase = 'config' | 'drawing' | 'done';

interface DrawTeam {
  id: string;
  name: string;
  seed?: number;
}
interface DrawPick {
  team: DrawTeam;
  groupIndex: number;
}
interface FlyState {
  name: string;
  x: number;
  y: number;
  tx: number;
  ty: number;
  active: boolean;
}

// Fisher-Yates. Math.random is fine in the browser (not a workflow sandbox).
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface GroupSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: TeamMatchTeam[];
  isCreating: boolean;
  /** Roster constraints for the pre-draw warning. */
  rosterSize?: number;
  requireDupr?: boolean;
  onConfirm: (groupCount: number, distribution: Array<Array<{ id: string; name: string }>>, randomizeGameOrder: boolean) => void;
}

export function GroupSetupDialog({
  open,
  onOpenChange,
  teams,
  isCreating,
  rosterSize = 4,
  requireDupr = false,
  onConfirm,
}: GroupSetupDialogProps) {
  const [selectedGroupCount, setSelectedGroupCount] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('config');
  const [revealed, setRevealed] = useState(0);
  const [subPhase, setSubPhase] = useState<SubPhase>('scan');
  const [spinName, setSpinName] = useState<string | null>(null);
  const [fly, setFly] = useState<FlyState | null>(null);
  const [revealOrder, setRevealOrder] = useState<DrawPick[]>([]);
  const [randomizeGameOrder, setRandomizeGameOrder] = useState(false);
  const { language, t } = useI18n();
  const c = t.teamMatchComponents;
  const vi = language === 'vi';

  const approvedTeams = useMemo(() => teams.filter((tm) => tm.status === 'approved'), [teams]);
  const teamCount = approvedTeams.length;

  // ─── Roster constraint check (warning only — never blocks the draw) ───
  const approvedIds = useMemo(() => approvedTeams.map((t) => t.id), [approvedTeams]);
  const { data: constraintRosters } = useQuery({
    queryKey: ['group-setup-rosters', [...approvedIds].sort().join(',')],
    queryFn: async () => {
      if (approvedIds.length === 0) return [] as { team_id: string; gender: string; user_id: string | null }[];
      const { data, error } = await supabase
        .from('team_match_roster').select('team_id, gender, user_id').in('team_id', approvedIds);
      if (error) throw error;
      return (data || []) as { team_id: string; gender: string; user_id: string | null }[];
    },
    enabled: open && approvedIds.length > 0,
  });
  const constraintUserIds = useMemo(
    () => [...new Set((constraintRosters || []).map((r) => r.user_id).filter((x): x is string => !!x))],
    [constraintRosters],
  );
  const { data: duprSet } = useQuery({
    queryKey: ['group-setup-dupr', [...constraintUserIds].sort().join(',')],
    queryFn: async () => {
      const s = new Set<string>();
      if (constraintUserIds.length === 0) return s;
      const { data } = await supabase.from('profiles').select('id, dupr_singles, dupr_doubles').in('id', constraintUserIds);
      (data || []).forEach((p: { id: string; dupr_singles: number | null; dupr_doubles: number | null }) => {
        if (p.dupr_doubles != null || p.dupr_singles != null) s.add(p.id);
      });
      return s;
    },
    enabled: open && requireDupr && constraintUserIds.length > 0,
  });

  const violations = useMemo(() => {
    if (!constraintRosters) return [] as { name: string; issues: string[] }[];
    const byTeam = new Map<string, { gender: string; user_id: string | null }[]>();
    constraintRosters.forEach((r) => { const l = byTeam.get(r.team_id) ?? []; l.push(r); byTeam.set(r.team_id, l); });
    const half = Math.floor(rosterSize / 2);
    const out: { name: string; issues: string[] }[] = [];
    approvedTeams.forEach((tm) => {
      const members = byTeam.get(tm.id) ?? [];
      const issues: string[] = [];
      if (members.length !== rosterSize) issues.push(vi ? `${members.length}/${rosterSize} người` : `${members.length}/${rosterSize} players`);
      const males = members.filter((m) => m.gender === 'male').length;
      const females = members.filter((m) => m.gender === 'female').length;
      if (males !== half || females !== half) issues.push(vi ? `${males} nam / ${females} nữ (cần ${half}/${half})` : `${males}M / ${females}F (need ${half}/${half})`);
      if (requireDupr) {
        const noDupr = members.filter((m) => !m.user_id || !duprSet?.has(m.user_id)).length;
        if (noDupr > 0) issues.push(vi ? `${noDupr} chưa có DUPR` : `${noDupr} without DUPR`);
      }
      if (issues.length) out.push({ name: tm.team_name, issues });
    });
    return out;
  }, [constraintRosters, duprSet, approvedTeams, rosterSize, requireDupr, vi]);

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
      ? 'Thứ tự bốc ngẫu nhiên; đội vẫn được rải cân sức theo hạt giống (snake).'
      : 'Random draw order; teams are still spread by seed (snake) for balance.',
    cancel: vi ? 'Hủy' : 'Cancel',
    startDraw: vi ? 'Bốc thăm chia bảng' : 'Run the draw',
    scanning: vi ? 'Đang bốc thăm…' : 'Drawing…',
    pickLabel: (n: number, total: number) => (vi ? `Lượt ${n}/${total}` : `Pick ${n}/${total}`),
    skip: vi ? 'Bỏ qua hiệu ứng' : 'Skip animation',
    redraw: vi ? 'Bốc lại' : 'Redraw',
    done: vi ? 'Bốc thăm hoàn tất' : 'Draw complete',
    confirm: vi ? 'Xác nhận chia bảng' : 'Confirm groups',
    processing: vi ? 'Đang tạo…' : 'Creating…',
    emptySlot: vi ? 'Chờ bốc…' : 'Awaiting…',
    randomOrderLabel: vi ? 'Thứ tự ra sân ngẫu nhiên' : 'Randomize game order',
    randomOrderHint: vi
      ? 'Mỗi trận sẽ có thứ tự các game (đôi nam / đôi nữ / đôi nam nữ) khác nhau, thay vì cố định theo lúc setup.'
      : 'Each match plays its games in a different order instead of the fixed setup order.',
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

  // Canonical picks (every team + its snake-assigned group). Reveal ORDER is
  // shuffled at draw time so the ceremony looks random, while the actual group
  // assignment stays seed-balanced.
  const allPicks = useMemo(() => {
    if (!distribution) return [] as DrawPick[];
    const picks: DrawPick[] = [];
    distribution.forEach((group, gi) => group.forEach((team) => picks.push({ team, groupIndex: gi })));
    return picks;
  }, [distribution]);

  const total = allPicks.length;
  const currentPick = phase === 'drawing' && revealed < revealOrder.length ? revealOrder[revealed] : null;

  // Teams already drawn into each group, in the order they were drawn (packed).
  const drawnByGroup = useMemo(() => {
    const map = new Map<number, DrawTeam[]>();
    revealOrder.slice(0, revealed).forEach((p) => {
      const list = map.get(p.groupIndex) ?? [];
      list.push(p.team);
      map.set(p.groupIndex, list);
    });
    return map;
  }, [revealOrder, revealed]);

  const boardWrapRef = useRef<HTMLDivElement>(null);
  const lockNameRef = useRef<HTMLSpanElement>(null);
  const nextSlotRefs = useRef<Map<number, HTMLLIElement>>(new Map()); // groupIndex → next empty slot
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const flick = useRef<ReturnType<typeof setInterval> | null>(null);
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (flick.current) clearInterval(flick.current);
  };

  // Reset whenever the dialog reopens or the group count changes.
  useEffect(() => {
    clearTimers();
    setPhase('config');
    setRevealed(0);
    setSubPhase('scan');
    setSpinName(null);
    setFly(null);
    setRevealOrder([]);
  }, [open, selectedGroupCount]);

  // Per-pick sequence: scan (flicker) → reveal (hold, scroll target into view)
  // → fly the name into its slot.
  useEffect(() => {
    if (phase !== 'drawing' || revealOrder.length === 0) return;
    if (revealed >= revealOrder.length) {
      setSubPhase('scan');
      setPhase('done');
      return;
    }

    const pick = revealOrder[revealed];
    const names = approvedTeams.map((tm) => tm.team_name);
    const rand = () => names[Math.floor(Math.random() * names.length)] ?? pick.team.name;

    setSubPhase('scan');
    setFly(null);
    setSpinName(rand());
    flick.current = setInterval(() => setSpinName(rand()), FLICK_MS);

    timers.current.push(
      setTimeout(() => {
        if (flick.current) clearInterval(flick.current);
        setSpinName(pick.team.name);
        setSubPhase('reveal');

        // Bring the destination group into view (auto-scroll) so the team can
        // fly into a visible slot even when the board overflows the screen.
        nextSlotRefs.current.get(pick.groupIndex)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

        timers.current.push(
          setTimeout(() => {
            const wrap = boardWrapRef.current?.getBoundingClientRect();
            const src = lockNameRef.current?.getBoundingClientRect();
            const dst = nextSlotRefs.current.get(pick.groupIndex)?.getBoundingClientRect();
            if (wrap && src && dst) {
              setFly({
                name: pick.team.name,
                x: src.left - wrap.left,
                y: src.top - wrap.top,
                tx: dst.left - wrap.left,
                ty: dst.top - wrap.top,
                active: false,
              });
              setSubPhase('fly');
              requestAnimationFrame(() =>
                requestAnimationFrame(() => setFly((f) => (f ? { ...f, active: true } : f))),
              );
              timers.current.push(
                setTimeout(() => {
                  setFly(null);
                  setRevealed((r) => r + 1);
                }, FLY_MS),
              );
            } else {
              setRevealed((r) => r + 1);
            }
          }, REVEAL_MS),
        );
      }, SCAN_MS),
    );

    return clearTimers;
  }, [phase, revealed, revealOrder, approvedTeams]);

  const startDraw = () => {
    if (!selectedGroupCount || total === 0) return;
    clearTimers();
    setFly(null);
    setSpinName(null);
    setSubPhase('scan');
    setRevealed(0);
    setRevealOrder(shuffle(allPicks));
    setPhase('drawing');
  };

  const skipAnimation = () => {
    clearTimers();
    setFly(null);
    setSpinName(null);
    setSubPhase('scan');
    setRevealed(revealOrder.length);
    setPhase('done');
  };

  const handleConfirm = () => {
    if (!selectedGroupCount || !distribution) return;
    onConfirm(
      selectedGroupCount,
      distribution.map((g) => g.map((tm) => ({ id: tm.id, name: tm.name }))),
      randomizeGameOrder,
    );
  };

  const showBoard = (phase === 'drawing' || phase === 'done') && distribution;
  const revealing = subPhase === 'reveal' || subPhase === 'fly';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <style>{`
          @keyframes tmDrawIn { 0%{opacity:0;transform:translateY(-8px) scale(.9)} 60%{opacity:1;transform:translateY(0) scale(1.04)} 100%{opacity:1;transform:none} }
          @keyframes tmRevealPop { 0%{opacity:0;transform:scale(.85)} 55%{opacity:1;transform:scale(1.06)} 100%{opacity:1;transform:scale(1)} }
          @keyframes tmSpotlight { 0%,100%{box-shadow:0 0 0 1px var(--tl-green-dim)} 50%{box-shadow:0 0 0 2px var(--tl-green),0 0 22px -2px var(--tl-green)} }
          @keyframes tmScanBlink { 0%,100%{opacity:.55} 50%{opacity:.9} }
          @keyframes tmArrow { 0%,100%{transform:translateX(0)} 50%{transform:translateX(4px)} }
        `}</style>

        <DialogHeader>
          <DialogTitle style={sectionTitle}>{txt.title}</DialogTitle>
          <DialogDescription style={{ marginTop: 4, fontFamily: 'inherit', fontSize: 13, color: 'var(--tl-fg-3)' }}>
            {txt.desc}
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '8px 0' }}>
          {/* ── Group count selection (config) ── */}
          {phase === 'config' && violations.length > 0 && (
            <div
              style={{
                padding: 14,
                borderRadius: 'var(--tl-radius)',
                background: 'rgba(233, 182, 73, 0.08)',
                border: '1px solid rgba(233, 182, 73, 0.4)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <AlertTriangle className="h-4 w-4" style={{ color: 'var(--tl-gold)' }} />
                <span style={{ fontWeight: 600, color: 'var(--tl-fg)', fontSize: 13.5 }}>
                  {vi ? `${violations.length} đội chưa đạt ràng buộc` : `${violations.length} team(s) don't meet the constraints`}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 8 }}>
                {violations.map((v) => (
                  <div key={v.name} style={{ fontSize: 12.5, color: 'var(--tl-fg-2)', lineHeight: 1.5 }}>
                    <span style={{ fontWeight: 500, color: 'var(--tl-fg)' }}>{v.name}</span>
                    {' — '}
                    <span style={{ color: 'var(--tl-gold)' }}>{v.issues.join(' · ')}</span>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--tl-fg-3)' }}>
                {vi
                  ? `Yêu cầu: ${rosterSize} người · ${Math.floor(rosterSize / 2)} nam ${Math.floor(rosterSize / 2)} nữ${requireDupr ? ' · tất cả có DUPR' : ''}. Bạn vẫn có thể chia bảng.`
                  : `Required: ${rosterSize} players · ${Math.floor(rosterSize / 2)}M ${Math.floor(rosterSize / 2)}F${requireDupr ? ' · all with DUPR' : ''}. You can still create the groups.`}
              </div>
            </div>
          )}

          {phase === 'config' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h4 style={fieldLabel}>{txt.chooseGroups}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 10 }}>
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
                        style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}
                      />
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                        <div>
                          <div style={{ fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontSize: 19, color: 'var(--tl-fg)', lineHeight: 1.1 }}>
                            {txt.nGroups(suggestion.groupCount)}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--tl-fg-3)', marginTop: 2 }}>
                            {txt.teamsPerGroupRange(suggestion.playersPerGroup[0], suggestion.playersPerGroup[suggestion.playersPerGroup.length - 1])}
                          </div>
                        </div>
                        {suggestion.isRecommended && <span style={tinyPill}>{txt.recommended}</span>}
                      </div>
                      <p style={{ fontSize: 11.5, color: 'var(--tl-fg-3)', margin: 0, lineHeight: 1.5 }}>{suggestion.reason}</p>
                      {checked && <Check className="h-4 w-4" style={{ color: 'var(--tl-green)', alignSelf: 'flex-end' }} />}
                    </label>
                  );
                })}
              </div>

              {groupSuggestions.length === 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 'var(--tl-radius)', background: 'rgba(233, 182, 73, 0.08)', border: '1px solid rgba(233, 182, 73, 0.35)', color: 'var(--tl-fg-2)', fontSize: 13 }}>
                  <AlertCircle className="h-4 w-4" style={{ color: 'var(--tl-gold)' }} />
                  <p style={{ margin: 0 }}>{txt.notEnoughTeams}</p>
                </div>
              )}

              {/* Random game-order toggle */}
              <button
                type="button"
                onClick={() => setRandomizeGameOrder((v) => !v)}
                style={{
                  ...surfaceCard,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: 14,
                  textAlign: 'left',
                  cursor: 'pointer',
                  border: `1px solid ${randomizeGameOrder ? 'var(--tl-green)' : 'var(--tl-border)'}`,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 500, color: 'var(--tl-fg)', fontSize: 14 }}>{txt.randomOrderLabel}</div>
                  <div style={{ fontSize: 12, color: 'var(--tl-fg-3)', marginTop: 3, lineHeight: 1.5 }}>{txt.randomOrderHint}</div>
                </div>
                <span
                  aria-hidden
                  style={{
                    flexShrink: 0,
                    width: 40,
                    height: 24,
                    borderRadius: 999,
                    background: randomizeGameOrder ? 'var(--tl-green)' : 'var(--tl-surface)',
                    border: `1px solid ${randomizeGameOrder ? 'var(--tl-green)' : 'var(--tl-border)'}`,
                    position: 'relative',
                    transition: 'background 0.15s',
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',
                      top: 2,
                      left: randomizeGameOrder ? 18 : 2,
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      background: randomizeGameOrder ? '#0a0a0a' : 'var(--tl-fg-3)',
                      transition: 'left 0.15s',
                    }}
                  />
                </span>
              </button>
            </div>
          )}

          {/* ── Draw stage ── */}
          {phase !== 'config' && (
            <div ref={boardWrapRef} style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Sticky hero so the source stays visible while the board scrolls */}
              <div
                style={{
                  ...surfaceCard,
                  position: 'sticky',
                  top: 0,
                  zIndex: 6,
                  padding: 18,
                  minHeight: 96,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  background: phase === 'done'
                    ? 'var(--tl-green-glow)'
                    : revealing
                      ? 'linear-gradient(180deg, rgba(34,197,94,0.12), var(--tl-bg-elev))'
                      : 'var(--tl-bg-elev)',
                  border: `1px solid ${phase === 'done' || revealing ? 'var(--tl-green-dim)' : 'var(--tl-border)'}`,
                  animation: subPhase === 'reveal' && currentPick ? 'tmSpotlight 0.8s ease' : undefined,
                  overflow: 'hidden',
                }}
              >
                {phase === 'done' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Sparkles className="h-6 w-6" style={{ color: 'var(--tl-green)' }} />
                    <span style={{ fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontSize: 24, color: 'var(--tl-fg)' }}>{txt.done}</span>
                  </div>
                ) : currentPick && !revealing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                    <div style={{ ...fieldLabel, color: 'var(--tl-fg-3)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Shuffle className="h-3.5 w-3.5" />
                      {txt.scanning} · {txt.pickLabel(revealed + 1, total)}
                    </div>
                    <div style={{ fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontSize: 22, color: 'var(--tl-fg-2)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', animation: 'tmScanBlink 0.5s ease-in-out infinite' }}>
                      {spinName ?? '…'}
                    </div>
                  </div>
                ) : currentPick ? (
                  <div key={currentPick.team.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, animation: 'tmRevealPop 0.4s ease' }}>
                    <div style={{ ...fieldLabel, color: 'var(--tl-green)' }}>{txt.pickLabel(revealed + 1, total)}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                      <span ref={lockNameRef} style={{ fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontSize: 28, lineHeight: 1.1, color: 'var(--tl-fg)', maxWidth: 340, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {currentPick.team.name}
                      </span>
                      <ArrowRight className="h-5 w-5" style={{ color: 'var(--tl-green)', animation: 'tmArrow 0.7s ease-in-out infinite' }} />
                      <span style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 14px', borderRadius: 999, background: 'var(--tl-green)', color: '#0a0a0a', fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 15, fontWeight: 700, letterSpacing: '0.04em' }}>
                        {txt.groupName(currentPick.groupIndex)}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Group board — each group fills top-down as teams are drawn */}
              {showBoard && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                  {distribution!.map((group, gi) => {
                    const drawn = drawnByGroup.get(gi) ?? [];
                    const emptyCount = group.length - drawn.length;
                    const isTarget = revealing && currentPick?.groupIndex === gi;
                    return (
                      <div
                        key={gi}
                        style={{
                          ...surfaceCard,
                          padding: 14,
                          transition: 'border-color 0.2s',
                          borderColor: isTarget ? 'var(--tl-green)' : 'var(--tl-border)',
                          animation: isTarget && subPhase === 'reveal' ? 'tmSpotlight 0.8s ease' : undefined,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                          <span style={{ ...tinyPill, background: isTarget ? 'var(--tl-green-glow)' : 'var(--tl-bg-elev)', color: isTarget ? 'var(--tl-green)' : 'var(--tl-fg-2)' }}>
                            {txt.groupName(gi)}
                          </span>
                          <span style={{ fontSize: 12, color: 'var(--tl-fg-3)' }}>{drawn.length}/{group.length}</span>
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {drawn.map((team, idx) => (
                            <li
                              key={team.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 13,
                                minHeight: 32,
                                padding: '5px 8px',
                                borderRadius: 'var(--tl-radius)',
                                border: '1px solid var(--tl-border)',
                                background: 'var(--tl-surface)',
                                color: 'var(--tl-fg)',
                                animation: 'tmDrawIn 0.4s ease',
                              }}
                            >
                              <span style={{ width: 22, height: 22, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--tl-green-glow)', color: 'var(--tl-green)', fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, fontWeight: 600 }}>
                                {idx + 1}
                              </span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</span>
                            </li>
                          ))}
                          {Array.from({ length: emptyCount }).map((_, i) => (
                            <li
                              key={`empty-${i}`}
                              ref={(el) => { if (el && i === 0) nextSlotRefs.current.set(gi, el); }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                fontSize: 13,
                                minHeight: 32,
                                padding: '5px 8px',
                                borderRadius: 'var(--tl-radius)',
                                border: `1px dashed ${isTarget && i === 0 ? 'var(--tl-green)' : 'var(--tl-border-2)'}`,
                                background: 'transparent',
                                color: 'var(--tl-fg-3)',
                              }}
                            >
                              <span style={{ width: 22, height: 22, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 999, background: 'var(--tl-surface)', color: 'var(--tl-fg-3)', fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, fontWeight: 600 }}>
                                {drawn.length + i + 1}
                              </span>
                              <span>{txt.emptySlot}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}

              <p style={{ display: 'flex', alignItems: 'flex-start', gap: 6, fontSize: 12, color: 'var(--tl-fg-3)', margin: 0 }}>
                <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>{txt.snakeHint}</span>
              </p>

              {/* Flying team chip (hero → destination slot) */}
              {fly && (
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: fly.x,
                    top: fly.y,
                    zIndex: 7,
                    pointerEvents: 'none',
                    transform: fly.active ? `translate(${fly.tx - fly.x}px, ${fly.ty - fly.y}px) scale(0.62)` : 'none',
                    opacity: fly.active ? 0.96 : 1,
                    transformOrigin: 'left top',
                    transition: `transform ${FLY_MS}ms cubic-bezier(.45,0,.15,1), opacity ${FLY_MS}ms ease`,
                    padding: '5px 12px',
                    borderRadius: 999,
                    background: 'var(--tl-green)',
                    color: '#0a0a0a',
                    fontFamily: 'Instrument Serif, serif',
                    fontStyle: 'italic',
                    fontSize: 20,
                    whiteSpace: 'nowrap',
                    boxShadow: '0 8px 24px -6px rgba(34,197,94,0.6)',
                  }}
                >
                  {fly.name}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <button type="button" className="tl-btn" onClick={() => onOpenChange(false)} disabled={isCreating}>
            {txt.cancel}
          </button>

          {phase === 'config' && (
            <button type="button" className="tl-btn green" onClick={startDraw} disabled={!selectedGroupCount || total === 0}>
              <Shuffle className="h-4 w-4" />
              {txt.startDraw}
            </button>
          )}

          {phase === 'drawing' && (
            <button type="button" className="tl-btn" onClick={skipAnimation}>
              {txt.skip}
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
