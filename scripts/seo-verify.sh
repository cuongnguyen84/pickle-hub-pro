#!/usr/bin/env bash
# ============================================================================
# Sprint 4 Phase 4D — SEO regression verification
# ============================================================================
# Crawls a list of routes with a Googlebot UA + cache-bypass header and
# verifies the prerendered HTML contains the expected SEO surface:
#   - <link rel="canonical">
#   - <link rel="alternate" hreflang=...>
#   - <script type="application/ld+json"> with valid JSON
#
# CLAUDE.md verification rules:
#   ✅ curl with Googlebot User-Agent
#   ✅ Google Rich Results Test (manual follow-up)
#   ❌ DO NOT use Search Console URL Inspection Live Test (false negatives)
#
# Usage:
#   ./scripts/seo-verify.sh                       # default: prod
#   BASE_URL=https://feat-foo.pickle-hub-pro.pages.dev ./scripts/seo-verify.sh
#   PROFILE_USERNAME=tran-thi-b MATCH_SLUG=abc-123 ./scripts/seo-verify.sh
#
# Exit code:
#   0  all checks passed
#   1  at least one check failed (CI-friendly)
# ============================================================================

set -u

BASE_URL="${BASE_URL:-https://www.thepicklehub.net}"
GOOGLEBOT_UA="Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"

# Sample slugs / usernames are configurable so the script doesn't break when
# a particular fixture is deleted. Override via env.
PROFILE_USERNAME="${PROFILE_USERNAME:-tran-thi-b}"
MATCH_SLUG="${MATCH_SLUG:-}"

ROUTES=(
  "/"
  "/feed"
  "/vi/feed"
  "/feed?tab=trending"
  "/nguoi-choi/${PROFILE_USERNAME}"
)
[[ -n "$MATCH_SLUG" ]] && ROUTES+=("/tran-dau/${MATCH_SLUG}")

# ─── Output helpers ─────────────────────────────────────────────────────
GREEN=$'\033[0;32m'
RED=$'\033[0;31m'
YELLOW=$'\033[0;33m'
NC=$'\033[0m'

PASS_COUNT=0
FAIL_COUNT=0

pass() { echo "  ${GREEN}✓${NC} $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
fail() { echo "  ${RED}✗${NC} $1"; FAIL_COUNT=$((FAIL_COUNT + 1)); }
warn() { echo "  ${YELLOW}!${NC} $1"; }

# ─── Per-route checks ───────────────────────────────────────────────────
check_route() {
  local route="$1"
  local url="${BASE_URL}${route}"
  echo ""
  echo "═══ ${url}"

  local response
  response=$(curl -sL \
    -A "$GOOGLEBOT_UA" \
    -H "Cache-Control: no-cache" \
    -H "Accept: text/html" \
    --max-time 15 \
    "$url")

  if [[ -z "$response" ]]; then
    fail "Empty response (network or CF edge issue)"
    return
  fi

  # ─── canonical ──────────────────────────────────────────────
  if echo "$response" | grep -qE '<link[^>]+rel="canonical"'; then
    pass "Canonical link present"
  else
    fail "Canonical link missing"
  fi

  # ─── hreflang (at least one) ───────────────────────────────
  if echo "$response" | grep -qE 'hreflang="(vi|en|x-default)"'; then
    pass "hreflang link(s) present"
  else
    # Static pages without VI variant are exempt — flag as warn not fail.
    warn "hreflang missing (acceptable for EN-only pages)"
  fi

  # ─── JSON-LD presence + parse ──────────────────────────────
  local jsonld
  jsonld=$(echo "$response" \
    | tr '\n' ' ' \
    | grep -oE '<script type="application/ld\+json">[^<]+</script>' \
    | head -1 \
    | sed -E 's|<script type="application/ld\+json">||;s|</script>||')

  if [[ -z "$jsonld" ]]; then
    fail "JSON-LD missing"
  else
    pass "JSON-LD present ($(echo "$jsonld" | wc -c | tr -d ' ') bytes)"
    # Decode the same JS escape sequences escapeJsonLd() emits, then jq.
    local decoded
    decoded=$(printf '%b' "${jsonld//\\u/\\u}")
    if echo "$decoded" | jq -e . >/dev/null 2>&1; then
      pass "JSON-LD parses as valid JSON"
      # Spot-check: surface @type for visual scan
      local types
      types=$(echo "$decoded" | jq -r '..|.["@type"]?|select(.!=null)' 2>/dev/null | sort -u | tr '\n' ',' | sed 's/,$//')
      [[ -n "$types" ]] && echo "      @type(s): ${types}"
    else
      fail "JSON-LD does NOT parse"
    fi
  fi

  # ─── og:title / og:description ──────────────────────────────
  if echo "$response" | grep -qE '<meta[^>]+property="og:title"'; then
    pass "og:title present"
  else
    fail "og:title missing"
  fi

  # ─── Cache hint header (visible in -I but cheap to skip; just log)
}

# ─── Run ─────────────────────────────────────────────────────────────────
echo "Verifying SEO surface on: ${BASE_URL}"
echo "Routes: ${#ROUTES[@]}"

for route in "${ROUTES[@]}"; do
  check_route "$route"
done

echo ""
echo "════════════════════════════════════════"
echo "  Pass: ${GREEN}${PASS_COUNT}${NC}    Fail: ${RED}${FAIL_COUNT}${NC}"
echo "════════════════════════════════════════"

if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
fi
exit 0
