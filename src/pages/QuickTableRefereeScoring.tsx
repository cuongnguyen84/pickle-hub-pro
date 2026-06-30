import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Dice5, ArrowLeftRight, StickyNote } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuickTableMutations } from '@/hooks/useQuickTableMutations';
import { useI18n } from '@/i18n';
import {
  startState, applyRally, callout, isGameOver, winnerSide, scoreOf,
  servingPlayer, receivingPlayer, servingSideRight, sideSwitchPoint,
  type ScoreState, type ScoringMode, type ServeSide,
} from '@/lib/refereeScoring';

/** Web referee live-scoring for Quick Table — the referee answers one question
 *  per rally ("who won?") and the engine derives the rest. Replaces the manual
 *  MatchScoring flow for Quick Table. See apple/docs/referee-live-scoring-spec.md. */

interface Loaded {
  matchId: string;
  shareId: string;
  isDoubles: boolean;
  teamAName: string;
  teamBName: string;
  playersA: [string, string] | null; // 2 athlete names (doubles)
  playersB: [string, string] | null;
}

const card: React.CSSProperties = {
  background: 'var(--tl-surface)', border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

export default function QuickTableRefereeScoring() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { language } = useI18n();
  const { updateMatchScore } = useQuickTableMutations();
  const vi = language === 'vi';
  const storeKey = `qt-ref:${matchId}`;

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);

  // setup
  const [mode, setMode] = useState<ScoringMode>('rally');
  const [target, setTarget] = useState(11);
  const [setupServer, setSetupServer] = useState<ServeSide | null>(null);
  const [setupServerIdx, setSetupServerIdx] = useState<number | null>(null);
  const [setupReceiverIdx, setSetupReceiverIdx] = useState<number | null>(null);

  // game
  const [state, setState] = useState<ScoreState | null>(null);
  const [history, setHistory] = useState<ScoreState[]>([]);
  const [switchAnnounced, setSwitchAnnounced] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const [showNote, setShowNote] = useState(false);
  const noteKey = `qt-ref-note:${matchId}`;

  // Auto landscape + fullscreen on phone (Android/Chrome; iOS Safari no-ops gracefully).
  const goLandscape = useCallback(async () => {
    try {
      const el = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
      if (el.requestFullscreen) await el.requestFullscreen();
      const o = (screen as Screen & { orientation?: { lock?: (s: string) => Promise<void> } }).orientation;
      if (o?.lock) await o.lock('landscape');
    } catch { /* unsupported — board works portrait too */ }
  }, []);
  const exitLandscape = useCallback(() => {
    try {
      (screen as Screen & { orientation?: { unlock?: () => void } }).orientation?.unlock?.();
      if (document.fullscreenElement) document.exitFullscreen?.();
    } catch { /* ignore */ }
  }, []);
  useEffect(() => () => exitLandscape(), [exitLandscape]);

  // ── Load match + players ──
  useEffect(() => {
    if (!matchId) return;
    (async () => {
      try {
        const { data: m, error: me } = await supabase
          .from('quick_table_matches')
          .select('id, player1_id, player2_id, table_id')
          .eq('id', matchId).single();
        if (me || !m) throw me || new Error('match');
        const { data: tb } = await supabase
          .from('quick_tables').select('id, share_id, name, is_doubles')
          .eq('id', m.table_id).single();
        const ids = [m.player1_id, m.player2_id].filter(Boolean) as string[];
        const { data: ps } = await supabase
          .from('quick_table_players').select('id, name, player1_name, player2_name')
          .in('id', ids);
        const byId = new Map((ps || []).map((p) => [p.id, p]));
        const p1 = m.player1_id ? byId.get(m.player1_id) : undefined;
        const p2 = m.player2_id ? byId.get(m.player2_id) : undefined;
        const names = (p: typeof p1): [string, string] | null =>
          p?.player1_name && p?.player2_name ? [p.player1_name, p.player2_name] : null;
        setLoaded({
          matchId,
          shareId: tb?.share_id ?? '',
          isDoubles: tb?.is_doubles === true,
          teamAName: p1?.name ?? 'Đội A',
          teamBName: p2?.name ?? 'Đội B',
          playersA: names(p1),
          playersB: names(p2),
        });
      } catch {
        setError(vi ? 'Không tải được trận đấu.' : 'Could not load match.');
      }
    })();
  }, [matchId, vi]);

  // ── Restore in-progress game from localStorage ──
  useEffect(() => {
    if (!loaded || state) return;
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) setState(JSON.parse(raw) as ScoreState);
    } catch { /* ignore */ }
  }, [loaded, state, storeKey]);

  // ── Persist game ──
  useEffect(() => {
    if (state) localStorage.setItem(storeKey, JSON.stringify(state));
  }, [state, storeKey]);

  // ── Note: restore + persist ──
  useEffect(() => { try { const n = localStorage.getItem(noteKey); if (n) setNote(n); } catch { /* ignore */ } }, [noteKey]);
  useEffect(() => {
    try { if (note) localStorage.setItem(noteKey, note); else localStorage.removeItem(noteKey); } catch { /* ignore */ }
  }, [note, noteKey]);

  const rotationCapable = useMemo(
    () => !!loaded && mode === 'sideOut' && loaded.isDoubles && !!loaded.playersA && !!loaded.playersB,
    [loaded, mode],
  );

  const setupReady = setupServer != null && (!rotationCapable || (setupServerIdx != null && setupReceiverIdx != null));

  const begin = useCallback(() => {
    if (!loaded || setupServer == null) return;
    const s = startState({
      mode, isSingles: false, winTarget: target, firstServer: setupServer,
      players: rotationCapable ? { a: loaded.playersA!, b: loaded.playersB! } : undefined,
      firstServerIdx: setupServerIdx ?? 0, firstReceiverIdx: setupReceiverIdx ?? 0,
    });
    setHistory([]); setSwitchAnnounced(false); setState(s);
    void goLandscape();
  }, [loaded, mode, target, setupServer, setupServerIdx, setupReceiverIdx, rotationCapable, goLandscape]);

  const tap = useCallback((side: ServeSide) => {
    if (!state || isGameOver(state)) return;
    const next = applyRally(state, side);
    setHistory((h) => [...h, state]);
    setState(next);
    if (isGameOver(next)) setConfirming(true);
    else if (!switchAnnounced && Math.max(next.a, next.b) >= sideSwitchPoint(target)) {
      setSwitchAnnounced(true); setShowSwitch(true);
    }
  }, [state, switchAnnounced, target]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setState(prev);
      setConfirming(false); setShowSwitch(false);
      if (Math.max(prev.a, prev.b) < sideSwitchPoint(target)) setSwitchAnnounced(false);
      return h.slice(0, -1);
    });
  }, [target]);

  const finish = useCallback(async (s: ScoreState) => {
    if (!loaded || s.a === s.b) return;
    setSaving(true);
    try {
      await updateMatchScore(loaded.matchId, s.a, s.b);
      if (note.trim()) {
        try {
          await supabase.from('quick_table_matches')
            .update({ referee_note: note.trim() } as never).eq('id', loaded.matchId);
        } catch { /* note is best-effort */ }
      }
      localStorage.removeItem(storeKey);
      localStorage.removeItem(noteKey);
      exitLandscape();
      navigate(`/tools/quick-tables/${loaded.shareId}?tab=groups`);
    } finally {
      setSaving(false);
    }
  }, [loaded, navigate, storeKey, noteKey, updateMatchScore, note, exitLandscape]);

  if (error) return <Centered>{error}</Centered>;
  if (!loaded) return <Centered>{vi ? 'Đang tải…' : 'Loading…'}</Centered>;

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--tl-bg)', color: 'var(--tl-fg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--tl-border)' }}>
        <button type="button" className="tl-btn" style={{ padding: '6px 10px' }}
          onClick={() => navigate(`/tools/quick-tables/${loaded.shareId}`)}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 12, color: 'var(--tl-fg-3)' }}>
          {vi ? 'CHẤM TRỰC TIẾP' : 'LIVE SCORING'}
        </span>
        <div style={{ flex: 1 }} />
        <button type="button" className="tl-btn" style={{ padding: '6px 10px', ...(note.trim() ? { color: 'var(--tl-green)', borderColor: 'var(--tl-green)' } : {}) }}
          onClick={() => setShowNote(true)}>
          <StickyNote className="w-4 h-4" />
          <span className="hidden sm:inline">{vi ? 'Ghi chú' : 'Note'}</span>
        </button>
      </header>

      {!state ? (
        <Setup
          vi={vi} loaded={loaded} mode={mode} setMode={setMode} target={target} setTarget={setTarget}
          rotationCapable={rotationCapable} setupServer={setupServer} setSetupServer={(s) => { setSetupServer(s); setSetupServerIdx(null); setSetupReceiverIdx(null); }}
          setupServerIdx={setupServerIdx} setSetupServerIdx={setSetupServerIdx}
          setupReceiverIdx={setupReceiverIdx} setSetupReceiverIdx={setSetupReceiverIdx}
          ready={setupReady} onBegin={begin}
        />
      ) : (
        <Board vi={vi} loaded={loaded} state={state} target={target} mode={mode}
          onTap={tap} onUndo={undo} canUndo={history.length > 0} onEnd={() => setConfirming(true)} />
      )}

      {showNote && <NoteOverlay vi={vi} note={note} onChange={setNote} onClose={() => setShowNote(false)} />}
      {showSwitch && <SwitchOverlay vi={vi} point={sideSwitchPoint(target)} onDone={() => setShowSwitch(false)} />}
      {confirming && state && (
        <ConfirmOverlay vi={vi} loaded={loaded} state={state} saving={saving}
          onEdit={() => setConfirming(false)} onConfirm={() => finish(state)} />
      )}
    </div>
  );
}

