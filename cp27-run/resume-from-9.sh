#!/bin/bash
# Resume CP27 from cases 7-8 — the fixture sits in needs_changes exactly as
# that phase requires; everything before it has already passed this run.
cd /Users/cm10/pickle-hub-pro/.claude/worktrees/shop-closed-pilot
LOG=/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/run.log
phase () {
  echo "" | tee -a "$LOG"
  echo "════════ $1 ════════" | tee -a "$LOG"
  node "cp27-run/$2" 2>&1 | tee -a "$LOG"
  local rc=${PIPESTATUS[0]}
  if [ "$rc" -ne 0 ]; then
    echo "PHASE FAILED: $1 (exit $rc)" | tee -a "$LOG"
    return 1
  fi
}
set -o pipefail
# cases 7-8 already green this run
phase "cases 9-11 · approve + profile"  chain-a2.mjs       || exit 1
phase "case 12 · variants"              chain-b1.mjs       || exit 1
phase "case 13 · media with EXIF"       case13-media.mjs   || exit 1
phase "cases 14-17 · publish cycle"     chain-b2.mjs       || exit 1
phase "case 18 · account deletion"      case18-deletion.mjs|| exit 1
phase "section E · responsive + axe"    section-e.mjs      || exit 1
phase "section F · leakage"             section-f.mjs      || exit 1
echo "" | tee -a "$LOG"
echo "ALL PHASES COMPLETED" | tee -a "$LOG"
