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

  # ─── og:image (ai-seo review 2026-07-07) ────────────────────
  if echo "$response" | grep -qE '<meta[^>]+property="og:image"'; then
    pass "og:image present"
  else
    fail "og:image missing"
  fi

  # ─── meta description (ai-seo review 2026-07-07) ────────────
  if echo "$response" | grep -qE '<meta[^>]+name="description"[^>]+content="[^"]+"|<meta[^>]+content="[^"]+"[^>]+name="description"'; then
    pass "meta description present"
  else
    fail "meta description missing"
  fi

  # ─── accidental noindex on public route (ai-seo review) ─────
  if echo "$response" | grep -qiE '<meta[^>]+name="robots"[^>]+content="[^"]*noindex'; then
    fail "noindex meta found on PUBLIC route (should never happen)"
  else
    pass "no accidental noindex"
  fi

  # ─── Cache hint header (visible in -I but cheap to skip; just log)
}

# ─── VI-blog hreflang alternates (Guard-0) ──────────────────────────────
# The 5th blog sync leg lives in Supabase (vi_blog_posts.alternate_en_slug) and
# CI can't check it statically. When S1 consolidation 301s an EN post that a VI
# twin still points at, the twin's <link rel="alternate" hreflang="en"> targets
# a redirecting URL → orphaned hreflang, Google drops the cluster. sitemap-blog
# already emits every VI twin's EN-alternate href; assert each resolves 200 (not
# 301/404) over HTTP — no DB client, no CI secret, checks what Google sees.
check_vi_blog_alternates() {
  echo ""
  echo "═══ VI-blog EN alternates (must be 200, not 301/404)"
  local sitemap
  sitemap=$(curl -sL -A "$GOOGLEBOT_UA" -H "Cache-Control: no-cache" --max-time 20 "${BASE_URL}/sitemap-blog.xml")
  if [[ -z "$sitemap" ]]; then
    fail "sitemap-blog.xml empty (network or CF edge issue)"
    return
  fi
  local en_urls
  en_urls=$(echo "$sitemap" \
    | grep -oE 'hreflang="en" href="[^"]+/blog/[^"]+"' \
    | sed -E 's/.*href="([^"]+)".*/\1/' \
    | sort -u)
  if [[ -z "$en_urls" ]]; then
    warn "no EN alternates found in sitemap-blog.xml (unexpected)"
    return
  fi
  local total=0 bad=0
  while IFS= read -r en; do
    [[ -z "$en" ]] && continue
    total=$((total + 1))
    local code
    code=$(curl -s -o /dev/null -w '%{http_code}' -A "$GOOGLEBOT_UA" -H "Cache-Control: no-cache" --max-time 15 "$en")
    if [[ "$code" != "200" ]]; then
      fail "orphaned hreflang: VI twin's EN alternate ${en} → ${code} (expected 200)"
      bad=$((bad + 1))
    fi
  done <<< "$en_urls"
  [[ $bad -eq 0 ]] && pass "all ${total} VI-blog EN alternates resolve 200"
}

# ─── Run ─────────────────────────────────────────────────────────────────
echo "Verifying SEO surface on: ${BASE_URL}"
echo "Routes: ${#ROUTES[@]}"

for route in "${ROUTES[@]}"; do
  check_route "$route"
done

check_vi_blog_alternates

echo ""
echo "════════════════════════════════════════"
echo "  Pass: ${GREEN}${PASS_COUNT}${NC}    Fail: ${RED}${FAIL_COUNT}${NC}"
echo "════════════════════════════════════════"

if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
fi
exit 0
