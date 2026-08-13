import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, RotateCcw, Dice5, ArrowLeftRight, StickyNote, Timer, Cross } from 'lucide-react';
import {
  startState, applyRally, callout, isGameOver, scoreOf,
  servingPlayer, receivingPlayer, servingSideRight, sideSwitchPoint,
  makeLiveState, parseLiveState,
  manualAdjust, manualNextServe, manualToggleServer,
  manualEndSet, manualSetsWon, manualMatchWinner, manualFinalSetScores,
  type ScoreState, type ScoringMode, type ServeSide, type RefereeLiveState, type ManualSetScore,
} from '@/lib/refereeScoring';

/** Shared web referee live-scoring screen — referee answers one question per
 *  rally; the engine derives the rest. Format-specific pages load the match,
 *  then wire onLiveScore / onClaimLive / onFinish. The screen owns all UI,
 *  the engine, coin toss, timeouts, notes, side-switch and landscape handling.
 *  See apple/docs/referee-live-scoring-spec.md. */

export interface RefereeLoaded {
  matchId: string;
  teamAName: string;
  teamBName: string;
  playersA: [string, string] | null;
  playersB: [string, string] | null;
  isDoubles: boolean;
  backHref: string; // header back button target
}

interface ScreenProps {
  loaded: RefereeLoaded;
  vi: boolean;
  /** localStorage key for resume; notes use `${persistKey}:note`. */
  persistKey: string;
  /** Push the running score each rally (spectator realtime). */
  onLiveScore?: (a: number, b: number) => void;
  /** S2 persistence contract — the match row's `referee_live_state` jsonb,
   *  loaded by the consumer. A valid envelope wins over localStorage on
   *  resume, so a device switch continues exactly (undo stack, timeouts,
   *  notes included). */
  initialLiveState?: unknown;
  /** S2 persistence contract — debounced full-state push on every change;
   *  the consumer writes it to the row (spectators read serve/set/rotation
   *  from it in realtime). Called with null on finish to clear the row. */
  onLiveState?: (s: RefereeLiveState | null) => void;
  /** Claim the match as LIVE when the game begins. Codex review 2026-07-17:
   *  return `false` when the claim was LOST to another referee (row already
   *  claimed by someone else) — the screen then refuses to start scoring.
   *  Returning void/true/undefined keeps the old best-effort behavior. */
  onClaimLive?: () => Promise<boolean | void> | boolean | void;
  /** S3a contention lockout: another referee holds live_referee_id. The
   *  screen becomes a static snapshot — no actions, no persistence (a
   *  viewer must never overwrite the scoring referee's state). Consumers
   *  may flip this LIVE (S3c realtime takeover detection) — every gate
   *  reads the derived value. */
  readOnly?: boolean;
  /** S3c spectator mode: the row's envelope streamed by the consumer's
   *  realtime subscription. Applied only while readOnly — a viewer follows
   *  the scoring referee live; the writer ignores it. */
  liveState?: unknown;
  /** Persist the final result. The screen has already cleared resume state.
   *  Multi-set manual games pass sets-won as (a, b) plus a 4th arg with the
   *  archived set scores — consumers that predate S3b2 simply ignore it. */
  onFinish: (a: number, b: number, note: string | null, sets?: { setsWon: { a: number; b: number }; setScores: ManualSetScore[]; totalSets: number }) => Promise<void>;
  /** When embedded as an overlay, close instead of navigating to backHref. */
  onBack?: () => void;
}

type Sides = { a: number; b: number };
type Active = { side: ServeSide; kind: 'reg' | 'med'; left: number };

