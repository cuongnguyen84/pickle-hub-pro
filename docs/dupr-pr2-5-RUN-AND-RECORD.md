# DUPR PR2-5 — one-shot run + record guide

> 1 trang duy nhất. Anh chạy mỗi lệnh 1 lần theo thứ tự, sau đó record 5 video.
> Chi tiết hơn ở `docs/dupr-pr2-5-deploy-and-test.md`.

---

## PHẦN A — DEPLOY (≈ 10 phút)

### A.1 Export env vars 1 lần

```bash
cd /Users/cuongmit/pickle-hub-pro

# Lấy token thật từ .claude/secrets.local.md (gitignored).
export SUPABASE_ACCESS_TOKEN=<sbp_...>          # Supabase Personal Access Token
export PROJECT_REF=ajvlcamxemgbxduhiqrl         # not secret
export GITHUB_PAT=<ghp_...>                     # GitHub classic PAT, scope=repo
```

### A.2 Apply 2 migrations qua SQL Editor

Mở `https://supabase.com/dashboard/project/ajvlcamxemgbxduhiqrl/sql/new`, paste lần lượt từng file dưới đây và run:

1. `supabase/migrations/20260520010000_dupr_pr4_matches_sync_columns.sql`
2. `supabase/migrations/20260520020000_dupr_pr5_organizations_club_link.sql`

Sau khi mỗi file chạy xong, copy verification block ở cuối file (đã comment sẵn) và run để xác nhận. Đợi `Success. No rows returned`.

### A.3 Deploy 9 edge function

```bash
for fn in \
  dupr-entitlements \
  dupr-refresh-user-token \
  dupr-webhook \
  dupr-webhook-register \
  dupr-webhook-test-fire \
  dupr-match-submit \
  dupr-clubs \
  dupr-org-link-club \
  dupr-org-unlink-club ; do
  echo "=== Deploying $fn ==="
  npx supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --no-verify-jwt
done
```

Xác nhận:
```bash
npx supabase functions list --project-ref "$PROJECT_REF" | grep -E 'dupr-' | wc -l
# Expected: ít nhất 13 (PR1 sẵn có 3 + PR2-5 mới 9 + dupr-link/dupr-sync legacy)
```

### A.4 Push branch + mở PR

```bash
git checkout -b feat/dupr-raas-pr2-5

git add docs/dupr-pr2-5-audit.md \
        docs/dupr-pr2-5-deploy-and-test.md \
        docs/dupr-pr2-5-RUN-AND-RECORD.md \
        supabase/migrations/20260520010000_dupr_pr4_matches_sync_columns.sql \
        supabase/migrations/20260520020000_dupr_pr5_organizations_club_link.sql \
        supabase/functions/dupr-refresh-user-token/index.ts \
        supabase/functions/dupr-webhook-test-fire/index.ts \
        supabase/functions/dupr-org-link-club/index.ts \
        supabase/functions/dupr-org-unlink-club/index.ts \
        supabase/functions/dupr-match-submit/index.ts \
        supabase/config.toml \
        src/components/social/match/MatchConfirmation.tsx \
        src/components/social/match/MatchDuprStatus.tsx \
        src/components/organization/OrganizationDuprClubCard.tsx \
        src/hooks/useOrganizationDuprClub.ts \
        src/pages/DuprDashboard.tsx

git commit -m "feat(dupr): PR2-5 — entitlements gating, webhook hooks, match sync mirror, org club linking"

git push "https://cuongnguyen84:$GITHUB_PAT@github.com/cuongnguyen84/pickle-hub-pro.git" feat/dupr-raas-pr2-5

gh pr create --base main --head feat/dupr-raas-pr2-5 \
  --title "DUPR RaaS PR2-5 (entitlements + webhook + match sync + clubs)" \
  --body "See docs/dupr-pr2-5-audit.md + docs/dupr-pr2-5-deploy-and-test.md."
```

Cloudflare Pages sẽ build preview deploy tự động trong ~2 phút. URL preview:
`https://feat-dupr-raas-pr2-5.pickle-hub-pro.pages.dev`

### A.5 Pre-flight sanity (≈ 2 phút trước khi record)

