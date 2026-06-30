import { describe, it, expect } from 'vitest';
import {
  startState, applyRally, callout, isGameOver, winnerSide,
  servingPlayer, receivingPlayer, servingSideRight, sideSwitchPoint,
  type ScoreState, type ServeSide,
} from '@/lib/refereeScoring';

const apply = (s: ScoreState, ws: ServeSide[]) => ws.reduce((acc, w) => applyRally(acc, w), s);

describe('rally — each win scores', () => {
  it('+1 per rally; winner serves next', () => {
    let s = startState({ mode: 'rally', isSingles: false, winTarget: 11 });
    s = apply(s, ['a', 'a', 'b', 'a']);
    expect([s.a, s.b]).toEqual([3, 1]);
    expect(s.serving).toBe('a');
    expect(callout(s)).toBe('3-1');
  });

  it('win by two', () => {
    let s = startState({ mode: 'rally', isSingles: false, winTarget: 11 });
    s = apply(s, [...Array(10).fill('a'), ...Array(10).fill('b')] as ServeSide[]);
    expect(isGameOver(s)).toBe(false); // 10-10
    s = applyRally(s, 'a');
    expect(isGameOver(s)).toBe(false); // 11-10
    s = applyRally(s, 'a');
    expect(isGameOver(s)).toBe(true);
    expect(winnerSide(s)).toBe('a'); // 12-10
  });
});

describe('side-out doubles', () => {
  it('starts 0-0-2 (start exception)', () => {
    const s = startState({ mode: 'sideOut', isSingles: false, winTarget: 11, firstServer: 'a' });
    expect(s.serverNumber).toBe(2);
    expect(callout(s)).toBe('0-0-2');
  });

  it('server 1→2→side-out sequence', () => {
    let s = startState({ mode: 'sideOut', isSingles: false, winTarget: 11, firstServer: 'a' });
    s = applyRally(s, 'a'); // A serving (server 2) wins → +1, keeps serve
    expect([s.a, s.serving, s.serverNumber]).toEqual([1, 'a', 2]);
    s = applyRally(s, 'b'); // A (server 2) loses → side-out to B, server 1, no point
    expect([s.a, s.b, s.serving, s.serverNumber]).toEqual([1, 0, 'b', 1]);
    s = applyRally(s, 'a'); // B (server 1) loses → server 2, same team
    expect([s.serving, s.serverNumber]).toEqual(['b', 2]);
    s = applyRally(s, 'a'); // B (server 2) loses → side-out to A, server 1
    expect([s.serving, s.serverNumber]).toEqual(['a', 1]);
  });

  it('only the serving team scores', () => {
    let s = startState({ mode: 'sideOut', isSingles: false, winTarget: 11, firstServer: 'a' });
    s = applyRally(s, 'b'); // side-out → B serves, no point
    expect([s.a, s.b, s.serving]).toEqual([0, 0, 'b']);
    s = applyRally(s, 'b'); // B serving wins → +1
    expect(s.b).toBe(1);
  });
});

describe('side-out singles — immediate side-out', () => {
  it('loses serve → side-out; callout has no server#', () => {
    let s = startState({ mode: 'sideOut', isSingles: true, winTarget: 11, firstServer: 'a' });
    expect(s.serverNumber).toBe(1);
    s = applyRally(s, 'b'); // A loses serve → side-out
    expect([s.serving, s.a, s.b]).toEqual(['b', 0, 0]);
    s = applyRally(s, 'b');
    expect(s.b).toBe(1);
    expect(callout(s)).toBe('1-0');
  });
});

describe('doubles rotation — next-rally names', () => {
  it('tracks server / side / receiver by name', () => {
    let s = startState({
      mode: 'sideOut', isSingles: false, winTarget: 11, firstServer: 'a',
      players: { a: ['A0', 'A1'], b: ['B0', 'B1'] }, firstServerIdx: 0, firstReceiverIdx: 0,
    });
    expect(callout(s)).toBe('0-0-2');
    expect([servingPlayer(s), servingSideRight(s), receivingPlayer(s)]).toEqual(['A0', true, 'B0']);

    s = applyRally(s, 'a'); // A wins → A0 keeps serving, swaps to left; receiver now B1
    expect(callout(s)).toBe('1-0-2');
    expect([servingPlayer(s), servingSideRight(s), receivingPlayer(s)]).toEqual(['A0', false, 'B1']);

    s = applyRally(s, 'b'); // side-out (was server 2) → B serves, server 1 = B0 (even=right)
    expect(callout(s)).toBe('0-1-1');
    expect([servingPlayer(s), servingSideRight(s)]).toEqual(['B0', true]);

    s = applyRally(s, 'b'); // B0 keeps serving from left
    expect([callout(s), servingPlayer(s), servingSideRight(s)]).toEqual(['1-1-1', 'B0', false]);

    s = applyRally(s, 'a'); // B server 1→2 = B1, serves from current position
    expect([callout(s), servingPlayer(s)]).toEqual(['1-1-2', 'B1']);
  });
});

describe('locked after game over', () => {
  it('no change once over', () => {
    let s = startState({ mode: 'rally', isSingles: false, winTarget: 11, winByTwo: false });
    s = apply(s, Array(11).fill('a') as ServeSide[]);
    expect(isGameOver(s)).toBe(true);
    s = applyRally(s, 'b');
    expect([s.a, s.b]).toEqual([11, 0]);
  });
});

describe('sideSwitchPoint', () => {
  it('11→6, 15→8, 21→11', () => {
    expect([sideSwitchPoint(11), sideSwitchPoint(15), sideSwitchPoint(21)]).toEqual([6, 8, 11]);
  });
});