const card: React.CSSProperties = { background: 'var(--tl-surface)', border: '1px solid var(--tl-border)', borderRadius: 'var(--tl-radius-lg)' };
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function RefereeScoringScreen({ loaded, vi, persistKey, onLiveScore, initialLiveState, liveState, onLiveState, onClaimLive, readOnly: readOnlyProp = false, onFinish, onBack }: ScreenProps) {
  const navigate = useNavigate();
  const storeKey = persistKey;
  const noteKey = `${persistKey}:note`;

  // Claim lost at begin (another referee raced us) → same lockout as the
  // consumer-computed readOnly. Every gate below reads the derived value.
  const [claimDenied, setClaimDenied] = useState(false);
  const readOnly = readOnlyProp || claimDenied;

  // setup
  const [mode, setMode] = useState<ScoringMode>('rally');
  const [target, setTarget] = useState(11);
  const [totalSetsPick, setTotalSetsPick] = useState(1); // manual mode: best-of
  const [regularTO, setRegularTO] = useState(2);
  const [setupServer, setSetupServer] = useState<ServeSide | null>(null);
  const [setupServerIdx, setSetupServerIdx] = useState<number | null>(null);
  const [setupReceiverIdx, setSetupReceiverIdx] = useState<number | null>(null);
  const [tossing, setTossing] = useState(false);
  const [tossHi, setTossHi] = useState<ServeSide | null>(null);

  // game
  const [state, setState] = useState<ScoreState | null>(null);
  const [history, setHistory] = useState<ScoreState[]>([]);
  const [switchAnnounced, setSwitchAnnounced] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [noteA, setNoteA] = useState('');
  const [noteB, setNoteB] = useState('');
  const [showNote, setShowNote] = useState(false);

  // timeouts
  const [usedReg, setUsedReg] = useState<Sides>({ a: 0, b: 0 });
  const [usedMed, setUsedMed] = useState<Sides>({ a: 0, b: 0 });
  const [active, setActive] = useState<Active | null>(null);

  const goLandscape = useCallback(async () => {
    try {
      const el = document.documentElement as HTMLElement & { requestFullscreen?: () => Promise<void> };
      if (el.requestFullscreen) await el.requestFullscreen();
      const o = (screen as Screen & { orientation?: { lock?: (s: string) => Promise<void> } }).orientation;
      if (o?.lock) await o.lock('landscape');
    } catch { /* iOS Safari can't lock — ForceLandscape (CSS) covers it */ }
  }, []);
  const exitLandscape = useCallback(() => {
    try {
      (screen as Screen & { orientation?: { unlock?: () => void } }).orientation?.unlock?.();
      if (document.fullscreenElement) document.exitFullscreen?.();
    } catch { /* ignore */ }
  }, []);
  useEffect(() => () => exitLandscape(), [exitLandscape]);

  // restore in-progress game (+ its mode/target so the board & side-switch match).
  // S2: a valid DB envelope (referee_live_state) wins over localStorage —
  // device switches resume with undo stack, timeouts and notes intact.
  const restoredFromDb = useRef(false);
  useEffect(() => {
    if (state) return;
    const env = parseLiveState(initialLiveState);
    if (env) {
      restoredFromDb.current = true;
      setState(env.state); setMode(env.state.mode); setTarget(env.state.winTarget);
      setSwitchAnnounced(Math.max(env.state.a, env.state.b) >= sideSwitchPoint(env.state.winTarget));
      setHistory(env.history);
      setUsedReg(env.usedReg); setUsedMed(env.usedMed);
      setRegularTO(env.regularTO);
      setNoteA(env.notes.a); setNoteB(env.notes.b);
      return;
    }
    try {
      const raw = localStorage.getItem(storeKey);
      if (raw) {
        const s = JSON.parse(raw) as ScoreState;
        setState(s); setMode(s.mode); setTarget(s.winTarget);
        setSwitchAnnounced(Math.max(s.a, s.b) >= sideSwitchPoint(s.winTarget));
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey]);
  useEffect(() => { if (state && !readOnly) localStorage.setItem(storeKey, JSON.stringify(state)); }, [state, storeKey, readOnly]);

  // S3c: readOnly viewers follow the scoring referee live — each envelope
  // the consumer streams replaces the whole board state. Writers ignore it.
  // An explicit null AFTER we had a board means the match finished (the
  // writer cleared the row) — show the ended pill instead of a stale board.
  const [liveEnded, setLiveEnded] = useState(false);
  useEffect(() => {
    if (!readOnly) return;
    const env = parseLiveState(liveState);
    if (!env) {
      if (liveState === null && state) setLiveEnded(true);
      return;
    }
    setLiveEnded(false);
    setState(env.state); setMode(env.state.mode); setTarget(env.state.winTarget);
    setHistory(env.history);
    setUsedReg(env.usedReg); setUsedMed(env.usedMed);
    setRegularTO(env.regularTO);
    setNoteA(env.notes.a); setNoteB(env.notes.b);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveState, readOnly]);

  // S2: debounced full-state push to the consumer (DB row). 400ms collapses
  // note keystrokes; rallies land within one debounce window anyway.
  // Codex review 2026-07-17: callback + latest envelope live in refs so the
  // timer never fires a stale closure, and unmount FLUSHES the pending
  // write instead of dropping it (finishedRef suppresses the flush after
  // finish already cleared the row).
  // readOnly viewers never write — they'd clobber the scoring referee.
  const liveStateTimer = useRef<number | null>(null);
  const onLiveStateRef = useRef(onLiveState);
  onLiveStateRef.current = onLiveState;
  const pendingEnvRef = useRef<RefereeLiveState | null>(null);
  const finishedRef = useRef(false);
  // readOnlyRef mirrors the derived lockout — the timer, the unmount flush
  // and any queued write recheck it at FIRE time, not schedule time
  // (Codex review round 3: a takeover must stop in-flight writes).
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  useEffect(() => {
    if (!state || !onLiveState || readOnly) return undefined;
    pendingEnvRef.current = makeLiveState({
      state, history,
      usedReg, usedMed,
      notes: { a: noteA, b: noteB },
      regularTO,
    });
    if (liveStateTimer.current) window.clearTimeout(liveStateTimer.current);
    liveStateTimer.current = window.setTimeout(() => {
      liveStateTimer.current = null;
      if (!finishedRef.current && !readOnlyRef.current && pendingEnvRef.current) onLiveStateRef.current?.(pendingEnvRef.current);
    }, 400);
    return () => { if (liveStateTimer.current) window.clearTimeout(liveStateTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, history, usedReg, usedMed, noteA, noteB, regularTO, readOnly]);
  // Unmount flush — a rally scored right before closing must still land.
  useEffect(() => () => {
    if (!finishedRef.current && !readOnlyRef.current && liveStateTimer.current && pendingEnvRef.current) {
      onLiveStateRef.current?.(pendingEnvRef.current);
    }
  }, []);

  // Live-push the running score so spectators see it update in realtime.
  const liveA = state?.a;
  const liveB = state?.b;
  useEffect(() => {
    if (liveA == null || liveB == null || readOnly) return;
    onLiveScore?.(liveA, liveB);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveA, liveB]);

  // notes (2 sides) restore + persist — skipped when the DB envelope already
  // restored them (it is the fresher copy).
  useEffect(() => {
    if (restoredFromDb.current) return;
    try { const raw = localStorage.getItem(noteKey); if (raw) { const o = JSON.parse(raw) as { a?: string; b?: string }; setNoteA(o.a || ''); setNoteB(o.b || ''); } } catch { /* ignore */ }
  }, [noteKey]);
  useEffect(() => {
    if (readOnly) return;
    try { if (noteA || noteB) localStorage.setItem(noteKey, JSON.stringify({ a: noteA, b: noteB })); else localStorage.removeItem(noteKey); } catch { /* ignore */ }
  }, [noteA, noteB, noteKey, readOnly]);

  // timeout countdown
  useEffect(() => {
    if (!active || active.left <= 0) return undefined;
    const id = window.setInterval(() => setActive((p) => (p ? { ...p, left: Math.max(0, p.left - 1) } : null)), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  const rotationCapable = useMemo(
    () => mode === 'sideOut' && loaded.isDoubles && !!loaded.playersA && !!loaded.playersB,
    [loaded, mode],
  );
  const setupReady = setupServer != null && !tossing && (!rotationCapable || (setupServerIdx != null && setupReceiverIdx != null));

  // ── Coin toss: spin between the two sides, decelerate, land random ──
  const tossTimer = useRef<number | null>(null);
  const coinToss = useCallback(() => {
    if (tossing) return;
    setSetupServer(null); setSetupServerIdx(null); setSetupReceiverIdx(null);
    setTossing(true);
    let n = 0;
    const total = 18 + Math.floor(Math.random() * 6);
    const step = () => {
      n++;
      if (n >= total) {
        const result: ServeSide = Math.random() < 0.5 ? 'a' : 'b';
        setTossHi(null); setTossing(false); setSetupServer(result);
        return;
      }
      setTossHi(n % 2 === 0 ? 'a' : 'b');
      tossTimer.current = window.setTimeout(step, 45 + n * 7);
    };
    step();
  }, [tossing]);
  useEffect(() => () => { if (tossTimer.current) window.clearTimeout(tossTimer.current); }, []);

  const begin = useCallback(async () => {
    if (readOnly || setupServer == null) return;
    // Codex review 2026-07-17: AWAIT the claim before any writable state
    // exists — two referees racing an empty claim must not both score.
    const claim = await onClaimLive?.();
    if (claim === false) { setClaimDenied(true); return; }
    setState(startState({
      mode, isSingles: !loaded.isDoubles, winTarget: target, firstServer: setupServer,
      players: rotationCapable ? { a: loaded.playersA!, b: loaded.playersB! } : undefined,
      firstServerIdx: setupServerIdx ?? 0, firstReceiverIdx: setupReceiverIdx ?? 0,
      totalSets: mode === 'manual' ? totalSetsPick : undefined,
    }));
    setHistory([]); setSwitchAnnounced(false);
    void goLandscape();
  }, [loaded, mode, target, totalSetsPick, setupServer, setupServerIdx, setupReceiverIdx, rotationCapable, goLandscape, onClaimLive, readOnly]);

  const tap = useCallback((side: ServeSide) => {
    if (readOnly || !state || isGameOver(state)) return;
    const next = applyRally(state, side);
    setHistory((h) => [...h, state]);
    setState(next);
    if (isGameOver(next)) setConfirming(true);
    else if (!switchAnnounced && Math.max(next.a, next.b) >= sideSwitchPoint(target)) { setSwitchAnnounced(true); setShowSwitch(true); }
  }, [state, switchAnnounced, target, readOnly]);

  // Manual-mode actions: push prev state for undo, apply the pure transition.
  const manualAct = useCallback((fn: (s: ScoreState) => ScoreState) => {
    if (readOnly || !state) return;
    const next = fn(state);
    if (next === state) return;
    setHistory((h) => [...h, state]);
    setState(next);
  }, [state, readOnly]);

  const undo = useCallback(() => {
    if (readOnly) return;
    setHistory((h) => {
      if (!h.length) return h;
      const prev = h[h.length - 1];
      setState(prev); setConfirming(false); setShowSwitch(false);
      if (Math.max(prev.a, prev.b) < sideSwitchPoint(target)) setSwitchAnnounced(false);
      return h.slice(0, -1);
    });
  }, [target, readOnly]);

  const startTO = useCallback((side: ServeSide, kind: 'reg' | 'med') => {
    if (readOnly) return;
    if (kind === 'reg') { if (usedReg[side] >= regularTO) return; setUsedReg((u) => ({ ...u, [side]: u[side] + 1 })); }
    else { if (usedMed[side] >= 1) return; setUsedMed((u) => ({ ...u, [side]: u[side] + 1 })); }
    setActive({ side, kind, left: kind === 'reg' ? 60 : 300 });
  }, [usedReg, usedMed, regularTO, readOnly]);

  const combinedNote = useCallback((): string | null => {
    const parts: string[] = [];
    if (noteA.trim()) parts.push(`${loaded.teamAName}: ${noteA.trim()}`);
    if (noteB.trim()) parts.push(`${loaded.teamBName}: ${noteB.trim()}`);
    return parts.length ? parts.join('\n') : null;
  }, [noteA, noteB, loaded]);

  const finish = useCallback(async (s: ScoreState) => {
    const isManualMulti = s.mode === 'manual' && (s.totalSets ?? 1) > 1;
    if (readOnly || (isManualMulti ? manualMatchWinner(s) === null : s.a === s.b)) return;
    setSaving(true);
    // Block the debounced push + unmount flush BEFORE awaiting — consumers
    // navigate inside onFinish, and an unmount mid-await must not republish
    // the envelope (Codex review round 3). A failed finish restores it.
    finishedRef.current = true;
    if (liveStateTimer.current) { window.clearTimeout(liveStateTimer.current); liveStateTimer.current = null; }
    try {
      exitLandscape();
      if (s.mode === 'manual') {
        // Codex review on #376: EVERY manual finish carries the archive —
        // single-set games also record their {s1,s2}, and totalSets keeps
        // the legacy meaning (configured BO count, not sets played).
        const w = manualSetsWon(s);
        const sets = { setsWon: w, setScores: manualFinalSetScores(s), totalSets: s.totalSets ?? 1 };
        if (isManualMulti) await onFinish(w.a, w.b, combinedNote(), sets);
        else await onFinish(s.a, s.b, combinedNote(), sets);
      } else {
        await onFinish(s.a, s.b, combinedNote());
      }
      // Clear resume state only AFTER the final result persisted.
      localStorage.removeItem(storeKey); localStorage.removeItem(noteKey);
      onLiveState?.(null); // clear the row's live state — the match is final
    } catch (e) {
      finishedRef.current = false; // finish failed — resume persistence
      throw e;
    } finally { setSaving(false); }
  }, [storeKey, noteKey, exitLandscape, onFinish, combinedNote, onLiveState, readOnly]);

  const inner = (
    <div style={{ flex: 1, minWidth: 0, background: 'var(--tl-bg)', color: 'var(--tl-fg)', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--tl-border)' }}>
        <button type="button" className="tl-btn" style={{ padding: '6px 10px' }} onClick={() => (onBack ? onBack() : navigate(loaded.backHref))}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 12, color: 'var(--tl-fg-3)' }}>{vi ? 'CHẤM TRỰC TIẾP' : 'LIVE SCORING'}</span>
        <div style={{ flex: 1 }} />
        {readOnly && (
          <span style={{
            fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, fontWeight: 500,
            letterSpacing: '0.06em', textTransform: 'uppercase',
            padding: '3px 9px', borderRadius: 4,
            ...(liveEnded
              ? { background: 'var(--tl-green-glow)', color: 'var(--tl-green)', border: '1px solid rgba(0, 185, 107, 0.30)' }
              : { background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)', border: '1px solid rgba(233, 182, 73, 0.30)' }),
          }}>
            {liveEnded
              ? (vi ? 'Trận đã kết thúc' : 'Match finished')
              : (vi ? 'Trọng tài khác đang chấm' : 'Another referee is scoring')}
          </span>
        )}
        {state && !readOnly && (
          <button type="button" className="tl-btn" style={{ padding: '6px 10px', ...((noteA.trim() || noteB.trim()) ? { color: 'var(--tl-green)', borderColor: 'var(--tl-green)' } : {}) }} onClick={() => setShowNote(true)}>
            <StickyNote className="w-4 h-4" /><span className="hidden sm:inline">{vi ? 'Ghi chú' : 'Note'}</span>
          </button>
        )}
      </header>

      {!state && readOnly ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tl-fg-3)', fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 13, padding: 24, textAlign: 'center' }}>
          {vi ? 'Trọng tài khác đang chấm trận này — chưa có dữ liệu để xem.' : 'Another referee is scoring this match — nothing to view yet.'}
        </div>
      ) : !state ? (
        <Setup
          vi={vi} loaded={loaded} mode={mode} setMode={setMode} target={target} setTarget={setTarget}
          totalSetsPick={totalSetsPick} setTotalSetsPick={setTotalSetsPick}
          regularTO={regularTO} setRegularTO={setRegularTO}
          rotationCapable={rotationCapable} setupServer={setupServer} tossing={tossing} tossHi={tossHi}
          setSetupServer={(s) => { setSetupServer(s); setSetupServerIdx(null); setSetupReceiverIdx(null); }}
          onToss={coinToss} setupServerIdx={setupServerIdx} setSetupServerIdx={setSetupServerIdx}
          setupReceiverIdx={setupReceiverIdx} setSetupReceiverIdx={setSetupReceiverIdx} ready={setupReady} onBegin={begin}
        />
      ) : (
        <Board vi={vi} loaded={loaded} state={state} target={target}
          onTap={tap} onUndo={undo} canUndo={history.length > 0} onEnd={() => { if (!readOnly) setConfirming(true); }}
          onManualAdjust={(side, delta) => manualAct((s) => manualAdjust(s, side, delta))}
          onManualServe={() => manualAct(manualNextServe)}
          onManualToggleServer={() => manualAct(manualToggleServer)}
          onManualEndSet={() => manualAct(manualEndSet)}
          regularTO={regularTO} usedReg={usedReg} usedMed={usedMed} onTimeout={startTO} />
      )}

      {showNote && <NoteOverlay vi={vi} loaded={loaded} noteA={noteA} noteB={noteB} setNoteA={setNoteA} setNoteB={setNoteB} onClose={() => setShowNote(false)} />}
      {active && <TimeoutOverlay vi={vi} loaded={loaded} active={active} onClose={() => setActive(null)} />}
      {showSwitch && <SwitchOverlay vi={vi} point={sideSwitchPoint(target)} onDone={() => setShowSwitch(false)} />}
      {confirming && state && (
        <ConfirmOverlay vi={vi} loaded={loaded} state={state} saving={saving} onEdit={() => setConfirming(false)} onConfirm={() => finish(state)} />
      )}
    </div>
  );

  // Board phase forces landscape (CSS rotate fallback for iOS where lock fails).
  return <ForceLandscape enabled={!!state}>{inner}</ForceLandscape>;
}

// ── Force landscape on portrait phones (CSS rotate; iOS-safe). Children use flex:1. ──
function ForceLandscape({ children, enabled }: { children: React.ReactNode; enabled: boolean }) {
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const update = () => setPortrait(window.innerHeight > window.innerWidth && window.innerWidth < 820);
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('orientationchange', update); };
  }, []);
  if (enabled && portrait) {
    return (
      <div style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--tl-bg)' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, width: '100dvh', height: '100dvw', transform: 'rotate(90deg) translateY(-100%)', transformOrigin: 'top left', display: 'flex' }}>
          {children}
        </div>
      </div>
    );
  }
  return <div style={{ height: '100dvh', display: 'flex', overflow: 'hidden' }}>{children}</div>;
}

// ── Setup ──
function Setup(props: {
  vi: boolean; loaded: RefereeLoaded; mode: ScoringMode; setMode: (m: ScoringMode) => void;
  target: number; setTarget: (n: number) => void;
  totalSetsPick: number; setTotalSetsPick: (n: number) => void;
  regularTO: number; setRegularTO: (n: number) => void;
  rotationCapable: boolean; setupServer: ServeSide | null; tossing: boolean; tossHi: ServeSide | null;
  setSetupServer: (s: ServeSide) => void; onToss: () => void;
  setupServerIdx: number | null; setSetupServerIdx: (n: number) => void;
  setupReceiverIdx: number | null; setSetupReceiverIdx: (n: number) => void; ready: boolean; onBegin: () => void;
}) {
  const { vi, loaded, mode, setMode, target, setTarget, rotationCapable, tossing, tossHi } = props;
  const serverTeam = props.setupServer === 'a' ? loaded.teamAName : loaded.teamBName;
  const serverNames = props.setupServer === 'a' ? loaded.playersA : loaded.playersB;
  const recvNames = props.setupServer === 'a' ? loaded.playersB : loaded.playersA;
  const hi = (s: ServeSide) => (tossing ? tossHi === s : props.setupServer === s);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: 24, paddingBottom: 'calc(32px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 520, margin: '0 auto', width: '100%' }}>
      <Field label={vi ? 'Thể thức tính điểm' : 'Scoring'}>
        <Segmented options={[['rally', vi ? 'Trực tiếp' : 'Rally'], ['sideOut', vi ? 'Giao bóng' : 'Side-out'], ['manual', vi ? 'Bảng điểm tay' : 'Manual']]} value={mode} onChange={(v) => setMode(v as ScoringMode)} />
      </Field>
      {mode !== 'manual' ? (
        <Field label={vi ? 'Điểm thắng' : 'Win target'}>
          <Segmented options={[[11, '11'], [15, '15'], [21, '21']]} value={target} onChange={(v) => setTarget(v as number)} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--tl-fg-3)' }}>
              {vi ? 'Hoặc nhập số điểm' : 'Or enter a score'}
            </span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={999}
              step={1}
              value={target}
              aria-label={vi ? 'Nhập điểm thắng' : 'Enter win target'}
              onFocus={(event) => event.currentTarget.select()}
              onChange={(event) => {
                const next = Number(event.currentTarget.value);
                if (Number.isInteger(next) && next >= 1 && next <= 999) setTarget(next);
              }}
              style={{
                width: 92,
                padding: '10px 12px',
                borderRadius: 'var(--tl-radius)',
                border: '1px solid var(--tl-border)',
                background: 'var(--tl-bg)',
                color: 'var(--tl-fg)',
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 16,
                fontWeight: 700,
                textAlign: 'center',
              }}
            />
          </label>
        </Field>
      ) : (
        <Field label={vi ? 'Số ván' : 'Sets'}>
          <Segmented options={[[1, vi ? '1 ván' : '1'], [3, 'BO3'], [5, 'BO5']]} value={props.totalSetsPick} onChange={(v) => props.setTotalSetsPick(v as number)} />
        </Field>
      )}
      <Field label={vi ? 'Số timeout mỗi đội' : 'Timeouts / team'}>
        <Segmented options={[[1, '1'], [2, '2'], [3, '3']]} value={props.regularTO} onChange={(v) => props.setRegularTO(v as number)} />
      </Field>

      <div style={{ height: 1, background: 'var(--tl-border)' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Label>{vi ? 'ĐỘI NÀO GIAO BÓNG TRƯỚC?' : 'WHO SERVES FIRST?'}</Label>
        <div style={{ display: 'flex', gap: 12 }}>
          <PickBtn on={hi('a')} disabled={tossing} onClick={() => props.setSetupServer('a')} big>{loaded.teamAName}</PickBtn>
          <PickBtn on={hi('b')} disabled={tossing} onClick={() => props.setSetupServer('b')} big>{loaded.teamBName}</PickBtn>
        </div>
        <button type="button" className="tl-btn" style={{ alignSelf: 'center', padding: '8px 16px', opacity: tossing ? 0.6 : 1 }} disabled={tossing} onClick={props.onToss}>
          <Dice5 className="w-4 h-4" /> {tossing ? (vi ? 'Đang quay…' : 'Spinning…') : (vi ? 'Bốc thăm' : 'Coin toss')}
        </button>
      </div>

      {rotationCapable && props.setupServer && !tossing && serverNames && recvNames && (
        <>
          <PlayerPick label={vi ? 'AI GIAO BÓNG TRƯỚC?' : 'WHO SERVES FIRST?'} team={serverTeam} names={serverNames} selected={props.setupServerIdx} onSelect={props.setSetupServerIdx} />
          <PlayerPick label={vi ? 'AI ĐỠ BÓNG TRƯỚC?' : 'WHO RECEIVES FIRST?'} team={props.setupServer === 'a' ? loaded.teamBName : loaded.teamAName} names={recvNames} selected={props.setupReceiverIdx} onSelect={props.setSetupReceiverIdx} />
        </>
      )}

      {props.ready && (
        <button type="button" className="tl-btn green" style={{ padding: 14, justifyContent: 'center', fontSize: 15 }} onClick={props.onBegin}>{vi ? 'BẮT ĐẦU' : 'START'}</button>
      )}
    </div>
  );
}

// ── Board ──
function Board(props: {
  vi: boolean; loaded: RefereeLoaded; state: ScoreState; target: number;
  onTap: (s: ServeSide) => void; onUndo: () => void; canUndo: boolean; onEnd: () => void;
  onManualAdjust: (side: ServeSide, delta: number) => void;
  onManualServe: () => void; onManualToggleServer: () => void; onManualEndSet: () => void;
  regularTO: number; usedReg: Sides; usedMed: Sides; onTimeout: (s: ServeSide, k: 'reg' | 'med') => void;
}) {
  const { vi, loaded, state, target } = props;
  const mode = state.mode; // authoritative (survives localStorage resume; React `mode` may be stale)
  const server = servingPlayer(state); const recv = receivingPlayer(state); const right = servingSideRight(state);
  const servingName = state.serving === 'a' ? loaded.teamAName : loaded.teamBName;
  const otherSide: ServeSide = state.serving === 'a' ? 'b' : 'a';

  const serveLine = server && recv && right !== null
    ? `${vi ? 'GIAO' : 'SERVE'}: ${server} (${vi ? 'sân' : 'court'} ${right ? (vi ? 'phải' : 'R') : (vi ? 'trái' : 'L')})  ·  ${vi ? 'ĐỠ' : 'RECV'}: ${recv}`
    : mode !== 'rally' ? `${vi ? 'đang giao' : 'serving'}: ${servingName}${state.isSingles ? '' : ` · ${vi ? 'tay' : 'server'} ${state.serverNumber}`}` : (vi ? 'tính điểm trực tiếp' : 'rally scoring');

  const calloutBar = (
    <div style={{ textAlign: 'center', padding: '12px', background: 'var(--tl-surface)' }}>
      <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, fontSize: 'clamp(36px, 11vw, 60px)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{callout(state)}</div>
      <div style={{ marginTop: 4, fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 12.5, fontWeight: 700, color: 'var(--tl-green)' }}>{serveLine}</div>
    </div>
  );

  const toBar = (
    <div style={{ display: 'flex', gap: 8, padding: '6px 10px', background: 'var(--tl-surface)', justifyContent: 'space-between' }}>
      <TimeoutGroup vi={vi} label={loaded.teamAName} reg={props.regularTO - props.usedReg.a} med={1 - props.usedMed.a} onReg={() => props.onTimeout('a', 'reg')} onMed={() => props.onTimeout('a', 'med')} />
      <TimeoutGroup vi={vi} label={loaded.teamBName} reg={props.regularTO - props.usedReg.b} med={1 - props.usedMed.b} onReg={() => props.onTimeout('b', 'reg')} onMed={() => props.onTimeout('b', 'med')} right />
    </div>
  );

  const bottom = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 10, background: 'var(--tl-surface)' }}>
      <button type="button" className="tl-btn" style={{ flex: 1, justifyContent: 'center', padding: 13, opacity: props.canUndo ? 1 : 0.4 }} disabled={!props.canUndo} onClick={props.onUndo}>
        <RotateCcw className="w-4 h-4" /> {vi ? 'HOÀN TÁC' : 'UNDO'}
      </button>
      {mode !== 'manual' && (
        <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, color: 'var(--tl-fg-4)' }}>{vi ? 'tới' : 'to'} {target}</span>
      )}
      <button type="button" className="tl-btn green" style={{ flex: 1, justifyContent: 'center', padding: 13 }} onClick={props.onEnd}>{vi ? 'KẾT THÚC' : 'END'}</button>
    </div>
  );

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {calloutBar}
      {mode === 'sideOut' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, padding: '6px 12px', background: 'var(--tl-surface)', fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 13.5, fontWeight: 600 }}>
          <span style={{ color: state.serving === 'a' ? 'var(--tl-green)' : 'var(--tl-fg-2)' }}>{loaded.teamAName} {state.a}</span>
          <span style={{ color: 'var(--tl-fg-4)' }}>·</span>
          <span style={{ color: state.serving === 'b' ? 'var(--tl-green)' : 'var(--tl-fg-2)' }}>{loaded.teamBName} {state.b}</span>
        </div>
      )}
      <div style={{ flex: 1, display: 'flex' }}>
        {mode === 'rally' ? (
          <>
            <TapZone name={loaded.teamAName} score={scoreOf(state, 'a')} onClick={() => props.onTap('a')} vi={vi} />
            <div style={{ width: 1, background: 'var(--tl-border)' }} />
            <TapZone name={loaded.teamBName} score={scoreOf(state, 'b')} onClick={() => props.onTap('b')} vi={vi} />
          </>
        ) : mode === 'manual' ? (
          <>
            <ManualZone name={loaded.teamAName} score={state.a} serving={state.serving === 'a'} vi={vi}
              onPlus={() => props.onManualAdjust('a', 1)} onMinus={() => props.onManualAdjust('a', -1)} />
            <div style={{ width: 1, background: 'var(--tl-border)' }} />
            <ManualZone name={loaded.teamBName} score={state.b} serving={state.serving === 'b'} vi={vi}
              onPlus={() => props.onManualAdjust('b', 1)} onMinus={() => props.onManualAdjust('b', -1)} />
          </>
        ) : (
          <>
            <ActionZone big={vi ? 'ĐIỂM' : 'POINT'} sub={`${vi ? 'cho' : 'for'} ${servingName}`} tone="green" onClick={() => props.onTap(state.serving)} />
            <div style={{ width: 1, background: 'var(--tl-border)' }} />
            <ActionZone big={vi ? 'ĐỔI GIAO' : 'SIDE OUT'} sub={vi ? 'mất giao' : 'loss of serve'} tone="neutral" onClick={() => props.onTap(otherSide)} />
          </>
        )}
      </div>
      {mode === 'manual' && (
        <div style={{ display: 'flex', gap: 8, padding: '6px 10px', background: 'var(--tl-surface)', justifyContent: 'center', flexWrap: 'wrap' }}>
          {(state.totalSets ?? 1) > 1 && (
            <span style={{ alignSelf: 'center', fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 12, fontWeight: 700, color: 'var(--tl-fg-2)' }}>
              {vi ? 'Ván' : 'Set'} {(state.sets?.length ?? 0) + 1}/{state.totalSets}
              {' · '}
              {(state.sets ?? []).filter((x) => x.s1 > x.s2).length}–{(state.sets ?? []).filter((x) => x.s2 > x.s1).length}
            </span>
          )}
          <button type="button" className="tl-btn" style={{ flex: 1, justifyContent: 'center', padding: 10, maxWidth: 260 }} onClick={props.onManualServe}>
            <ArrowLeftRight className="w-4 h-4" /> {vi ? 'ĐỔI GIAO' : 'ROTATE SERVE'}
          </button>
          {!state.isSingles && (
            <button type="button" className="tl-btn" style={{ flex: 1, justifyContent: 'center', padding: 10, maxWidth: 260 }} onClick={props.onManualToggleServer}>
              {vi ? `TAY ${state.serverNumber === 1 ? '2' : '1'}` : `SERVER ${state.serverNumber === 1 ? '2' : '1'}`}
            </button>
          )}
          {(state.totalSets ?? 1) > 1 && (state.sets?.length ?? 0) < (state.totalSets ?? 1) - 1 && (
            <button type="button" className="tl-btn" style={{ flex: 1, justifyContent: 'center', padding: 10, maxWidth: 260 }} onClick={props.onManualEndSet}>
              {vi ? 'HẾT VÁN' : 'END SET'}
            </button>
          )}
        </div>
      )}
      {toBar}
      {bottom}
    </div>
  );
}