```bash
SECRET=$(curl -sS -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  "https://api.supabase.com/v1/projects/$PROJECT_REF/api-keys?reveal=true" \
  | jq -r '.[] | select(.name=="default" and .type=="secret") | .api_key')
BASE=https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1

# 1. PR1 SSO partner token still works?
curl -sS -X POST -H "Authorization: Bearer $SECRET" \
  "$BASE/dupr-partner-token" | jq '{environment, has_token: ((.access_token // "") | length > 100)}'
# Expect: { "environment": "uat", "has_token": true }

# 2. testuser101 có entitlement?
psql "postgresql://postgres.ajvlcamxemgbxduhiqrl:$SECRET@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" \
  -c "SELECT user_id, entitlements -> 'tournaments' AS tournaments, expires_at FROM public.dupr_user_entitlements WHERE user_id = '164bf347-a896-41e8-b351-4bb0416193f5';"
# Expect: ["BASIC_L1", ...]. Nếu trống → đăng nhập testuser101 vào /dupr, bấm refresh ở section 2.
```

Nếu phải link tổ chức cho testuser101 trước demo PR5:

```sql
-- Trong SQL Editor:
UPDATE public.profiles
SET organization_id = (SELECT id FROM public.organizations ORDER BY created_at LIMIT 1)
WHERE id = '164bf347-a896-41e8-b351-4bb0416193f5';
```

---

## PHẦN B — RECORD 5 VIDEO

Anh dùng QuickTime / Loom / OBS đều OK. Frame ngang 16:9, ưu tiên 1080p, browser ở chế độ ẩn danh hoặc clear cache để chắc chắn fresh state.

**Cảnh chung cho mọi video:**
- Browser tab: `https://feat-dupr-raas-pr2-5.pickle-hub-pro.pages.dev/dupr` (sau merge thì là `.../dupr` ở UAT main preview)
- Sign-in: testuser101@picklehub.test (password đã reset trước)
- Mở DevTools → Network tab, filter "dupr-" để DUPR partner reviewer thấy HTTP calls thật

### Video 1 — SSO Connection (~ 90 giây)

**Section:** `1. Connection (SSO)`

1. (0:00) Show URL bar `https://.../dupr` + section "1. Connection (SSO)" + green `Pill: SSO connected` + DUPR ID `YGONMK` + singles/doubles.
2. (0:15) Voice-over: "User đã connect DUPR rồi — demo flow disconnect/reconnect."
3. (0:20) Bấm **Disconnect** → confirm. Pill chuyển sang `Not connected`. KV về `—`.
4. (0:35) Voice: "DUPR-disconnect đã unsubscribe RATING webhook bên DUPR + revoke local token."
5. (0:40) Bấm **Connect** → iframe DUPR mở ra.
6. (0:50) Đăng nhập DUPR (account thật testuser101 trên DUPR — anh nhớ DUPR password nhé).
7. (1:10) Iframe đóng → page tự refresh → Pill xanh `SSO connected` + Method `sso` + DUPR ID `YGONMK`.
8. (1:20) Show DevTools Network: highlight call `dupr-sso-callback` 200 OK. Show call `subscribe-webhook-event` 200 OK (đây là re-subscribe trong PR1 helper).
9. (1:30) Cut.

**Frame quan trọng:**
- Cảnh chuyển từ `Not connected` → `SSO connected`.
- Highlight 2 call HTTP: `dupr-sso-callback` + `dupr/user/v1.0/{id}` (verification).

### Video 2 — Entitlements (~ 60 giây)

**Section:** `2. Entitlements (User Gating)`

1. (0:00) Show section title + 3 pill: `BASIC_L1` (green), `PREMIUM_L1`, `VERIFIED_L1`.
2. (0:10) Voice: "Entitlements cache 24h theo spec DUPR. BASIC_L1 bắt buộc cho mọi platform action."
3. (0:15) Bấm icon **RefreshCw** (góc trên phải section).
4. (0:18) Spinner. Network tab show call `dupr-entitlements?force=1` → 200.
5. (0:25) Pills repaint. KV `Fetched` cập nhật ts mới. JSON `entitlements` block hiện đầy đủ resource → entitlement array.
6. (0:40) Optional: mở 1 tab khác `/match` → click CreateTab → highlight rằng form bật được (đã có BASIC_L1). Sign out, sign in testuser103 (không có entitlement) → toggle bị disable + cảnh báo VI/EN.
7. (0:55) Cut.

