# ThePickleHub — Outstanding TODO

Sau migration hoàn tất (14/04/2026). Các task còn lại không urgent, prioritized.

---

## 🔴 Priority 1 — Trong tuần này

### 1. Apple Sign-In .p8 key

**Status:** Chưa tạo key mới sau migration sang Supabase project `ajvlcamxemgbxduhiqrl`.

**Impact:** 146 Apple users có thể đang không login được. Cần test gấp.

**Steps:**
1. Login https://developer.apple.com → Certificates, IDs & Profiles → Keys
2. Click **+** tạo key mới
3. Name: `ThePickleHub Sign In with Apple - prod`
4. Check box: ☑ **Sign in with Apple**
5. Configure → select Primary App ID = com.thepicklehub.app (hoặc bundle ID thật)
6. Save → download `.p8` file
7. Lưu Key ID + Team ID
8. Vào Supabase dashboard → `ajvlcamxemgbxduhiqrl` → Authentication → Providers → Apple
9. Update:
   - Services ID (hoặc Client ID)
   - Team ID
   - Key ID
   - Secret Key: paste nội dung `.p8` file
10. Save
11. Test login Apple trên web + mobile app

**Verification:**
- Login Apple trên www.thepicklehub.net → expect success
- Test trên iOS Capacitor app → verify Universal Links flow
- Check Supabase logs: Authentication → Logs → tìm Apple provider events

---

### 2. Mux Webhook URL

**Status:** Webhook endpoint trên dashboard.mux.com có thể đang trỏ về Supabase project cũ `nijiwypubmkvmjuafmgp`.

**Steps:**
1. Login https://dashboard.mux.com → chọn Environment **Production**
2. Settings → Webhooks
3. Click vào webhook hiện tại
4. Check URL:
   - Old: `https://nijiwypubmkvmjuafmgp.supabase.co/functions/v1/mux-webhook`
   - New: `https://ajvlcamxemgbxduhiqrl.supabase.co/functions/v1/mux-webhook`
5. Update URL nếu sai
6. Check Signing Secret:
   - Nếu Mux rotate secret khi save → copy secret mới
   - Update `MUX_WEBHOOK_SECRET` trong Supabase dashboard → Edge Functions → Secrets
   - Verify `mux-webhook` function vẫn verify signature đúng (test bằng Mux "Send test event")

**Verification:**
- Tạo livestream mới trên Creator Studio
- Monitor Supabase logs: Edge Functions → mux-webhook → Logs
- Verify events (video.live_stream.active, video.asset.ready) đến với signature valid

---

## 🟡 Priority 2 — Trong 2 tuần (sau khi stable)

### 3. Firebase Service Account Key Cleanup

**Status:** Sau migration, Cuong đã tạo key Firebase mới cho project Supabase mới. Key cũ (dùng trên Lovable) vẫn còn active trong Firebase Console.

**Steps:**
1. Đợi production stable ít nhất 2 tuần (từ 14/04/2026 → sau 28/04/2026)
2. Login https://console.firebase.google.com → chọn project ThePickleHub
3. Project settings → Service Accounts → Manage service account permissions
4. Tìm key cũ (timestamp trước 14/04/2026)
5. Delete key cũ
6. Verify push notification trên production vẫn work sau delete

---

### 4. Resend API Key Cleanup

**Status:** Tương tự Firebase, key cũ vẫn active trên Resend dashboard.

**Steps:**
1. Đợi 2 tuần stable
2. Login https://resend.com/api-keys
3. Tìm key cũ (tên khác `thepicklehub-prod-ajvlcamx`)
4. Click **Revoke**
5. Verify send-auth-email và invite-team-to-tournament vẫn work

---

### 5. Monitor Supabase ES256/HS256 Fix

**Status:** Supabase có platform issue — Auth sign JWT với ES256, gateway verify HS256. Workaround: set `verify_jwt=false` cho 4 functions.

**Action:**
- Monitor https://github.com/supabase/supabase/issues
- Search "ES256 HS256 edge function JWT"
- Subscribe thread nếu có
- Khi Supabase fix → revert `verify_jwt=true` trong `supabase/config.toml`, redeploy 4 functions
- Verify gateway reject anon/anonymous calls trở lại (security improvement)

---

## 🟢 Priority 3 — Trong 1+ tháng

### 6. Push Notification "Send to All Users" Bug

**Status:** Frontend query `push_tokens` table với user JWT → RLS chỉ trả tokens của admin đó, không phải all users. Feature "gửi cho tất cả" thực tế chỉ gửi cho admin.

**Fix options:**