function TimeoutGroup(props: { vi: boolean; label: string; reg: number; med: number; onReg: () => void; onMed: () => void; right?: boolean }) {
  const btn = (txt: string, n: number, on: () => void, med?: boolean) => (
    <button type="button" onClick={on} disabled={n <= 0}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 9px', borderRadius: 8, border: '1px solid var(--tl-border)', background: 'var(--tl-bg)', color: n <= 0 ? 'var(--tl-fg-4)' : (med ? 'var(--tl-live)' : 'var(--tl-fg-2)'), fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, fontWeight: 600, cursor: n <= 0 ? 'default' : 'pointer', opacity: n <= 0 ? 0.5 : 1 }}>
      {med ? <Cross className="w-3 h-3" /> : <Timer className="w-3 h-3" />}{txt} {n}
    </button>
  );
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexDirection: props.right ? 'row-reverse' : 'row' }}>
      <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 10, color: 'var(--tl-fg-4)', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{props.label}</span>
      {btn(props.vi ? 'TO' : 'TO', props.reg, props.onReg)}
      {btn(props.vi ? 'Y' : 'Med', props.med, props.onMed, true)}
    </div>
  );
}

function TapZone(props: { name: string; score: number; serving?: boolean; onClick: () => void; vi: boolean }) {
  return (
    <button type="button" onClick={props.onClick}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--tl-bg)', border: 0, color: 'var(--tl-fg)', cursor: 'pointer', padding: 16 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontSize: 22, textAlign: 'center' }}>
        {props.serving && <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--tl-green)', flexShrink: 0 }} />}
        {props.name}
      </span>
      <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, fontSize: 'clamp(54px, 20vw, 96px)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{props.score}</span>
      <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--tl-fg-4)' }}>{props.vi ? 'CHẠM = +1' : 'TAP = +1'}</span>
    </button>
  );
}