**Frame quan trọng:**
- JSON entitlements block (`{ "tournaments": ["BASIC_L1", ...] }`).
- 3 pill repaint cùng lúc với network call.

### Video 3 — Rating webhook (~ 90 giây)

**Section:** `3. Webhook (RATING events)`

1. (0:00) Show section "Webhook (RATING events)" + `Pill: Subscribed (RATING)` + Subscribed-at timestamp.
2. (0:10) Voice: "Webhook URL `/functions/v1/dupr-webhook` đã register với DUPR. User được subscribe khi SSO."
3. (0:20) KV `Live singles` + `Live doubles` show current value (e.g. 4.25 / 4.30).
4. (0:30) Scroll xuống "Fire webhook test". Nhập `Singles=4.41`, `Doubles=4.55`.
5. (0:40) Bấm **Fire test webhook**.
6. (0:42) JSON response hiện: `receiver: { status: 200, body: { status: "ok", dupr_id: "YGONMK", singles: 4.41, doubles: 4.55 } }`.
7. (0:55) Voice: "Receiver đã match clientId, validate, persist event, update profile rating, append history."
8. (1:00) Cuộn lên — `Live singles` đổi sang 4.41, `Live doubles` 4.55, `Synced at` mới.
9. (1:10) Scroll xuống bảng "Last 5 events" — event mới nhất ở top, status `OK`.
10. (1:25) Cut.

**Frame quan trọng:**
- Trước/sau của `Live singles` value.
- Bảng events có row mới với `topic: RATING`, `status: OK`.

> **Mẹo:** Nếu muốn show event end-to-end TỪ DUPR (không phải synthetic), DUPR UAT có thể bắn 1 RATING event nếu anh thay đổi rating bên DUPR cho test account. Nhưng synthetic test-fire đủ chứng minh receiver hoạt động đúng — DUPR review chỉ cần thấy luồng processing hoàn chỉnh.

### Video 4 — Match upload/update/delete (~ 2 phút)

**Section:** `4a. Submit match` + `4b. Submitted matches`

1. (0:00) Section 4a. Default values: SINGLES, location TP.HCM, club empty (PARTNER source).
2. (0:10) Team A player1 = `YGONMK`, Team B player1 = `XJYKO7`. Scores game1: 11 vs 7.
3. (0:30) Bấm **Submit match to DUPR**.
4. (0:35) Spinner. Network tab: `POST /functions/v1/dupr-match-submit` 200. Body show DUPR partner request payload (`identifier: tph:uat-dashboard:demo-...`, `matchSource: PARTNER`, scores).
5. (0:50) JSON response: `created: true, match_code: "5271241957", hashed_match_code: "...", match_source: "PARTNER"`.
6. (1:00) Voice: "DUPR đã accept. matchCode persist vào dupr_match_submissions table."
7. (1:05) Cuộn xuống section 4b. Row mới ở top: date, format, club=PARTNER, matchCode, identifier, status `ACTIVE`.
8. (1:15) Bấm **Delete** trên row đó. Confirm.
9. (1:20) Response: `{ deleted: true, match_code: "..." }`. Status flip `DELETED`.
10. (1:35) Voice: "DELETE đã đi đến DUPR /match/v1.0/delete. Local row giữ lại làm audit (deleted_at non-null)."
11. (1:50) Cut.

**Frame quan trọng:**
- JSON `created: true, match_code` + Network call tới `mydupr.com/api/match/v1.0/create`.
- Bảng 4b update inline.
- Status pill `ACTIVE` → `DELETED`.

> **Update demo:** với current UI form, anh dùng cùng `internal_match_id` đã submit, đổi score, đổi action thành "update" qua curl trong terminal hiển thị bên cạnh:
> ```bash
> curl -sS -X POST -H "Authorization: Bearer $USER_JWT" \
>   -d '{"action":"update","internal_source":"uat-dashboard","internal_match_id":"demo-XXX","team_a":{"player1":"YGONMK","game1":11,"game2":11},"team_b":{"player1":"XJYKO7","game1":7,"game2":9}}' \
>   "$BASE/dupr-match-submit" | jq
> ```
> Nếu muốn skip, video 4 chỉ cần CREATE + DELETE là đủ chứng minh lifecycle.