**Option A — Frontend query profiles (simpler):**
```tsx
// In src/pages/admin/AdminPushNotification.tsx, "all" branch
const { data: allProfiles } = await supabase
  .from('profiles')
  .select('id');
targetUserIds = allProfiles.map(p => p.id);
// Then pass user_ids to function, function queries push_tokens with service_role
```

**Option B — Backend fan-out (more scalable):**
Modify `send-push-notification` function:
- Accept `target: "all"` option
- Use service_role internally to query all push_tokens
- Loop and send

**Recommendation:** Option B — cleaner separation, admin doesn't need to know UUIDs.

**Add confirm dialog** trước khi broadcast:
```tsx
if (target === "all" && !confirm(`Gửi thông báo tới tất cả ${estimatedCount} users?`)) {
  return;
}
```

---

### 7. Red5 DB Columns Cleanup

**Status:** Columns `livestreams.red5_server_url` và `livestreams.red5_stream_name` vẫn trong schema, nullable, zero data.

**Steps:**
1. Verify 0 rows có data:
   ```sql
   SELECT COUNT(*) FROM livestreams 
   WHERE red5_server_url IS NOT NULL OR red5_stream_name IS NOT NULL;
   ```
2. Nếu 0 → tạo migration:
   ```sql
   ALTER TABLE public.livestreams 
     DROP COLUMN red5_server_url,
     DROP COLUMN red5_stream_name;
   ```
3. Regenerate TypeScript types:
   ```bash
   supabase gen types typescript --project-id ajvlcamxemgbxduhiqrl > src/integrations/supabase/types.ts
   ```
4. Remove references trong `src/pages/creator/CreatorLivestreamForm.tsx:158-159`
5. Build + test

---

### 8. Dead Env Var Cleanup

**Status:** `VITE_SUPABASE_PROJECT_ID` trong `.env` nhưng zero references trong `src/`.

**Steps:**
1. Verify một lần nữa:
   ```bash
   grep -rn "VITE_SUPABASE_PROJECT_ID" src/ --include="*.ts" --include="*.tsx"
   ```
2. Nếu empty → xóa dòng trong `.env`
3. Commit

---

### 9. Create `.env.example`

**Status:** Repo không có file template env → dev khác clone không biết vars cần set.

**Content:**
```bash
# Supabase
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here

# Site (optional, has hardcoded fallback)
VITE_SITE_URL=https://www.thepicklehub.net
```

---

### 10. Lovable Dashboard Archive

**Status:** Lovable project vẫn active trên lovable.dev dashboard (dù không dùng nữa).

**Steps:**
1. Login Lovable dashboard
2. Navigate to pickle-hub-pro project
3. Settings → Archive project
4. Đợi 1 tháng nữa → Delete project hoàn toàn

---

### 11. Old Supabase Project `nijiwypubmkvmjuafmgp`

**Status:** Project cũ vẫn active trên Supabase dashboard, vẫn có data + functions từ Lovable era.

**Steps:**
1. Đợi production mới stable 2-3 tuần
2. Verify không có traffic nào vẫn trỏ về project cũ:
   - Check Supabase logs → 0 requests trong 7 ngày
   - Check Cloudflare DNS không còn record nào trỏ về `nijiwypubmkvmjuafmgp`
3. Pause project (Supabase Dashboard → Settings → Pause)
4. Đợi thêm 1 tháng → Delete permanently

---

### 12. Mux Assets Migration (Optional)

**Status:** `mux-sync-assets` function trả `total:0` — không có assets trên project mới. VOD recordings cũ từ Lovable era vẫn ở Mux nhưng metadata chưa sync.

**Decision needed:**
- Có muốn recover VOD recordings cũ không?
- Nếu có → build data migration script sync từ Mux API → `videos` table

**Impact:** Low. Nếu users không complaint về replay cũ bị mất → skip.

---

## ✅ Hoàn tất (DO NOT REDO)

- [x] Phase 1: Remove ai-assistant feature
- [x] Phase 2: Delete orphan prerender edge function
- [x] Phase 3: Clean Lovable comments + README
- [x] Phase 4: Remove Ant Media feature (code + DB row)
- [x] Deploy 25 Supabase edge functions lên project mới
- [x] Fix ES256/HS256 JWT gateway mismatch
- [x] Fix admin push notification email → UUID conversion bug
- [x] Verify OAuth Google login works
- [x] Verify password reset email flow (255 email users)
- [x] Verify Mux livestream creation
- [x] Verify push notification delivery
- [x] Verify video replay playback
- [x] Verify SEO prerender intact
- [x] Final audit: 98% complete, PASS