function ManualZone(props: { name: string; score: number; serving: boolean; vi: boolean; onPlus: () => void; onMinus: () => void }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'var(--tl-bg)', padding: 16 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontSize: 22, textAlign: 'center' }}>
        {props.serving && <span style={{ width: 9, height: 9, borderRadius: 99, background: 'var(--tl-green)', flexShrink: 0 }} />}
        {props.name}
      </span>
      <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, fontSize: 'clamp(54px, 20vw, 96px)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{props.score}</span>
      <div style={{ display: 'flex', gap: 10 }}>
        <button type="button" className="tl-btn" style={{ padding: '10px 22px', fontSize: 18, fontWeight: 700 }} onClick={props.onMinus} disabled={props.score <= 0}>−1</button>
        <button type="button" className="tl-btn green" style={{ padding: '10px 22px', fontSize: 18, fontWeight: 700 }} onClick={props.onPlus}>+1</button>
      </div>
    </div>
  );
}

function ActionZone(props: { big: string; sub: string; tone: 'green' | 'neutral'; onClick: () => void }) {
  const green = props.tone === 'green';
  return (
    <button type="button" onClick={props.onClick}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, border: 0, cursor: 'pointer', padding: 16, background: green ? 'var(--tl-green-glow)' : 'var(--tl-bg)', color: green ? 'var(--tl-green)' : 'var(--tl-fg)' }}>
      <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, fontSize: 'clamp(32px, 10vw, 54px)', letterSpacing: '0.02em', lineHeight: 1 }}>{props.big}</span>
      <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 12, color: green ? 'var(--tl-green)' : 'var(--tl-fg-3)' }}>{props.sub}</span>
    </button>
  );
}