### Video 5 — Club integration (~ 90 giây)

**Section:** `5a. Your DUPR clubs` + `5b. Link DUPR Club ↔ Organization`

1. (0:00) Section 5a. Table show row: `The Pickle Hub Test Club / DIRECTOR / 7628571463 / Open on DUPR`.
2. (0:10) Voice: "User là DIRECTOR của test club bên DUPR. Bây giờ bind nó vào một organization của ThePickleHub."
3. (0:15) Scroll xuống section 5b. Dropdown chọn organization → pick một org.
4. (0:25) Card `OrganizationDuprClubCard` hiện: trạng thái "Not linked" + nút **Link DUPR Club**.
5. (0:30) Bấm **Link DUPR Club**. Dialog mở ra với radio list — chỉ "The Pickle Hub Test Club / DIRECTOR" hiển thị (PLAYER role bị filter).
6. (0:40) Chọn club, bấm **Link**.
7. (0:45) Network: `POST /functions/v1/dupr-org-link-club` 200. Response: `organization: { ..., dupr_club_id: "7628571463", dupr_club_role: "DIRECTOR", dupr_linked_at: ... }`.
8. (0:55) Dialog đóng. Card update inline: tên club + Badge DIRECTOR + linked-at + nút **Unlink**.
9. (1:00) Voice: "Org giờ đã liên kết. Match nào submit trong org này sẽ tự động matchSource=CLUB."
10. (1:10) Cuộn lên section 4a, submit 1 match nữa với cùng player + score. Trong response: `match_source: "CLUB"` thay vì `PARTNER`. Network call tới DUPR partner show `matchSource: "CLUB", clubId: 7628571463`.
11. (1:25) (Optional) Cuộn lại 5b, bấm **Unlink**. Card về trạng thái rỗng. Submit lại match → response `match_source: "PARTNER"`.
12. (1:30) Cut.

**Frame quan trọng:**
- Dialog list chỉ DIRECTOR/ORGANIZER.
- Card 5b chuyển trạng thái.
- match_source `PARTNER` → `CLUB` khi linked.

---

## PHẦN C — Sau khi record

Anh upload 5 video lên nơi DUPR partner yêu cầu (drive / Loom / email). Mỗi video kèm 1 ghi chú ngắn:

| Video | Title gợi ý |
|---|---|
| 1 | "DUPR SSO — connect / disconnect / re-subscribe (PR1)" |
| 2 | "Entitlements gating — BASIC_L1 cache 24h (PR2)" |
| 3 | "RATING webhook — subscribe + receive + persist (PR3)" |
| 4 | "Match create + delete via /match/v1.0 (PR4)" |
| 5 | "Club integration — DIRECTOR linkage + matchSource=CLUB (PR5)" |

PR description (đã có sẵn ở §6 deploy doc) tóm tắt schema + auth model — anh có thể paste link PR vào email gửi DUPR.

---

## Troubleshooting fast

| Triệu chứng | Lý do | Fix |
|---|---|---|
| Section 2 không có entitlements | Chưa SSO / cache trống | Disconnect rồi reconnect ở section 1; hoặc bấm refresh ở section 2 |
| `Fire test webhook` lỗi `412 missing user_id` | Edge function chưa redeploy | Chạy lại `npx supabase functions deploy dupr-webhook-test-fire --project-ref ajvlcamxemgbxduhiqrl --no-verify-jwt` |
| Section 5b dropdown trống | testuser101 không có `profiles.organization_id` | Chạy SQL UPDATE ở §A.5 |
| Section 4a submit lỗi 403 `role_required` | testuser101 không có role creator/admin | `INSERT INTO user_roles (user_id, role) VALUES ('164bf347-...', 'creator') ON CONFLICT DO NOTHING;` |
| Section 5b link lỗi 403 `not_org_admin` | Caller không có quyền — sign-in bằng thecuong@gmail.com (admin) thay vì testuser101 | Đăng nhập lại |
| `match_source` luôn là PARTNER dù đã link club | Submitter (testuser101) không nằm trong org → fallback PARTNER | Set `profiles.organization_id` = org đã link |
| Preview deploy 404 trên `/dupr` | Cloudflare Pages chưa build xong | Đợi 2-3 phút sau push, check trạng thái ở Cloudflare dashboard |
