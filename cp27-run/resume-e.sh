#!/bin/bash
cd /Users/cm10/pickle-hub-pro/.claude/worktrees/shop-closed-pilot
LOG=/Users/cm10/.claude/jobs/708b78c5/tmp/cp27/run.log
phase () {
  echo "" | tee -a "$LOG"; echo "════════ $1 ════════" | tee -a "$LOG"
  node "cp27-run/$2" 2>&1 | tee -a "$LOG"
  local rc=${PIPESTATUS[0]}
  if [ "$rc" -ne 0 ]; then
    echo "PHASE FAILED: $1 (exit $rc)" | tee -a "$LOG"
    return 1
  fi
  return 0
}
set -o pipefail
phase "section E · responsive + axe"       section-e.mjs      || exit 1
phase "section F · leakage"                section-f.mjs      || exit 1
echo "" | tee -a "$LOG"; echo "ALL PHASES COMPLETED" | tee -a "$LOG"
