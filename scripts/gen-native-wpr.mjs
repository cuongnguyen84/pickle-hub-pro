#!/usr/bin/env node
// ============================================================================
// Regenerate apple/ThePickleHub/Resources/wpr-rankings.json from the web
// editorial snapshot src/content/ppa-rankings.ts (single source of truth).
// ----------------------------------------------------------------------------
// The native Rankings screen shows the same PPA Tour WPR excerpt as
// /rankings/ppa-tour (top 25 per board + Vietnam / Viet-origin highlights).
// Run after every WPR refresh:  node scripts/gen-native-wpr.mjs
// Guard: src/content/__tests__/ppa-rankings-native-sync.test.ts fails when the
// JSON drifts from the TS constants.
// ============================================================================
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = await import(path.join(root, "src/content/ppa-rankings.ts"));

export function buildNativeWpr(m) {
  const entry = (p) => ({
    rank: p.rank, name: p.name, points: p.points, eventsPlayed: p.eventsPlayed,
    country: p.country, countryCode: p.countryCode, ...(p.isTied ? { isTied: true } : {}),
  });
  return {
    fetchedAt: m.PPA_WPR_FETCHED_AT,
    sourceUrl: m.PPA_WPR_SOURCE_URL,
    men: m.PPA_WPR_MEN.map(entry),
    women: m.PPA_WPR_WOMEN.map(entry),
    vietHighlights: m.PPA_WPR_VIET_HIGHLIGHTS.map((h) => ({
      board: h.board, rank: h.rank, name: h.name, countryCode: h.countryCode, points: h.points,
    })),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const out = path.join(root, "apple/ThePickleHub/Resources/wpr-rankings.json");
  writeFileSync(out, JSON.stringify(buildNativeWpr(src), null, 2) + "\n");
  console.log(`wrote ${path.relative(root, out)}`);
}