// ── Setup ──
function Setup(props: {
  vi: boolean; loaded: Loaded; mode: ScoringMode; setMode: (m: ScoringMode) => void;
  target: number; setTarget: (n: number) => void; rotationCapable: boolean;
  setupServer: ServeSide | null; setSetupServer: (s: ServeSide) => void;
  setupServerIdx: number | null; setSetupServerIdx: (n: number) => void;
  setupReceiverIdx: number | null; setSetupReceiverIdx: (n: number) => void;
  ready: boolean; onBegin: () => void;
}) {
  const { vi, loaded, mode, setMode, target, setTarget, rotationCapable } = props;
  const serverTeam = props.setupServer === 'a' ? loaded.teamAName : loaded.teamBName;
  const serverNames = props.setupServer === 'a' ? loaded.playersA : loaded.playersB;
  const recvNames = props.setupServer === 'a' ? loaded.playersB : loaded.playersA;

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 520, margin: '0 auto', width: '100%' }}>
      <Field label={vi ? 'Thể thức tính điểm' : 'Scoring'}>
        <Segmented options={[['rally', vi ? 'Trực tiếp' : 'Rally'], ['sideOut', vi ? 'Giao bóng' : 'Side-out']]}
          value={mode} onChange={(v) => setMode(v as ScoringMode)} />
      </Field>
      <Field label={vi ? 'Điểm thắng' : 'Win target'}>
        <Segmented options={[[11, '11'], [15, '15'], [21, '21']]} value={target} onChange={(v) => setTarget(v as number)} />
      </Field>

      <div style={{ height: 1, background: 'var(--tl-border)' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Label>{vi ? 'ĐỘI NÀO GIAO BÓNG TRƯỚC?' : 'WHO SERVES FIRST?'}</Label>
        <div style={{ display: 'flex', gap: 12 }}>
          <PickBtn on={props.setupServer === 'a'} onClick={() => props.setSetupServer('a')} big>{loaded.teamAName}</PickBtn>
          <PickBtn on={props.setupServer === 'b'} onClick={() => props.setSetupServer('b')} big>{loaded.teamBName}</PickBtn>
        </div>
        <button type="button" className="tl-btn" style={{ alignSelf: 'center', padding: '8px 16px' }}
          onClick={() => props.setSetupServer(Math.random() < 0.5 ? 'a' : 'b')}>
          <Dice5 className="w-4 h-4" /> {vi ? 'Bốc thăm' : 'Coin toss'}
        </button>
      </div>

      {rotationCapable && props.setupServer && serverNames && recvNames && (
        <>
          <PlayerPick label={vi ? 'AI GIAO BÓNG TRƯỚC?' : 'WHO SERVES FIRST?'} team={serverTeam}
            names={serverNames} selected={props.setupServerIdx} onSelect={props.setSetupServerIdx} />
          <PlayerPick label={vi ? 'AI ĐỠ BÓNG TRƯỚC?' : 'WHO RECEIVES FIRST?'}
            team={props.setupServer === 'a' ? loaded.teamBName : loaded.teamAName}
            names={recvNames} selected={props.setupReceiverIdx} onSelect={props.setSetupReceiverIdx} />
        </>
      )}

      {props.ready && (
        <button type="button" className="tl-btn green" style={{ padding: '14px', justifyContent: 'center', fontSize: 15 }} onClick={props.onBegin}>
          {vi ? 'BẮT ĐẦU' : 'START'}
        </button>
      )}
    </div>
  );
}

