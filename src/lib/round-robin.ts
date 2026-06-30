/**
 * Round Robin scheduling using Circle Method (Berger tables)
 * Ensures each player plays exactly once per round
 */

export interface RoundRobinMatch {
  player1: string;
  player2: string;
  rrRoundNumber: number;
  rrMatchIndex: number;
}

/**
 * Generate round robin matches using Circle Method
 * For N players (even): N-1 rounds, each round has N/2 matches
 * For N players (odd): N rounds, each round has (N-1)/2 matches, 1 player gets BYE
 */
export function generateCircleMethodMatches(playerIds: string[]): RoundRobinMatch[] {
  const n = playerIds.length;
  if (n < 2) return [];

  // If odd number of players, add a BYE placeholder
  const players = [...playerIds];
  const isOdd = n % 2 === 1;
  if (isOdd) {
    players.push('BYE');
  }

  const numPlayers = players.length;
  const numRounds = numPlayers - 1;
  const matchesPerRound = numPlayers / 2;
  const matches: RoundRobinMatch[] = [];

  // Circle method: fix position 0, rotate others
  // Players array positions: [0, 1, 2, 3, 4, 5, ...]
  // Matches: (0 vs last), (1 vs last-1), (2 vs last-2), ...
  
  const rotating = players.slice(1); // All except first player

  for (let round = 0; round < numRounds; round++) {
    // Build current round pairings
    const currentOrder = [players[0], ...rotating];
    
    for (let i = 0; i < matchesPerRound; i++) {
      const p1Index = i;
      const p2Index = numPlayers - 1 - i;
      const p1 = currentOrder[p1Index];
      const p2 = currentOrder[p2Index];

      // Skip BYE matches
      if (p1 === 'BYE' || p2 === 'BYE') continue;

      matches.push({
        player1: p1,
        player2: p2,
        rrRoundNumber: round + 1,
        rrMatchIndex: matches.filter(m => m.rrRoundNumber === round + 1).length,
      });
    }

    // Rotate: move last element to first position in rotating array
    rotating.unshift(rotating.pop()!);
  }

  return matches;
}

/**
 * Merge matches from multiple groups by round number
 * Round 1 from all groups, then Round 2, etc.
 */
export function mergeMatchesByRound<T extends { groupIndex: number; rrRoundNumber: number; rrMatchIndex: number }>(
  groupMatches: T[][]
): T[] {
  if (groupMatches.length === 0) return [];

  // Find max round number across all groups
  const maxRound = Math.max(
    ...groupMatches.flatMap(gm => gm.map(m => m.rrRoundNumber))
  );

  const merged: T[] = [];

  for (let round = 1; round <= maxRound; round++) {
    for (let groupIdx = 0; groupIdx < groupMatches.length; groupIdx++) {
      const roundMatches = groupMatches[groupIdx]
        .filter(m => m.rrRoundNumber === round)
        .sort((a, b) => a.rrMatchIndex - b.rrMatchIndex);
      merged.push(...roundMatches);
    }
  }

  return merged;
}

/**
 * Check for consecutive matches by same player and do light swaps if needed
 * Goal: no player plays more than 2 consecutive matches
 */
export function optimizeMatchOrder<T extends { player1: string; player2: string; rrRoundNumber: number }>(
  matches: T[]
): T[] {
  if (matches.length <= 2) return matches;

  const result = [...matches];
  
  // Check for consecutive matches (3 or more in a row by same player)
  for (let i = 0; i < result.length - 2; i++) {
    const getPlayers = (m: T) => [m.player1, m.player2];
    const p1 = getPlayers(result[i]);
    const p2 = getPlayers(result[i + 1]);
    const p3 = getPlayers(result[i + 2]);

    // Find common player across all 3
    const commonPlayer = p1.find(p => p2.includes(p) && p3.includes(p));
    
    if (commonPlayer) {
      // Try to swap match i+2 with nearby match in same round
      const round = result[i + 2].rrRoundNumber;
      const swapCandidates = result
        .map((m, idx) => ({ m, idx }))
        .filter(({ m, idx }) => 
          idx > i + 2 && 
          idx <= i + 5 && // Look ahead up to 3 matches
          m.rrRoundNumber === round &&
          !getPlayers(m).includes(commonPlayer)
        );

      if (swapCandidates.length > 0) {
        const swapIdx = swapCandidates[0].idx;
        [result[i + 2], result[swapIdx]] = [result[swapIdx], result[i + 2]];
      }
    }
  }

  return result;
}

/**
 * Parse courts input string (e.g., "2,3,8") to array of court IDs
 */
export function parseCourtsInput(input: string): number[] {
  if (!input || !input.trim()) return [];
  
  const courts = input
    .split(',')
    .map(s => s.trim())
    .filter(s => s !== '')
    .map(s => parseInt(s, 10))
    .filter(n => !isNaN(n) && n > 0);

  // Remove duplicates, maintain order
  return [...new Set(courts)];
}

