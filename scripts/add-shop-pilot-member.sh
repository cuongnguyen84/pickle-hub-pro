#!/bin/bash
# Thêm 1 user vào pilot allowlist Shop trên PROD theo email.
# Dùng: bash scripts/add-shop-pilot-member.sh <email> ["ghi chú"]
set -euo pipefail
EMAIL="${1:?Thiếu email. Dùng: bash $0 <email> [note]}"
NOTE="${2:-Wave 1}"

REF="ajvlcamxemgbxduhiqrl"
API="https://api.supabase.com/v1/projects/$REF/database/query"
TOKEN="${SUPABASE_ACCESS_TOKEN:-}"
[ -z "$TOKEN" ] && [ -f ~/Downloads/secrets.local.md ] && TOKEN="$(grep -o 'sbp_[A-Za-z0-9]*' ~/Downloads/secrets.local.md | head -1)"
[ -z "$TOKEN" ] && { echo "Không tìm thấy Supabase PAT."; exit 1; }

SQL="
WITH u AS (SELECT id FROM auth.users WHERE lower(email) = lower('$EMAIL'))
INSERT INTO public.shop_pilot_members (user_id, note)
SELECT id, '$NOTE' FROM u
ON CONFLICT (user_id) DO NOTHING
RETURNING user_id;
"
RES=$(jq -n --arg q "$SQL" '{"query":$q}' | curl -sf -X POST "$API" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @-)
echo "Insert: $RES"

jq -n --arg q "SELECT m.user_id, u.email, m.note, m.added_at FROM public.shop_pilot_members m JOIN auth.users u ON u.id = m.user_id;" '{"query":$q}' \
  | curl -sf -X POST "$API" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d @-
echo
echo "Nếu Insert: [] mà danh sách trên không có email này → email chưa tồn tại trong auth.users (gõ sai hoặc user chưa đăng ký tài khoản)."