// ── Board ──
function Board(props: {
  vi: boolean; loaded: Loaded; state: ScoreState; target: number; mode: ScoringMode;
  onTap: (s: ServeSide) => void; onUndo: () => void; canUndo: boolean; onEnd: () => void;
}) {
  const { vi, loaded, state, target, mode } = props;
  const server = servingPlayer(state);
  const recv = receivingPlayer(state);
  const right = servingSideRight(state);
  const servingName = state.serving === 'a' ? loaded.teamAName : loaded.teamBName;
  const otherSide: ServeSide = state.serving === 'a' ? 'b' : 'a';

  const serveLine = server && recv && right !== null
    ? `${vi ? 'GIAO' : 'SERVE'}: ${server} (${vi ? 'sân' : 'court'} ${right ? (vi ? 'phải' : 'R') : (vi ? 'trái' : 'L')})  ·  ${vi ? 'ĐỠ' : 'RECV'}: ${recv}`
    : mode === 'sideOut'
      ? `${vi ? 'đang giao' : 'serving'}: ${servingName}${state.isSingles ? '' : ` · ${vi ? 'tay' : 'server'} ${state.serverNumber}`}`
      : (vi ? 'tính điểm trực tiếp' : 'rally scoring');

  const bottom = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, background: 'var(--tl-surface)' }}>
      <button type="button" className="tl-btn" style={{ flex: 1, justifyContent: 'center', padding: 14, opacity: props.canUndo ? 1 : 0.4 }}
        disabled={!props.canUndo} onClick={props.onUndo}>
        <RotateCcw className="w-4 h-4" /> {vi ? 'HOÀN TÁC' : 'UNDO'}
      </button>
      <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, color: 'var(--tl-fg-4)' }}>{vi ? 'tới' : 'to'} {target}</span>
      <button type="button" className="tl-btn green" style={{ flex: 1, justifyContent: 'center', padding: 14 }} onClick={props.onEnd}>
        {vi ? 'KẾT THÚC' : 'END'}
      </button>
    </div>
  );

  const calloutBar = (
    <div style={{ textAlign: 'center', padding: '14px 12px', background: 'var(--tl-surface)' }}>
      <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, fontSize: 'clamp(40px, 12vw, 64px)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {callout(state)}
      </div>
      <div style={{ marginTop: 4, fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 12.5, fontWeight: 700, color: 'var(--tl-green)' }}>{serveLine}</div>
    </div>
  );

  // Rally: tap who won the rally (symmetric).
  if (mode === 'rally') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {calloutBar}
        <div style={{ flex: 1, display: 'flex' }}>
          <TapZone name={loaded.teamAName} score={scoreOf(state, 'a')} serving={false} onClick={() => props.onTap('a')} vi={vi} />
          <div style={{ width: 1, background: 'var(--tl-border)' }} />
          <TapZone name={loaded.teamBName} score={scoreOf(state, 'b')} serving={false} onClick={() => props.onTap('b')} vi={vi} />
        </div>
        {bottom}
      </div>
    );
  }

  // Side-out: server-relative — trọng tài chỉ nhập ĐIỂM (đội đang giao thắng pha)
  // hoặc ĐỔI TAY (đội giao mất pha → engine tự tay-2 / side-out).
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {calloutBar}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '8px 12px', background: 'var(--tl-surface)', fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 13.5, fontWeight: 600 }}>
        <span style={{ color: state.serving === 'a' ? 'var(--tl-green)' : 'var(--tl-fg-2)' }}>{loaded.teamAName} {state.a}</span>
        <span style={{ color: 'var(--tl-fg-4)' }}>·</span>
        <span style={{ color: state.serving === 'b' ? 'var(--tl-green)' : 'var(--tl-fg-2)' }}>{loaded.teamBName} {state.b}</span>
      </div>
      <div style={{ flex: 1, display: 'flex' }}>
        <ActionZone big={vi ? 'ĐIỂM' : 'POINT'} sub={`${vi ? 'cho' : 'for'} ${servingName}`} tone="green" onClick={() => props.onTap(state.serving)} />
        <div style={{ width: 1, background: 'var(--tl-border)' }} />
        <ActionZone big={vi ? 'ĐỔI TAY' : 'SIDE OUT'} sub={vi ? 'mất giao' : 'loss of serve'} tone="neutral" onClick={() => props.onTap(otherSide)} />
      </div>
      {bottom}
    </div>
  );
}