/**
 * Assign courts to matches: "1 group = 1 home court" is the priority, AND any
 * SPARE courts (more courts than groups) are shared to balance load so none sit
 * idle. A group's matches stay on [its home court + the spare courts], preferring
 * the home court on ties (least-loaded otherwise). Groups with no home court
 * (more groups than courts) balance across every court — same as before.
 *
 * Example — 3 groups, courts [1,2,3,4]: groups get home courts 1,2,3; court 4 is
 * a shared spare, so the round-robin matches spread across all 4 courts instead
 * of leaving court 4 empty.
 */
export interface MatchWithCourt {
  matchIndex: number;
  groupIndex: number;
  courtId: number;
}

export function assignCourtsToMatches<T extends { groupIndex: number }>(
  matches: T[],
  courts: number[],
  numGroups: number
): Map<number, number> {
  if (courts.length === 0) return new Map();

  // 1 group = 1 home court (priority). Courts beyond #groups are shared spares.
  const homeCount = Math.min(numGroups, courts.length);
  const homeCourtByGroup = new Map<number, number>();
  for (let i = 0; i < homeCount; i++) homeCourtByGroup.set(i, courts[i]);
  const spareCourts = courts.slice(homeCount);

  const loadCount = new Map<number, number>();
  courts.forEach(c => loadCount.set(c, 0));
  const result = new Map<number, number>();

  for (let i = 0; i < matches.length; i++) {
    const homeCourt = homeCourtByGroup.get(matches[i].groupIndex);
    // Home court + shared spares (home preferred on ties). No home court (more
    // groups than courts) → balance across all courts.
    const candidates = homeCourt !== undefined ? [homeCourt, ...spareCourts] : courts;
    let best = candidates[0];
    let bestLoad = loadCount.get(best) ?? 0;
    for (const c of candidates) {
      const l = loadCount.get(c) ?? 0;
      if (l < bestLoad) { best = c; bestLoad = l; }
    }
    result.set(i, best);
    loadCount.set(best, bestLoad + 1);
  }

  return result;
}

/**
 * Calculate start times for matches on each court
 * @param matchCourtAssignments Map of matchIndex -> courtId
 * @param startTime Start time in "HH:MM" format
 * @param matchDurationMinutes Duration per match (default 20)
 * @returns Map of matchIndex -> start time string "HH:MM"
 */
