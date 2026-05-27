// ============================================================================
// matchmaking — Mexicano + Round Robin scheduling for social events
// ----------------------------------------------------------------------------
// Pure TypeScript, no DB persistence. The organizer's roster UI calls these
// functions, displays the result as a table the organizer prints/copies,
// then runs the session manually at the court.
//
// Both formats produce the same Match[] shape so the UI can render either
// without branching. "Sitting out" players (when count isn't divisible by 4)
// are surfaced per round so the organizer knows who rotates next.
//
// Determinism: a `seed` argument can be passed to reproduce a schedule. By
// default we use Date.now()-derived seed.
// ============================================================================

export interface MMPlayer {
  id: string;
  name: string;
  /** Optional rating used to seed Round 1 in Mexicano. */
  level: number | null;
}

export interface MMMatch {
  round: number;
  court: number;
  teamA: [MMPlayer, MMPlayer];
  teamB: [MMPlayer, MMPlayer];
}

export interface MMRound {
  round: number;
  matches: MMMatch[];
  sittingOut: MMPlayer[];
  /** Sprint C3 — combined-DUPR fairness for the round (0..1). Only set
   *  when preferBalanced=true on GenerateOptions AND all matched players
   *  have non-null level. UI uses this to render RoundFairnessCard. */
  fairness?: number;
}

export interface MMSchedule {
  rounds: MMRound[];
  /** Count of distinct players included in the schedule. */
  playerCount: number;
  /** Format the schedule was generated from (for the UI heading). */
  format: "mexicano" | "round_robin";
  /** Sprint C3 — true when balanced pairing was actually applied. False
   *  when caller asked for it but coverage was too low (caller can show
   *  a banner explaining the fallback). */
  balancedPairingApplied?: boolean;
  /** Sprint C3 — fraction of players with a non-null `level`. Drives the
   *  "X/Y have DUPR" banner. */
  duprCoverage?: number;
}

export type Format = "mexicano" | "round_robin";

interface GenerateOptions {
  players: MMPlayer[];
  rounds: number;
  courtCount: number;
  /** Optional deterministic seed (default Date.now()). */
  seed?: number;
  /** Sprint C3 — when true AND ≥75% of players have a non-null level,
   *  pairing tries to minimize |sumA - sumB| in addition to avoiding
   *  partner repeats. Falls through to legacy random pairing on low
   *  coverage. Default false. */
  preferBalanced?: boolean;
}

// ─── PRNG (mulberry32) ───────────────────────────────────────────────────────

