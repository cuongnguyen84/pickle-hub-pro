#!/bin/bash
# Áp 2 migration shop lên PROD + ghi ledger + deploy edge function + verify.
# Chạy: ! bash scripts/apply-shop-activate-and-jpeg-prod.sh
# (Claude bị classifier chặn thao tác prod trong phiên 16/08 — Cuong tự chạy.)
set -euo pipefail

REF="ajvlcamxemgbxduhiqrl"
API="https://api.supabase.com/v1/projects/$REF/database/query"
# Dò token theo thứ tự: env → file CLI cũ → secrets.local.md → keychain
TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
[ -z "$TOKEN" ] && [ -f ~/.supabase/access-token ] && TOKEN="$(cat ~/.supabase/access-token)"
[ -z "$TOKEN" ] && [ -f ~/Downloads/secrets.local.md ] && TOKEN="$(grep -o 'sbp_[A-Za-z0-9]*' ~/Downloads/secrets.local.md | head -1)"
[ -z "$TOKEN" ] && TOKEN="$(security find-generic-password -s 'Supabase CLI' -w 2>/dev/null || true)"
[ -z "$TOKEN" ] && { echo "Không tìm thấy Supabase PAT (sbp_...). Export SUPABASE_ACCESS_TOKEN rồi chạy lại."; exit 1; }
WT="/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-activation-button"

apply() {
  local file="$1"
  echo "=== Áp $file"
  jq -n --rawfile sql "$WT/supabase/migrations/$file" '{"query":$sql}' \
    | curl -sf -X POST "$API" \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" -d @- >/dev/null
  echo "    OK"
}

apply "20260816090000_shop_activate_rpc.sql"
apply "20260816120000_shop_media_jpeg_rendition_fallback.sql"

echo "=== Ghi ledger schema_migrations (KHÔNG mù — 2 file trên vừa áp xong ở đây)"
curl -sf -X POST "$API" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"insert into supabase_migrations.schema_migrations(version, name) values ('\''20260816090000'\'','\''shop_activate_rpc'\''), ('\''20260816120000'\'','\''shop_media_jpeg_rendition_fallback'\'') on conflict do nothing;"}' >/dev/null
echo "    OK"

echo "=== Verify trên prod"
curl -sf -X POST "$API" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select proname from pg_proc where proname = '\''shop_activate'\''; "}'
echo
curl -sf -X POST "$API" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select (public.shop_media_limits())->'\''rendition_content_types'\'' as types;"}'
echo

echo "=== Deploy edge function shop-media-lifecycle"
cd "$WT"
npx supabase functions deploy shop-media-lifecycle --project-ref "$REF"

echo "=== XONG. Kỳ vọng ở trên: 1 dòng shop_activate + types = [\"image/webp\",\"image/jpeg\"] + deploy thành công."
