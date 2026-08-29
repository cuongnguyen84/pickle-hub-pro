#!/bin/bash
# Vòng 5 shop-ui-polish: áp migration profile-media-publish lên PROD + ghi ledger
# + deploy edge fn shop-media-lifecycle (PHẢI cùng đợt) + verify.
# Chạy: ! bash /Users/cm10/pickle-hub-pro/scripts/apply-shop-profile-media-prod.sh
set -euo pipefail

REF="ajvlcamxemgbxduhiqrl"
API="https://api.supabase.com/v1/projects/$REF/database/query"
WT="/Users/cm10/pickle-hub-pro/.claude/worktrees/shop-ui-polish"

TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
[ -z "$TOKEN" ] && [ -f ~/.supabase/access-token ] && TOKEN="$(cat ~/.supabase/access-token)"
[ -z "$TOKEN" ] && [ -f ~/Downloads/secrets.local.md ] && TOKEN="$(grep -o 'sbp_[A-Za-z0-9]*' ~/Downloads/secrets.local.md | head -1)"
[ -z "$TOKEN" ] && { echo "Không tìm thấy Supabase PAT."; exit 1; }

echo "=== Áp migration 20260817090000_shop_profile_media_publish.sql"
jq -n --rawfile sql "$WT/supabase/migrations/20260817090000_shop_profile_media_publish.sql" '{"query":$sql}' \
  | curl -sf -X POST "$API" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @- >/dev/null
echo "    OK"

echo "=== Ghi ledger (vừa áp xong ở trên, không mù)"
curl -sf -X POST "$API" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"insert into supabase_migrations.schema_migrations(version, name) values ('\''20260817090000'\'','\''shop_profile_media_publish'\'') on conflict do nothing;"}' >/dev/null
echo "    OK"

echo "=== Verify RPC prod"
curl -sf -X POST "$API" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select proname from pg_proc where proname in ('\''shop_profile_media_publish_prepare'\'','\''shop_profile_media_publish_commit'\'') order by proname;"}'
echo

echo "=== Deploy edge fn shop-media-lifecycle (bắt buộc cùng đợt)"
cd "$WT"
npx supabase functions deploy shop-media-lifecycle --project-ref "$REF"

echo "=== XONG. Kỳ vọng: 2 dòng proname + deploy thành công."