function makeRng(seed: number) {
  let s = seed >>> 0;
  return function rand(): number {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── Mexicano ───────────────────────────────────────────────────────────────
//
// Standard Mexicano pattern:
//   Round 1 — seed by level (descending), zigzag pair: 1+4 vs 2+3 on Court 1,
//             5+8 vs 6+7 on Court 2, etc.
//   Round 2+ — rank by points (we treat round-1 finishing order as "points"
//             proxy since we don't persist scores), keep the zigzag.
//
// MVP simplification: we don't actually track points across rounds (no
// persistence). So rounds 2+ re-shuffle the seeding to avoid the same
// partners. This is "Mexicano-lite": better than pure random, lighter
// than full Americano. The organizer can manually re-run the generator
// after each round once they know the scores.
//
// Partner-repeat avoidance: we track partner pairs across rounds and
// retry up to 50 times to find a configuration that minimizes repeats.

function pairAvoidingRepeats(
  seeded: MMPlayer[],
  prevPartners: Set<string>,
  rand: () => number,
  options?: { preferBalanced?: boolean },
): { teams: [MMPlayer, MMPlayer][]; repeats: number; totalDiff: number } {
  const teams: [MMPlayer, MMPlayer][] = [];
  let repeats = 0;
  let totalDiff = 0;
  const preferBalanced = !!options?.preferBalanced;

  // Walk in groups of 4: zigzag pair = (0,3) and (1,2).
  for (let i = 0; i < seeded.length; i += 4) {
    const group = seeded.slice(i, i + 4);
    if (group.length < 4) break; // sitting out
    const candidates: Array<[MMPlayer, MMPlayer]>[] = [
      [
        [group[0], group[3]],
        [group[1], group[2]],
      ],
      [
        [group[0], group[2]],
        [group[1], group[3]],
      ],
      [
        [group[0], group[1]],
        [group[2], group[3]],
      ],
    ];
    // Try each pairing in shuffled order. Score = repeats * BIG + diff
    // (when preferBalanced) so we always pick the lowest-repeat option
    // first, breaking ties on combined-DUPR balance. Otherwise legacy
    // behavior (repeats only).
    const shuffled = shuffle(candidates, rand);
    let best: {
      pair: Array<[MMPlayer, MMPlayer]>;
      r: number;
      diff: number;
      score: number;
    } | null = null;
    for (const opt of shuffled) {
      const r = opt.reduce((acc, [p1, p2]) => {
        const k = partnerKey(p1.id, p2.id);
        return acc + (prevPartners.has(k) ? 1 : 0);
      }, 0);
      const sumA = (opt[0][0].level ?? 0) + (opt[0][1].level ?? 0);
      const sumB = (opt[1][0].level ?? 0) + (opt[1][1].level ?? 0);
      const diff = Math.abs(sumA - sumB);
      // BIG = 100 ensures repeats always dominate score, but diff
      // breaks ties when two options have equal repeat count.
      const score = preferBalanced ? r * 100 + diff : r;
      if (best == null || score < best.score) {
        best = { pair: opt, r, diff, score };
      }
      if (!preferBalanced && r === 0) break;
    }
    if (!best) continue;
    teams.push(best.pair[0]);
    teams.push(best.pair[1]);
    repeats += best.r;
    totalDiff += best.diff;
  }
  return { teams, repeats, totalDiff };
}

function partnerKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function generateMexicano(opts: GenerateOptions): MMSchedule {
  const { players, rounds, courtCount } = opts;
  const seed = opts.seed ?? Date.now();
  if (players.length < 4) {
    return { rounds: [], playerCount: players.length, format: "mexicano" };
  }

  // Sprint C3 — coverage gate for balanced pairing. We want ≥75% of
  // players to have a real DUPR/level value before we let it influence
  // pairing; otherwise we'd just be pretending nulls = 0 and skewing.
  const withLevel = players.filter((p) => p.level != null).length;
  const duprCoverage = players.length > 0 ? withLevel / players.length : 0;
  const useBalanced = !!opts.preferBalanced && duprCoverage >= 0.75;

  // Seed Round 1 by descending level (nulls last).
  const seeded = players.slice().sort((a, b) => {
    const la = a.level ?? -Infinity;
    const lb = b.level ?? -Infinity;
    if (la !== lb) return lb - la;
    return a.name.localeCompare(b.name);
  });

  const out: MMRound[] = [];
  const partnerHistory = new Set<string>();
  const rng = makeRng(seed);

  for (let r = 1; r <= rounds; r++) {
    // For round 2+ shuffle so the zigzag pattern produces fresh partners
    // (we don't have points to re-seed by).
    const roster = r === 1 ? seeded : shuffle(seeded, rng);
    let best: { teams: [MMPlayer, MMPlayer][]; repeats: number; totalDiff: number } | null = null;
    // Try a few permutations to minimize repeats.
    const attempts = r === 1 ? 1 : 30;
    for (let i = 0; i < attempts; i++) {
      const trial = i === 0 ? roster : shuffle(roster, rng);
      const candidate = pairAvoidingRepeats(trial, partnerHistory, rng, {
        preferBalanced: useBalanced,
      });
      if (best == null || candidate.repeats < best.repeats) best = candidate;
      else if (
        useBalanced &&
        best != null &&
        candidate.repeats === best.repeats &&
        candidate.totalDiff < best.totalDiff
      ) {
        // Tie on repeats — break by balance.
        best = candidate;
      }
      if (!useBalanced && best.repeats === 0) break;
    }
    if (!best) {
      out.push({ round: r, matches: [], sittingOut: [] });
      continue;
    }

    // teams[] is alternating: index 0,2,4… = teamA; 1,3,5… = teamB. Pair
    // them into matches; assign courts in rotation.
    const matches: MMMatch[] = [];
    for (let i = 0; i < best.teams.length; i += 2) {
      const courtIdx = i / 2;
      if (courtIdx >= courtCount) break;
      matches.push({
        round: r,
        court: courtIdx + 1,
        teamA: best.teams[i],
        teamB: best.teams[i + 1],
      });
    }
    // Codex Bug 5 (PR #44): partner history must be recorded from the
    // FINALIZED matches (after the courtCount cap), not from best.teams.
    // pairAvoidingRepeats returns one pair per 4 seeded players; when
    // players > courtCount * 4 the extra pairs never play yet were being
    // marked as prior partners, skewing the next round's matchmaking
    // toward repeated pairings for clubs with few courts.
    for (const m of matches) {
      partnerHistory.add(partnerKey(m.teamA[0].id, m.teamA[1].id));
      partnerHistory.add(partnerKey(m.teamB[0].id, m.teamB[1].id));
    }
    const usedIds = new Set(matches.flatMap((m) => [
      m.teamA[0].id,
      m.teamA[1].id,
      m.teamB[0].id,
      m.teamB[1].id,
    ]));
    const sittingOut = roster.filter((p) => !usedIds.has(p.id));

    // Sprint C3 — compute per-round fairness when balanced pairing applied.
    let fairness: number | undefined = undefined;
    if (useBalanced && matches.length > 0) {
      const diffs = matches.map((m) => {
        const sumA = (m.teamA[0].level ?? 0) + (m.teamA[1].level ?? 0);
        const sumB = (m.teamB[0].level ?? 0) + (m.teamB[1].level ?? 0);
        return Math.abs(sumA - sumB);
      });
      const avgDiff = diffs.reduce((s, d) => s + d, 0) / diffs.length;
      fairness = Math.max(0, 1 - avgDiff / 2);
    }
    out.push({ round: r, matches, sittingOut, fairness });
  }
  return {
    rounds: out,
    playerCount: players.length,
    format: "mexicano",
    balancedPairingApplied: useBalanced,
    duprCoverage,
  };
}

// ─── Round Robin ────────────────────────────────────────────────────────────
//
// Classic 4-player rotation: with N players we generate enough rounds so
// every player partners with every other player at least once. The
// canonical approach: pair-rotation across N choose 2 / 2 rounds. For
// social-event use we cap at `rounds` (organizer-chosen).
//
// Algorithm: greedy partner assignment. Each round, walk players in
// shuffled order and pick the partner with the fewest prior matches
// together; the remaining two form Team B, court assigned round-robin.

interface RRMatchUpHistory {
  /** Count of times A & B have been partners. */
  partner: Map<string, number>;
  /** Count of times A & B have been on opposing teams. */
  opponent: Map<string, number>;
}

function bumpCount(map: Map<string, number>, a: string, b: string) {
  const k = partnerKey(a, b);
  map.set(k, (map.get(k) ?? 0) + 1);
}

function getCount(map: Map<string, number>, a: string, b: string): number {
  return map.get(partnerKey(a, b)) ?? 0;
}

export function generateRoundRobin(opts: GenerateOptions): MMSchedule {
  const { players, rounds, courtCount } = opts;
  const seed = opts.seed ?? Date.now();
  if (players.length < 4) {
    return { rounds: [], playerCount: players.length, format: "round_robin" };
  }

  const rng = makeRng(seed);
  const hist: RRMatchUpHistory = { partner: new Map(), opponent: new Map() };
  const out: MMRound[] = [];

  for (let r = 1; r <= rounds; r++) {
    const matches: MMMatch[] = [];
    const remaining = shuffle(players, rng);
    const sittingOut: MMPlayer[] = [];
    let courtIdx = 0;

    while (remaining.length >= 4 && courtIdx < courtCount) {
      // Take the first remaining player; pick their partner = the one
      // they've partnered with the fewest times (ties broken randomly
      // via the shuffle order).
      const p1 = remaining.shift()!;
      let bestIdx = 0;
      let bestScore = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const score = getCount(hist.partner, p1.id, remaining[i].id);
        if (score < bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      const p2 = remaining.splice(bestIdx, 1)[0];

      // Team B = first 2 of remaining whose opponent score with both p1
      // and p2 is lowest. Greedy: pick p3, then p4.
      let p3Idx = 0;
      let p3Score = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const s = getCount(hist.opponent, p1.id, remaining[i].id) +
          getCount(hist.opponent, p2.id, remaining[i].id);
        if (s < p3Score) {
          p3Score = s;
          p3Idx = i;
        }
      }
      const p3 = remaining.splice(p3Idx, 1)[0];

      let p4Idx = 0;
      let p4Score = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const s = getCount(hist.opponent, p1.id, remaining[i].id) +
          getCount(hist.opponent, p2.id, remaining[i].id) +
          getCount(hist.partner, p3.id, remaining[i].id);
        if (s < p4Score) {
          p4Score = s;
          p4Idx = i;
        }
      }
      const p4 = remaining.splice(p4Idx, 1)[0];

      matches.push({
        round: r,
        court: courtIdx + 1,
        teamA: [p1, p2],
        teamB: [p3, p4],
      });

      bumpCount(hist.partner, p1.id, p2.id);
      bumpCount(hist.partner, p3.id, p4.id);
      bumpCount(hist.opponent, p1.id, p3.id);
      bumpCount(hist.opponent, p1.id, p4.id);
      bumpCount(hist.opponent, p2.id, p3.id);
      bumpCount(hist.opponent, p2.id, p4.id);

      courtIdx++;
    }
    sittingOut.push(...remaining);
    out.push({ round: r, matches, sittingOut });
  }
  return { rounds: out, playerCount: players.length, format: "round_robin" };
}

// ─── Convenience ────────────────────────────────────────────────────────────

export function generate(format: Format, opts: GenerateOptions): MMSchedule {
  return format === "mexicano"
    ? generateMexicano(opts)
    : generateRoundRobin(opts);
}

/**
 * Turn a schedule into a plain-text block the organizer can copy/paste
 * into Zalo or print.
 */
export function scheduleToText(schedule: MMSchedule, lang: "vi" | "en"): string {
  const lines: string[] = [];
  for (const r of schedule.rounds) {
    lines.push(lang === "vi" ? `Vòng ${r.round}` : `Round ${r.round}`);
    if (r.matches.length === 0) {
      lines.push(lang === "vi" ? "  (chưa có trận)" : "  (no matches)");
    }
    for (const m of r.matches) {
      const a = `${m.teamA[0].name} & ${m.teamA[1].name}`;
      const b = `${m.teamB[0].name} & ${m.teamB[1].name}`;
      const court = lang === "vi" ? `Sân ${m.court}` : `Court ${m.court}`;
      lines.push(`  ${court}: ${a}  vs  ${b}`);
    }
    if (r.sittingOut.length > 0) {
      const label = lang === "vi" ? "Ngồi ngoài" : "Sitting out";
      lines.push(`  ${label}: ${r.sittingOut.map((p) => p.name).join(", ")}`);
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
