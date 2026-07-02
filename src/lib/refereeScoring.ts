// Referee scoring engine — pure, no side effects. Port of the native
// apple/ThePickleHub/Core/Scoring/ScoringEngine.swift (kept in sync). The referee
// answers ONE question per rally — "who won?" — and the engine derives score,
// server number, side-out, doubles rotation, and game-over. See
// apple/docs/referee-live-scoring-spec.md.

export type ServeSide = 'a' | 'b';
export type ScoringMode = 'rally' | 'sideOut';

/** Doubles side-out court positions (for the "next rally" display by name). */
export interface ServeRotation {
  aPlayers: [string, string];
  bPlayers: [string, string];
  aRightIdx: number; // 0|1 — which player of A is on the right (even) court
  bRightIdx: number;
  serverIdx: number; // index of the current server within the serving team
}

export interface ScoreState {
  a: number;
  b: number;
  serving: ServeSide;
  serverNumber: number; // 1|2 — doubles side-out only; rally/singles ignore
  mode: ScoringMode;
  isSingles: boolean;
  winTarget: number;
  winByTwo: boolean;
  rotation: ServeRotation | null;
}

const other = (s: ServeSide): ServeSide => (s === 'a' ? 'b' : 'a');

export interface StartOpts {
  mode: ScoringMode;
  isSingles: boolean;
  winTarget: number;
  winByTwo?: boolean;
  firstServer?: ServeSide;
  players?: { a: [string, string]; b: [string, string] };
  firstServerIdx?: number;
  firstReceiverIdx?: number;
}

/** Start one game. Doubles side-out starts 0-0-2 (start exception): the first
 *  serving team gets a single server before the first side-out. */
export function startState(opts: StartOpts): ScoreState {
  const {
    mode, isSingles, winTarget, winByTwo = true, firstServer = 'a',
    players, firstServerIdx = 0, firstReceiverIdx = 0,
  } = opts;
  let rotation: ServeRotation | null = null;
  if (players && mode === 'sideOut' && !isSingles) {
    const aRight = firstServer === 'a' ? firstServerIdx : firstReceiverIdx;
    const bRight = firstServer === 'b' ? firstServerIdx : firstReceiverIdx;
    rotation = {
      aPlayers: players.a, bPlayers: players.b,
      aRightIdx: aRight, bRightIdx: bRight, serverIdx: firstServerIdx,
    };
  }
  return {
    a: 0, b: 0, serving: firstServer,
    serverNumber: mode === 'sideOut' && !isSingles ? 2 : 1,
    mode, isSingles, winTarget, winByTwo, rotation,
  };
}

export const scoreOf = (s: ScoreState, side: ServeSide): number => (side === 'a' ? s.a : s.b);

// ponytail: no point cap (e.g. 15 in a game to 11). Pickleball has none by default.
export function isGameOver(s: ScoreState): boolean {
  if (!(s.a >= s.winTarget || s.b >= s.winTarget)) return false;
  return s.winByTwo ? Math.abs(s.a - s.b) >= 2 : true;
}

export function winnerSide(s: ScoreState): ServeSide | null {
  if (!isGameOver(s)) return null;
  return s.a > s.b ? 'a' : 'b';
}

/** Score the referee calls. Side-out is server-relative (doubles adds server#);
 *  rally is plain "a-b". */
export function callout(s: ScoreState): string {
  if (s.mode === 'rally') return `${s.a}-${s.b}`;
  const base = `${scoreOf(s, s.serving)}-${scoreOf(s, other(s.serving))}`;
  return s.isSingles ? base : `${base}-${s.serverNumber}`;
}

// ── Next-rally display (doubles side-out with names) ──
const rightIdx = (r: ServeRotation, side: ServeSide) => (side === 'a' ? r.aRightIdx : r.bRightIdx);
const leftIdx = (r: ServeRotation, side: ServeSide) => (rightIdx(r, side) === 0 ? 1 : 0);
const playersOf = (r: ServeRotation, side: ServeSide) => (side === 'a' ? r.aPlayers : r.bPlayers);

export function servingSideRight(s: ScoreState): boolean | null {
  if (!s.rotation) return null;
  return s.rotation.serverIdx === rightIdx(s.rotation, s.serving);
}
export function servingPlayer(s: ScoreState): string | null {
  if (!s.rotation) return null;
  return playersOf(s.rotation, s.serving)[s.rotation.serverIdx];
}
export function receivingPlayer(s: ScoreState): string | null {
  if (!s.rotation) return null;
  const right = servingSideRight(s);
  if (right === null) return null;
  const recv = other(s.serving);
  return playersOf(s.rotation, recv)[right ? rightIdx(s.rotation, recv) : leftIdx(s.rotation, recv)];
}

/** Apply one rally. `w` = the team that WON the rally (not necessarily serving).
 *  Game already over → locked, returns input unchanged. Returns a NEW state. */
export function applyRally(state: ScoreState, w: ServeSide): ScoreState {
  if (isGameOver(state)) return state;
  const s: ScoreState = { ...state, rotation: state.rotation ? { ...state.rotation } : null };

  if (s.mode === 'rally') {
    if (w === 'a') s.a++; else s.b++;
    s.serving = w; // rally winner serves next (display only)
    return s;
  }

  // side-out
  if (w === s.serving) {
    if (w === 'a') s.a++; else s.b++; // serving team scores, keeps serve
    if (s.rotation) {
      if (s.serving === 'a') s.rotation.aRightIdx = s.rotation.aRightIdx === 0 ? 1 : 0;
      else s.rotation.bRightIdx = s.rotation.bRightIdx === 0 ? 1 : 0;
    }
  } else if (s.isSingles || s.serverNumber === 2) {
    s.serving = other(s.serving); // side-out
    s.serverNumber = 1;
    if (s.rotation) {
      const sc = scoreOf(s, s.serving);
      s.rotation.serverIdx = sc % 2 === 0 ? rightIdx(s.rotation, s.serving) : leftIdx(s.rotation, s.serving);
    }
  } else {
    s.serverNumber = 2; // second server, same team, same positions
    if (s.rotation) s.rotation.serverIdx = s.rotation.serverIdx === 0 ? 1 : 0;
  }
  return s;
}

/** Midpoint side switch (11→6, 15→8, 21→11). */
export const sideSwitchPoint = (winTarget: number): number => Math.floor((winTarget + 1) / 2);