// ── Overlays ──
function NoteOverlay(props: { vi: boolean; loaded: RefereeLoaded; noteA: string; noteB: string; setNoteA: (v: string) => void; setNoteB: (v: string) => void; onClose: () => void }) {
  const ta = (label: string, val: string, on: (v: string) => void) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, width: '100%' }}>
      <span style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 11, fontWeight: 600, color: 'var(--tl-green)' }}>{label}</span>
      <textarea value={val} onChange={(e) => on(e.target.value)} rows={3} placeholder={props.vi ? 'Sự cố, hội ý, khiếu nại…' : 'Incidents, timeouts…'}
        style={{ width: '100%', resize: 'vertical', background: 'var(--tl-bg)', color: 'var(--tl-fg)', border: '1px solid var(--tl-border)', borderRadius: 'var(--tl-radius)', padding: 9, fontFamily: 'inherit', fontSize: 14, outline: 'none' }} />
    </div>
  );
  return (
    <Overlay>
      <div style={{ alignSelf: 'flex-start', fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, letterSpacing: '0.08em', fontSize: 12.5, color: 'var(--tl-fg-3)' }}>{props.vi ? 'GHI CHÚ TRỌNG TÀI' : 'REFEREE NOTE'}</div>
      {ta(props.loaded.teamAName, props.noteA, props.setNoteA)}
      {ta(props.loaded.teamBName, props.noteB, props.setNoteB)}
      <button type="button" className="tl-btn green" style={{ width: '100%', justifyContent: 'center', padding: 13 }} onClick={props.onClose}>{props.vi ? 'Xong' : 'Done'}</button>
    </Overlay>
  );
}