function ActionZone(props: { big: string; sub: string; tone: 'green' | 'neutral'; onClick: () => void }) {
  const green = props.tone === 'green';
  return (
    <button type="button" onClick={props.onClick}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: 0, cursor: 'pointer', padding: 16, background: green ? 'var(--tl-green-glow)' : 'var(--tl-bg)', color: green ? 'var(--tl-green)' : 'var(--tl-fg)' }}>
      <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, fontSize: 'clamp(34px, 11vw, 56px)', letterSpacing: '0.02em', lineHeight: 1 }}>{props.big}</span>
      <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 12, color: green ? 'var(--tl-green)' : 'var(--tl-fg-3)' }}>{props.sub}</span>
    </button>
  );
}

function TapZone(props: { name: string; score: number; serving: boolean; onClick: () => void; vi: boolean }) {
  return (
    <button type="button" onClick={props.onClick}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--tl-bg)', border: 0, color: 'var(--tl-fg)', cursor: 'pointer', padding: 16 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontSize: 22, textAlign: 'center' }}>
        {props.serving && <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--tl-green)' }} />}
        {props.name}
      </span>
      <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, fontSize: 'clamp(56px, 22vw, 96px)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{props.score}</span>
      <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--tl-fg-4)' }}>{props.vi ? 'CHẠM = +1' : 'TAP = +1'}</span>
    </button>
  );
}

