#!/bin/bash
cd /Users/cm10/pickle-hub-pro/.claude/worktrees/shop-closed-pilot
LOG=/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/run.log
phase () {
  echo "" | tee -a "$LOG"; echo "════════ $1 ════════" | tee -a "$LOG"
  node "cp27-run/$2" 2>&1 | tee -a "$LOG"
  local rc=${PIPESTATUS[0]}
  [ "$rc" -ne 0 ] && { echo "PHASE FAILED: $1 (exit $rc)" | tee -a "$LOG"; return 1; }
}
set -o pipefail
phase "case 17e · finish the verdict"      finish-17e.mjs     || exit 1
phase "case 18 · account deletion"         case18-deletion.mjs|| exit 1
phase "section E · responsive + axe"       section-e.mjs      || exit 1
phase "section F · leakage"                section-f.mjs      || exit 1
echo "" | tee -a "$LOG"; echo "ALL PHASES COMPLETED" | tee -a "$LOG"