function TimeoutOverlay(props: { vi: boolean; loaded: RefereeLoaded; active: Active; onClose: () => void }) {
  const { active, loaded, vi } = props;
  const team = active.side === 'a' ? loaded.teamAName : loaded.teamBName;
  const med = active.kind === 'med';
  const done = active.left <= 0;
  return (
    <Overlay>
      {med ? <Cross className="w-8 h-8" style={{ color: 'var(--tl-live)' }} /> : <Timer className="w-8 h-8" style={{ color: 'var(--tl-green)' }} />}
      <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, letterSpacing: '0.06em', fontSize: 13, color: med ? 'var(--tl-live)' : 'var(--tl-green)' }}>
        {med ? (vi ? 'TIMEOUT Y TẾ' : 'MEDICAL TIMEOUT') : (vi ? 'TIMEOUT' : 'TIMEOUT')} · {team}
      </div>
      <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, fontSize: 64, fontVariantNumeric: 'tabular-nums', color: done ? 'var(--tl-live)' : 'var(--tl-fg)' }}>{mmss(active.left)}</div>
      {done && <div style={{ fontSize: 12, color: 'var(--tl-live)' }}>{vi ? 'HẾT GIỜ' : 'TIME UP'}</div>}
      <button type="button" className="tl-btn green" style={{ width: '100%', justifyContent: 'center', padding: 13 }} onClick={props.onClose}>{vi ? 'Tiếp tục' : 'Resume'}</button>
    </Overlay>
  );
}