// ── Overlays ──
function NoteOverlay(props: { vi: boolean; note: string; onChange: (v: string) => void; onClose: () => void }) {
  return (
    <Overlay>
      <div style={{ alignSelf: 'flex-start', fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, letterSpacing: '0.08em', fontSize: 12.5, color: 'var(--tl-fg-3)' }}>
        {props.vi ? 'GHI CHÚ TRỌNG TÀI' : 'REFEREE NOTE'}
      </div>
      <textarea value={props.note} onChange={(e) => props.onChange(e.target.value)} rows={5} autoFocus
        placeholder={props.vi ? 'Sự cố, hội ý, khiếu nại…' : 'Incidents, timeouts, disputes…'}
        style={{ width: '100%', resize: 'vertical', background: 'var(--tl-bg)', color: 'var(--tl-fg)', border: '1px solid var(--tl-border)', borderRadius: 'var(--tl-radius)', padding: 10, fontFamily: 'inherit', fontSize: 14, outline: 'none' }} />
      <button type="button" className="tl-btn green" style={{ width: '100%', justifyContent: 'center', padding: 13 }} onClick={props.onClose}>{props.vi ? 'Xong' : 'Done'}</button>
    </Overlay>
  );
}

function SwitchOverlay(props: { vi: boolean; point: number; onDone: () => void }) {
  return (
    <Overlay>
      <ArrowLeftRight className="w-8 h-8" style={{ color: 'var(--tl-green)' }} />
      <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, letterSpacing: '0.12em', fontSize: 15 }}>{props.vi ? 'ĐỔI SÂN' : 'SWITCH ENDS'}</div>
      <div style={{ fontSize: 13, color: 'var(--tl-fg-3)', textAlign: 'center' }}>{props.vi ? `Tới mốc ${props.point} điểm — hai đội đổi sân.` : `Reached ${props.point} — teams switch ends.`}</div>
      <button type="button" className="tl-btn green" style={{ width: '100%', justifyContent: 'center', padding: 13 }} onClick={props.onDone}>{props.vi ? 'Đã đổi sân' : 'Done'}</button>
    </Overlay>
  );
}

