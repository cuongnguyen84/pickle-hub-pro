#!/usr/bin/env bash
# ============================================================================
# telegram-notify.sh — the one way a GitHub workflow messages Cuong (2026-10-20)
# ----------------------------------------------------------------------------
# Usage: scripts/ci/telegram-notify.sh <mode> <text>
#   always         send every time (deploy-guard: each failed deploy matters)
#   first-failure  send only when the previous completed run of this workflow
#                  on the same branch did NOT fail (one message per red streak)
#   recovered      send only when the previous completed run DID fail
#                  (one "green again" message per streak)
# Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID (missing => skip, exit 0),
#      GH_TOKEN (actions: read) for the streak modes,
#      NOTIFY_EVENT (optional) to compare only runs of the same event, e.g. push.
# Every message starts with "[Grok Bot]". Plain text, no parse_mode, so commit
# titles and URLs cannot break Markdown. Never fails the calling job.
# ============================================================================
set -uo pipefail

MODE="${1:?mode}"
TEXT="${2:?text}"

if [ -z "${TELEGRAM_BOT_TOKEN:-}" ] || [ -z "${TELEGRAM_CHAT_ID:-}" ]; then
  echo "Telegram secrets missing — skipping"; exit 0
fi

previous_conclusion() {
  local wid branch query
  wid=$(gh api "repos/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}" -q .workflow_id 2>/dev/null) || return 1
  branch="${GITHUB_REF_NAME:-main}"
  query="branch=${branch}&status=completed&per_page=10"
  if [ -n "${NOTIFY_EVENT:-}" ]; then query="${query}&event=${NOTIFY_EVENT}"; fi
  gh api "repos/${GITHUB_REPOSITORY}/actions/workflows/${wid}/runs?${query}" \
    -q "[.workflow_runs[] | select(.id != ${GITHUB_RUN_ID}) | select(.conclusion != \"cancelled\" and .conclusion != \"skipped\") | .conclusion][0] // \"none\"" 2>/dev/null
}

case "$MODE" in
  always) ;;
  first-failure|recovered)
    PREV=$(previous_conclusion) || PREV="unknown"
    echo "previous completed run: ${PREV:-unknown}"
    if [ "$MODE" = "first-failure" ] && [ "$PREV" = "failure" ]; then
      echo "still red since an earlier run — already reported"; exit 0
    fi
    if [ "$MODE" = "recovered" ] && [ "$PREV" != "failure" ]; then
      echo "previous run was not red — nothing to report"; exit 0
    fi
    ;;
  *) echo "unknown mode: $MODE"; exit 0 ;;
esac

case "$TEXT" in
  "[Grok Bot]"*) ;;
  *) if [ "$MODE" = "recovered" ]; then TEXT="[Grok Bot] ✅ ${TEXT}"; else TEXT="[Grok Bot] 🔴 ${TEXT}"; fi ;;
esac

curl -s -o /dev/null -w "telegram http %{http_code}\n" -X POST \
  "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
  --data-urlencode "text=${TEXT}" \
  -d "disable_web_page_preview=true" || true
exit 0