export function calculateMatchTimes(
  matchCourtAssignments: Map<number, number>,
  courts: number[],
  startTime: string,
  matchDurationMinutes: number = 20
): Map<number, string> {
  if (!startTime || courts.length === 0) return new Map();

  // Parse start time
  const [startHour, startMinute] = startTime.split(':').map(s => parseInt(s, 10));
  if (isNaN(startHour) || isNaN(startMinute)) return new Map();

  // Track slot index per court
  const courtSlotIndex = new Map<number, number>();
  courts.forEach(c => courtSlotIndex.set(c, 0));

  // Sort match indices to process in order
  const matchIndices = Array.from(matchCourtAssignments.keys()).sort((a, b) => a - b);

  const result = new Map<number, string>();

  for (const matchIdx of matchIndices) {
    const courtId = matchCourtAssignments.get(matchIdx)!;
    const slotIdx = courtSlotIndex.get(courtId) || 0;

    // Calculate time
    const totalMinutes = startHour * 60 + startMinute + slotIdx * matchDurationMinutes;
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

    result.set(matchIdx, timeStr);
    courtSlotIndex.set(courtId, slotIdx + 1);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Pair-aware scheduler
// ---------------------------------------------------------------------------
// The legacy assignCourtsToMatches + calculateMatchTimes pair only knew a
// match's groupIndex, never WHICH players were on court. So two matches sharing
// a player could land on different courts in the same time slot — a pair being
// asked to play on two courts at once (and, in the match list, appearing in a
// long consecutive run). This scheduler is the root-cause fix: it tracks player
// availability per time slot, so a pair never plays twice in one slot. Because
// display_order is then written in (slot, court) play-order and a pair plays at
// most once per slot, a pair can appear in at most 2 consecutive list rows.

export interface SchedulableMatch {
  matchId: string;
  player1: string | null;
  player2: string | null;
  groupIndex: number;
}

export interface ScheduledMatch {
  matchId: string;
  court: number;
  slot: number;
  startAt: string | null;
  displayOrder: number;
}

export function scheduleMatches(
  matches: SchedulableMatch[],
  courts: number[],
  numGroups: number,
  startTime: string | null,
  matchDurationMinutes = 20,
): ScheduledMatch[] {
  if (courts.length === 0 || matches.length === 0) return [];

  // Reconstruct round-robin rounds from the players themselves, so scheduling
  // works regardless of the input order (old data has rr_round_number = NULL and
  // a naive "p0 vs everyone, then p1 vs everyone" order). The circle method puts
  // each team in exactly one match per round; ordering matches by (round, group)
  // means a team's games are spread across rounds, so the greedy below gives each
  // team the most rest the court count allows (1-on-1-off when 1 court per group).
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const playersByGroup = new Map<number, Set<string>>();
  for (const m of matches) {
    const set = playersByGroup.get(m.groupIndex) ?? new Set<string>();
    if (m.player1) set.add(m.player1);
    if (m.player2) set.add(m.player2);
    playersByGroup.set(m.groupIndex, set);
  }
  const roundOf = new Map<string, number>(); // matchId → round number
  for (const [gi, set] of playersByGroup) {
    const circ = generateCircleMethodMatches([...set].sort());
    const byPair = new Map<string, number>();
    for (const c of circ) byPair.set(pairKey(c.player1, c.player2), c.rrRoundNumber);
    for (const m of matches) {
      if (m.groupIndex !== gi || !m.player1 || !m.player2) continue;
      roundOf.set(m.matchId, byPair.get(pairKey(m.player1, m.player2)) ?? 999);
    }
  }
  const roundOrdered = [...matches].sort(
    (a, b) =>
      (roundOf.get(a.matchId) ?? 999) - (roundOf.get(b.matchId) ?? 999) ||
      a.groupIndex - b.groupIndex,
  );

  // 1 group = 1 home court (priority); courts beyond #groups are shared spares.
  const homeCount = Math.min(numGroups, courts.length);
  const homeCourtByGroup = new Map<number, number>();
  for (let i = 0; i < homeCount; i++) homeCourtByGroup.set(i, courts[i]);
  const spareCourts = courts.slice(homeCount);

  const courtSlotBusy = new Set<string>();         // `${court}:${slot}`
  const playerSlots = new Map<string, Set<number>>(); // playerId → slots played
  const load = new Map<number, number>();
  courts.forEach((c) => load.set(c, 0));

  // A pair must not play more than 2 matches back-to-back: placing player p in
  // slot s is forbidden if it would complete a run of 3 consecutive slots.
  const wouldRun3 = (p: string | null, s: number): boolean => {
    if (!p) return false;
    const set = playerSlots.get(p);
    if (!set) return false;
    const h = (x: number) => set.has(x);
    return (h(s - 1) && h(s - 2)) || (h(s - 1) && h(s + 1)) || (h(s + 1) && h(s + 2));
  };
  const slotOk = (court: number, slot: number, p1: string | null, p2: string | null) =>
    !courtSlotBusy.has(`${court}:${slot}`) &&
    !(p1 && playerSlots.get(p1)?.has(slot)) &&   // not double-booked this slot
    !(p2 && playerSlots.get(p2)?.has(slot)) &&
    !wouldRun3(p1, slot) && !wouldRun3(p2, slot); // not a 3rd consecutive match

  const picked = new Map<string, { court: number; slot: number }>();

  for (const m of roundOrdered) {
    const home = homeCourtByGroup.get(m.groupIndex);
    // Home court first, then shared spares (preserves "ưu tiên 1 bảng/sân").
    const candidates = home !== undefined ? [home, ...spareCourts] : courts;

    let best: { court: number; slot: number } | null = null;
    for (const court of candidates) {
      let slot = 0;
      while (!slotOk(court, slot, m.player1, m.player2)) slot++;
      // Prefer earliest slot; tie → least-loaded court; tie → candidate order (home first).
      if (
        best === null ||
        slot < best.slot ||
        (slot === best.slot && (load.get(court) ?? 0) < (load.get(best.court) ?? 0))
      ) {
        best = { court, slot };
      }
    }

    const chosen = best!;
    picked.set(m.matchId, chosen);
    courtSlotBusy.add(`${chosen.court}:${chosen.slot}`);
    for (const p of [m.player1, m.player2]) {
      if (!p) continue;
      const set = playerSlots.get(p) ?? new Set<number>();
      set.add(chosen.slot);
      playerSlots.set(p, set);
    }
    load.set(chosen.court, (load.get(chosen.court) ?? 0) + 1);
  }

  // Parse start time once for slot → clock time.
  let startMins: number | null = null;
  if (startTime) {
    const [h, min] = startTime.split(':').map((s) => parseInt(s, 10));
    if (!isNaN(h) && !isNaN(min)) startMins = h * 60 + min;
  }
  const slotToTime = (slot: number): string | null => {
    if (startMins === null) return null;
    const t = startMins + slot * matchDurationMinutes;
    const hh = Math.floor(t / 60) % 24;
    const mm = t % 60;
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
  };

  // display_order follows play order: by slot, then court.
  const ordered = [...matches].sort((a, b) => {
    const pa = picked.get(a.matchId)!;
    const pb = picked.get(b.matchId)!;
    return pa.slot - pb.slot || pa.court - pb.court;
  });

  const displayOrderByMatch = new Map<string, number>();
  ordered.forEach((m, i) => displayOrderByMatch.set(m.matchId, i));

  return matches.map((m) => {
    const p = picked.get(m.matchId)!;
    return {
      matchId: m.matchId,
      court: p.court,
      slot: p.slot,
      startAt: slotToTime(p.slot),
      displayOrder: displayOrderByMatch.get(m.matchId)!,
    };
  });
}
