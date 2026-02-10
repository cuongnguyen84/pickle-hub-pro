

# Bao cao kiem tra Input Validation va Ke hoach xu ly

## Tong quan

Sau khi kiem tra toan bo codebase (frontend hooks, pages, edge functions), toi phat hien **15 van de** chia thanh 3 muc do nghiem trong.

---

## 1. VAN DE NGHIEM TRONG (Can xu ly ngay)

### 1.1 Flex Tournament - Khong gioi han so luong players khi tao giai
- **File**: `src/pages/FlexTournamentSetup.tsx`, `src/hooks/useFlexTournament.ts`
- **Van de**: Nguoi dung co the paste hang ngan dong vao textarea "players", tao hang ngan record trong DB. Khong co gioi han `playerNames.length`.
- **Giai phap**: Gioi han toi da 200 players khi tao giai.

### 1.2 Flex Tournament - Khong gioi han do dai ten
- **File**: `src/hooks/useFlexTournament.ts` (addPlayer, addTeam, addGroup, addMatch, createTournament)
- **Van de**: Ten giai, ten doi, ten nhom, ten tran dau khong co gioi han ky tu. Nguoi dung co the nhap ten dai hang ngan ky tu, pha vo layout va lam day DB.
- **Giai phap**: Gioi han ten toi da 100 ky tu, trim() truoc khi insert.

### 1.3 Quick Table - Khong validate do dai ten giai va registration_message
- **File**: `src/hooks/useQuickTable.ts`, `src/pages/QuickTables.tsx`
- **Van de**: `tableName` va `registration_message` khong co gioi han do dai.
- **Giai phap**: Gioi han ten giai 100 ky tu, registration_message 500 ky tu.

### 1.4 Team Match - Khong validate do dai ten doi, ten nguoi choi
- **File**: `src/hooks/useTeamMatchTeams.ts`
- **Van de**: `team_name`, `captain_name`, `player_name` khong gioi han do dai.
- **Giai phap**: Gioi han moi truong 100 ky tu.

### 1.5 Registration - profile_link khong validate URL
- **File**: `src/hooks/useRegistration.ts`, `src/hooks/useTeamRegistration.ts`
- **Van de**: `profile_link` chi trim() nhung khong validate co phai URL hop le hay khong. Co the chua javascript: URI hoac noi dung doc hai.
- **Giai phap**: Validate URL format, chi chap nhan http:// va https://.

### 1.6 Chat - Khong sanitize noi dung tin nhan
- **File**: `src/hooks/useLiveChat.ts`
- **Van de**: Co gioi han 500 ky tu (tot), nhung khong loc ky tu dac biet hoac HTML tags. Neu hien thi bang innerHTML se bi XSS.
- **Trang thai hien tai**: Dang dung React nen tu dong escape - **rui ro thap** nhung nen them validation phong bi.

---

## 2. VAN DE TRUNG BINH

### 2.1 Edge Function `ai-assistant` - Khong validate input
- **File**: `supabase/functions/ai-assistant/index.ts`
- **Van de**: `screenName`, `stepName`, `question` khong co gioi han do dai. Nguoi dung co the gui `question` cuc dai, ton credits AI.
- **Giai phap**: Gioi han question 500 ky tu, screenName 100, stepName 100.

### 2.2 Edge Function `batch-view-events` - Khong validate UUID format
- **File**: `supabase/functions/batch-view-events/index.ts`
- **Van de**: `target_id` chi check ton tai nhung khong validate co phai UUID hop le. `target_type` khong validate enum.
- **Giai phap**: Validate UUID regex va enum cho target_type.

### 2.3 Edge Function `api-keys-admin-generate` - name khong gioi han do dai
- **File**: `supabase/functions/api-keys-admin-generate/index.ts`
- **Van de**: Chi check `name?.trim()` nhung khong gioi han do dai.
- **Giai phap**: Gioi han name 100 ky tu.

### 2.4 Quick Table - player_count khong co upper bound server-side
- **File**: `src/pages/QuickTables.tsx`
- **Van de**: Client co `max={200}` tren input nhung co the bypass. Server (RPC) khong validate.
- **Giai phap**: Them check server-side trong RPC hoac edge function.

---

## 3. VAN DE NHE (Nen xu ly)

### 3.1 Comment section - Khong gioi han do dai comment
- **Van de**: Neu co chuc nang comment, can dam bao gioi han ky tu.

### 3.2 FlexTournamentSetup - Ten giai khong gioi han client-side
- **Van de**: Input `name` chi check `!name.trim()` (empty) nhung khong check do dai.

### 3.3 OG Functions - Potential XSS trong redirect
- **File**: `supabase/functions/og-*/index.ts`
- **Van de**: Mot so OG functions da dung `escapeHtml()` nhung `window.location.href = "${canonicalUrl}"` co the bi inject neu slug chua ky tu dac biet.
- **Trang thai**: Da co `escapeHtml` o nhieu cho, rui ro thap vi slug tu DB.

---

## KE HOACH XU LY

### Buoc 1: Tao utility function validate chung
Tao file `src/lib/validation.ts` voi cac ham:
- `validateMaxLength(value, max, fieldName)` - Kiem tra do dai
- `sanitizeString(value, maxLength)` - Trim + cat do dai
- `validateUrl(value)` - Chi chap nhan http/https
- `validateUUID(value)` - Kiem tra UUID format

### Buoc 2: Ap dung validation cho Frontend hooks
- `useFlexTournament.ts`: Gioi han players (200), ten (100 ky tu), trim tat ca input
- `useQuickTable.ts`: Gioi han ten (100), registration_message (500)
- `useTeamMatchTeams.ts`: Gioi han ten (100)
- `useRegistration.ts` + `useTeamRegistration.ts`: Validate profile_link URL
- `useLiveChat.ts`: Da tot, bo sung sanitize co ban

### Buoc 3: Ap dung validation cho Edge Functions
- `ai-assistant`: Gioi han question 500 ky tu
- `batch-view-events`: Validate UUID + enum
- `api-keys-admin-generate`: Gioi han name 100 ky tu

### Buoc 4: Them maxLength tren cac Input component
- Them thuoc tinh `maxLength` truc tiep tren HTML input/textarea de ngan tu client

---

## TONG KET

| Muc do | So luong | Hanh dong |
|--------|----------|-----------|
| Nghiem trong | 6 | Xu ly ngay |
| Trung binh | 4 | Xu ly som |
| Nhe | 3 | Xu ly khi co thoi gian |

Tat ca cac thay doi deu **khong anh huong** den tinh nang hien tai, chi them lop bao ve chong lai input xau.

