#!/bin/bash
# Đẩy hộ logo + cover của shop ThePickleHub lên public (bước publish bị kẹt trên UI).
# Chạy: ! bash /Users/cm10/pickle-hub-pro/scripts/publish-shop-profile-media-manually.sh
set -euo pipefail

REF="ajvlcamxemgbxduhiqrl"
BASE="https://$REF.supabase.co"
API="https://api.supabase.com/v1/projects/$REF/database/query"

PAT="$(grep -o 'sbp_[A-Za-z0-9]*' ~/Downloads/secrets.local.md | head -1)"
# Service role key: JWT có claim service_role trong secrets.local.md
SK=""
for k in $(grep -o 'eyJ[A-Za-z0-9_.-]\{60,\}' ~/Downloads/secrets.local.md); do
  if echo "$k" | cut -d. -f2 | base64 -d 2>/dev/null | grep -q '"role":"service_role"'; then SK="$k"; break; fi
done
[ -z "$SK" ] && { echo "Không tìm thấy service_role key trong secrets.local.md"; exit 1; }

LOGO="dab96b89-cb92-4491-8a24-5e0783bdbf59/profile/logo/f27066a6-4a16-46ff-9ce2-5d17286e50f4/v1"
COVER="dab96b89-cb92-4491-8a24-5e0783bdbf59/profile/cover/eda3a2a7-774c-40ae-bc6b-119d193d0ddc/v1"
LOGO_ID="f27066a6-4a16-46ff-9ce2-5d17286e50f4"
COVER_ID="eda3a2a7-774c-40ae-bc6b-119d193d0ddc"

copy() {
  echo "=== Copy $1/rendition.webp -> public $1/live.webp"
  curl -s -X POST "$BASE/storage/v1/object/copy" \
    -H "Authorization: Bearer $SK" -H "apikey: $SK" -H "Content-Type: application/json" \
    -d "{\"bucketId\":\"shop-product-media-draft\",\"sourceKey\":\"$1/rendition.webp\",\"destinationBucket\":\"shop-product-media\",\"destinationKey\":\"$1/live.webp\"}"
  echo
}
copy "$LOGO"
copy "$COVER"

echo "=== Commit 2 media row"
curl -sf -X POST "$API" -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  -d "{\"query\":\"select public.shop_profile_media_publish_commit('$LOGO_ID'::uuid, '$LOGO/live.webp'); select public.shop_profile_media_publish_commit('$COVER_ID'::uuid, '$COVER/live.webp');\"}"
echo

echo "=== Verify: RPC public + URL ảnh"
curl -sf -X POST "$API" -H "Authorization: Bearer $PAT" -H "Content-Type: application/json" \
  -d '{"query":"select purpose, public_path from shop_profile_media order by purpose;"}'
echo
curl -s -o /dev/null -w "logo url -> HTTP %{http_code}\n"  "$BASE/storage/v1/object/public/shop-product-media/$LOGO/live.webp"
curl -s -o /dev/null -w "cover url -> HTTP %{http_code}\n" "$BASE/storage/v1/object/public/shop-product-media/$COVER/live.webp"
echo "=== XONG. Kỳ vọng: 2 dòng public_path .../live.webp + 2 URL HTTP 200."
