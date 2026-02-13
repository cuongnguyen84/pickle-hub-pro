

# Ke hoach: Preview 30s + Login Gate cho Livestream

## Tai sao phuong an nay tot hon?

- **Tang ty le chuyen doi**: Nguoi dung duoc "nem thu" noi dung, cam thay hap dan roi moi yeu cau dang ky - ty le dang ky cao hon gap 3-5 lan so voi chan ngay.
- **Giu SEO**: Google bot van crawl duoc noi dung, khong anh huong ranking.
- **Giam bounce rate**: Nguoi dung khong bi "shock" khi vao trang ma bi chan ngay.
- **Tao cam giac FOMO**: Dang xem hay thi bi dung lai - dong luc dang ky rat manh.

## Tinh nang de xuat

### Core: Preview Timer + Login Gate
- Cho xem 30 giay (co the tuy chinh boi admin)
- Hien countdown bar o phia tren video
- Khi het thoi gian: pause video, hien overlay yeu cau dang nhap
- Overlay co blur background + nut Dang nhap / Dang ky

### Nang cao (tu van them)

1. **Admin cau hinh linh hoat**
   - Toggle bat/tat toan he thong
   - Tuy chinh thoi gian preview (15s / 30s / 60s / 120s)
   - Chon ap dung cho: Chi livestream LIVE / Chi replay / Ca hai

2. **Countdown bar truc quan**
   - Thanh progress bar nho o tren video
   - Hien so giay con lai
   - Doi mau tu xanh sang vang sang do khi gan het

3. **Overlay thong minh khi het thoi gian**
   - Pause video, lam mo (blur) man hinh
   - Icon khoa + thong bao hap dan: "Dang ky mien phi de tiep tuc xem"
   - 2 nut: "Dang nhap" va "Tao tai khoan mien phi"
   - Redirect ve trang livestream sau khi dang nhap thanh cong

4. **Nho trang thai da xem**
   - Luu vao localStorage: nguoi dung da xem preview cua livestream nay
   - Tranh truong hop refresh trang lai duoc xem tiep 30s

## Chi tiet ky thuat

### Buoc 1: Database - Bang `system_settings`

Tao bang luu cau hinh he thong:

```text
system_settings
+----------------------------------+----------+
| key (PK)                         | value    |
+----------------------------------+----------+
| require_login_livestream         | true     |
| livestream_preview_seconds       | 30       |
| livestream_gate_applies_to       | "all"    |
+----------------------------------+----------+
```

RLS: Ai cung doc duoc, chi admin sua duoc.

### Buoc 2: Hook `useSystemSettings`

- Fetch settings tu `system_settings` bang React Query
- Cache 5 phut (staleTime) de giam query
- Cung cap mutation cho admin toggle

### Buoc 3: Hook `useLivestreamGate`

Hook rieng xu ly logic preview timer:

```text
Input: livestreamId, previewSeconds, isEnabled, isAuthenticated
Output: {
  isGated: boolean        // da het thoi gian preview chua
  secondsRemaining: number // so giay con lai
  progress: number         // 0-100% cho progress bar
}
```

Logic:
- Neu da dang nhap hoac setting tat -> khong gate
- Bat dau dem nguoc khi video play
- Pause timer khi video pause
- Khi het thoi gian -> pause video, set isGated = true
- Luu vao localStorage de tranh xem lai

### Buoc 4: Component `LivestreamGateOverlay`

Component hien thi khi het preview:
- Full-screen overlay tren video player
- Background blur + gradient toi
- Icon Lock
- Text: "Dang ky mien phi de tiep tuc xem"
- Nut "Dang nhap" -> /login?redirect=/livestream/{id}
- Nut "Tao tai khoan" -> /login?redirect=/livestream/{id}&tab=signup

### Buoc 5: Component `PreviewCountdown`

Thanh countdown o tren video:
- Chi hien khi chua dang nhap va setting bat
- Progress bar mong (4px) o top video
- Text nho "Con X giay xem thu"
- Mau: xanh (>50%) -> vang (20-50%) -> do (<20%)

### Buoc 6: Tich hop vao `WatchLive.tsx`

- Import `useLivestreamGate` va `useSystemSettings`
- Truyen ref den MuxPlayer de co the pause video
- Render `PreviewCountdown` trong video container
- Render `LivestreamGateOverlay` khi `isGated = true`
- Chat panel van hien thi nhung disable input khi chua dang nhap

### Buoc 7: Admin UI - Trang System Settings

Them section trong AdminOverview hoac tao trang rieng `/admin/settings`:
- Card "Cai dat Livestream"
  - Switch: Bat/tat yeu cau dang nhap
  - Slider hoac Select: Thoi gian preview (15s/30s/60s/120s)
  - Radio: Ap dung cho Live / Replay / Ca hai
- Luu thay doi qua mutation voi toast xac nhan

### Buoc 8: i18n

Them key moi cho ca 2 ngon ngu (vi + en):
- `live.previewEnded` - "Het thoi gian xem thu"
- `live.signupToWatch` - "Dang ky mien phi de tiep tuc"
- `live.loginToWatch` - "Dang nhap de xem"
- `live.previewRemaining` - "Con {seconds}s xem thu"
- `admin.settings.livestreamGate` - Cac label trong admin
- `admin.settings.previewDuration` - Thoi gian preview

## Luong nguoi dung

```text
Nguoi dung vao trang livestream
        |
        v
Kiem tra: Da dang nhap?
   |              |
  Co             Khong
   |              |
   v              v
Xem binh      Kiem tra setting
thuong        require_login?
                 |          |
                Tat         Bat
                 |          |
                 v          v
              Xem binh   Bat dau dem
              thuong      nguoc 30s
                            |
                            v
                         Het 30s
                            |
                            v
                      Pause video
                      Hien overlay
                      "Dang ky de xem"
                            |
                     +------+------+
                     |             |
                  Dang nhap    Dang ky
                     |             |
                     v             v
                  Redirect ve livestream
                  Xem tiep tu dau
```

## Thu tu trien khai

1. Database migration (system_settings)
2. useSystemSettings hook
3. useLivestreamGate hook
4. PreviewCountdown component
5. LivestreamGateOverlay component
6. Tich hop vao WatchLive.tsx
7. Admin settings UI
8. i18n updates