function SwitchOverlay(props: { vi: boolean; point: number; onDone: () => void }) {
  return (
    <Overlay>
      <ArrowLeftRight className="w-8 h-8" style={{ color: 'var(--tl-green)' }} />
      <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, letterSpacing: '0.12em', fontSize: 15 }}>{props.vi ? 'ĐỔI SÂN' : 'SWITCH ENDS'}</div>
      <div style={{ fontSize: 13, color: 'var(--tl-fg-3)', textAlign: 'center' }}>{props.vi ? `Tới mốc ${props.point} điểm — hai đội đổi sân.` : `Reached ${props.point} — switch ends.`}</div>
      <button type="button" className="tl-btn green" style={{ width: '100%', justifyContent: 'center', padding: 13 }} onClick={props.onDone}>{props.vi ? 'Đã đổi sân' : 'Done'}</button>
    </Overlay>
  );
}

function ConfirmOverlay(props: { vi: boolean; loaded: RefereeLoaded; state: ScoreState; saving: boolean; onEdit: () => void; onConfirm: () => void }) {
  const { state, loaded, vi } = props;
  const isManualMulti = state.mode === 'manual' && (state.totalSets ?? 1) > 1;
  const setsWon = isManualMulti ? manualSetsWon(state) : null;
  const tie = isManualMulti ? setsWon!.a === setsWon!.b : state.a === state.b;
  const winA = isManualMulti ? setsWon!.a > setsWon!.b : state.a > state.b;
  const wName = tie ? null : winA ? loaded.teamAName : loaded.teamBName;
  return (
    <Overlay>
      {wName && <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, letterSpacing: '0.1em', fontSize: 13, color: 'var(--tl-green)' }}>{wName} {vi ? 'THẮNG' : 'WINS'}</div>}
      <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontWeight: 700, fontSize: 42, fontVariantNumeric: 'tabular-nums' }}>
        {isManualMulti ? `${setsWon!.a} – ${setsWon!.b}` : `${state.a} – ${state.b}`}
      </div>
      {isManualMulti && (
        <div style={{ fontFamily: 'Geist Mono, ui-monospace, monospace', fontSize: 13, color: 'var(--tl-fg-3)' }}>
          {manualFinalSetScores(state).map((x) => `${x.s1}-${x.s2}`).join('  ·  ')}
        </div>
      )}
      {tie && <div style={{ fontSize: 12, color: 'var(--tl-live)' }}>{vi ? 'Tỉ số hoà — chưa có đội thắng.' : 'Tie — no winner.'}</div>}
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <button type="button" className="tl-btn" style={{ flex: 1, justifyContent: 'center', padding: 13 }} onClick={props.onEdit}>{vi ? 'Sửa' : 'Edit'}</button>
        <button type="button" className="tl-btn green" style={{ flex: 1, justifyContent: 'center', padding: 13, opacity: tie || props.saving ? 0.5 : 1 }} disabled={tie || props.saving} onClick={props.onConfirm}>{vi ? 'Xác nhận' : 'Confirm'}</button>
      </div>
    </Overlay>
  );
}

