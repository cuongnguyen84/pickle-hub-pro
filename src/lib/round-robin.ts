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