function ConfirmOverlay(props: { vi: boolean; loaded: Loaded; state: ScoreState; saving: boolean; onEdit: () => void; onConfirm: () => void }) {
  const { state, loaded, vi } = props;
  const w = winnerSide(state);
  const tie = state.a === state.b;
  const wName = tie ? null : state.a > state.b ? loaded.teamAName : loaded.teamBName;
  return (
    <Overlay>
      {wName && <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, letterSpacing: '0.1em', fontSize: 13, color: 'var(--tl-green)' }}>{wName} {vi ? 'THẮNG' : 'WINS'}</div>}
      <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, fontSize: 42, fontVariantNumeric: 'tabular-nums' }}>{state.a} – {state.b}</div>
      {tie && <div style={{ fontSize: 12, color: 'var(--tl-live)' }}>{vi ? 'Tỉ số hoà — chưa có đội thắng.' : 'Tie — no winner.'}</div>}
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <button type="button" className="tl-btn" style={{ flex: 1, justifyContent: 'center', padding: 13 }} onClick={props.onEdit}>{vi ? 'Sửa' : 'Edit'}</button>
        <button type="button" className="tl-btn green" style={{ flex: 1, justifyContent: 'center', padding: 13, opacity: tie || props.saving ? 0.5 : 1 }}
          disabled={tie || props.saving} onClick={props.onConfirm}>{vi ? 'Xác nhận' : 'Confirm'}</button>
      </div>
    </Overlay>
  );
}

// ── Small UI helpers ──
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, zIndex: 50 }}>
      <div style={{ ...card, padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, maxWidth: 360, width: '100%' }}>{children}</div>
    </div>
  );
}
function Centered({ children }: { children: React.ReactNode }) {
  return <div style={{ minHeight: '100dvh', background: 'var(--tl-bg)', color: 'var(--tl-fg-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}><Label>{label}</Label>{children}</div>;
}
function Label({ children }: { children: React.ReactNode }) {
  return <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--tl-fg-3)' }}>{children}</span>;
}
function Segmented({ options, value, onChange }: { options: [string | number, string][]; value: string | number; onChange: (v: string | number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {options.map(([v, lbl]) => {
        const on = value === v;
        return (
          <button key={String(v)} type="button" onClick={() => onChange(v)}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 'var(--tl-radius)', border: `1px solid ${on ? 'var(--tl-green)' : 'var(--tl-border)'}`, background: on ? 'var(--tl-green-glow)' : 'var(--tl-bg)', color: on ? 'var(--tl-green)' : 'var(--tl-fg-2)', fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
            {lbl}
          </button>
        );
      })}
    </div>
  );
}
function PickBtn({ on, onClick, big, children }: { on: boolean; onClick: () => void; big?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      style={{ flex: 1, padding: big ? '30px 12px' : '16px 12px', borderRadius: 'var(--tl-radius-lg)', border: `1px solid ${on ? 'var(--tl-green)' : 'var(--tl-border)'}`, background: on ? 'var(--tl-green-glow)' : 'var(--tl-surface)', color: on ? 'var(--tl-green)' : 'var(--tl-fg)', fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontSize: 20, cursor: 'pointer' }}>
      {children}
    </button>
  );
}
function PlayerPick(props: { label: string; team: string; names: [string, string]; selected: number | null; onSelect: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      <Label>{props.label}</Label>
      <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10, color: 'var(--tl-fg-4)' }}>{props.team}</span>
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        {props.names.map((n, i) => {
          const on = props.selected === i;
          return (
            <button key={i} type="button" onClick={() => props.onSelect(i)}
              style={{ flex: 1, padding: '16px', borderRadius: 'var(--tl-radius)', border: `1px solid ${on ? 'var(--tl-green)' : 'var(--tl-border)'}`, background: on ? 'var(--tl-green-glow)' : 'var(--tl-surface)', color: on ? 'var(--tl-green)' : 'var(--tl-fg)', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