// ── Small helpers ──
function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-black/60" style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28, zIndex: 60 }}>
      <div style={{ ...card, padding: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 13, maxWidth: 360, width: '100%' }}>{children}</div>
    </div>
  );
}
export function RefereeCentered({ children }: { children: React.ReactNode }) {
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
            style={{ flex: 1, padding: '10px 12px', borderRadius: 'var(--tl-radius)', border: `1px solid ${on ? 'var(--tl-green)' : 'var(--tl-border)'}`, background: on ? 'var(--tl-green-glow)' : 'var(--tl-bg)', color: on ? 'var(--tl-green)' : 'var(--tl-fg-2)', fontFamily: 'inherit', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>{lbl}</button>
        );
      })}
    </div>
  );
}
function PickBtn({ on, onClick, big, disabled, children }: { on: boolean; onClick: () => void; big?: boolean; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      style={{ flex: 1, padding: big ? '30px 12px' : '16px 12px', borderRadius: 'var(--tl-radius-lg)', border: `1px solid ${on ? 'var(--tl-green)' : 'var(--tl-border)'}`, background: on ? 'var(--tl-green-glow)' : 'var(--tl-surface)', color: on ? 'var(--tl-green)' : 'var(--tl-fg)', fontFamily: 'Instrument Serif, serif', fontStyle: 'italic', fontSize: 20, cursor: disabled ? 'default' : 'pointer', transition: 'border-color 0.1s, background 0.1s' }}>{children}</button>
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
              style={{ flex: 1, padding: 16, borderRadius: 'var(--tl-radius)', border: `1px solid ${on ? 'var(--tl-green)' : 'var(--tl-border)'}`, background: on ? 'var(--tl-green-glow)' : 'var(--tl-surface)', color: on ? 'var(--tl-green)' : 'var(--tl-fg)', fontWeight: 600, fontSize: 15, cursor: 'pointer' }}>{n}</button>
          );
        })}
      </div>
    </div>
  );
}
