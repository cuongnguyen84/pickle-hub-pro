# Solution Architect — round 1

## Tóm tắt kiến trúc
Số đăng ký thật đọc được cho khách anon — RLS `"Registrations viewable for public tables"` trên `quick_table_registrations` là `FOR SELECT` không có `TO` clause + `USING (is_public = true …)`, anon SELECT/count được, không cần migration. Rẻ nhất là bám prior art `useUpcomingSocialEvents` (fan-out `count: exact, head: true`) và chỉ gắn vào tập QuickTable ĐANG MỞ đăng ký (`useOpenRegistrationTables`, cap 20). Badge ẩn khi số < ngưỡng để tránh phản-social-proof.

## Option A — N+1 fan-out trên tập open-registration (KHUYẾN NGHỊ)
Effort **1 half-day** · Files: `useTournamentData.ts` (sửa `useOpenRegistrationTables`), `Tournaments.tsx` (badge trong `renderMeta`/`tl-br-meta`), xóa `OpenRegistrationSection.tsx` + export ở `index.ts` · Data: **0 migration**

- Sau khi lấy `tables` (cap `limit:20`), fan-out y hệt `useUpcomingSocialEvents.ts:53-62`:
  ```
  supabase.from("quick_table_registrations")
    .select("id", { count: "exact", head: true })
    .eq("table_id", t.id).neq("status", "rejected")
  ```
  Gộp `Promise.all` với vòng lấy `profiles` (không thêm waterfall). Thêm field `registered_count` vào `QuickTablePublic`.
- Chỉ `openRegTables` có count; row từ `activeQuickTables` (đã group_stage/playoff) không có field → badge tự vắng. Đúng ý: chỉ giải đang tuyển mới cần kéo đăng ký.
- Badge ở `tl-br-meta`: `const SOCIAL_PROOF_MIN = 3;` — `reg >= MIN` hiện `{reg} đã đăng ký` / `registered`, dưới ngưỡng giữ meta cũ.
- `status != 'rejected'` (gồm pending) vì `auto_approve_registrations` per-table (mig `20251225041737:8`) — approved-only sẽ đếm 0 ở giải duyệt tay chưa duyệt.

Wins: diff nhỏ nhất, tái dùng pattern prod, 0 migration/0 KB, anon OK. Xóa `OpenRegistrationSection` (progress bar giả hardcode 25% dòng 59).
Loses: chưa phủ team_match/doubles-elim/flex. Số không realtime (staleTime React Query).
Forecloses: gần như không. List open-reg vượt ~50 row thì nâng lên RPC = refactor 1 hook.

## Option B — RPC aggregate GROUP BY
Effort **2 half-days** · Files: 1 migration RPC `SECURITY DEFINER` trả `table_id,cnt` + `useTournamentData.ts` + `Tournaments.tsx` + regen `types.ts` · Data: **1 migration**
1 query `GROUP BY table_id` thay N. Phủ list dài + mở đường gộp team_match. Loses: migration + regen `--schema public` gotcha + SECURITY DEFINER review. Với cap 20 = giải bài toán chưa tồn tại.

## Option C — Cột denormalized + trigger
Effort **3+ half-days**. Counter column + trigger write-path. Loses nặng: trigger trên đường ghi đăng ký = counter drift, backfill, test race. Nợ vận hành cho 1 người trực. Khóa schema.

## Khuyến nghị: **Option A**
approved vs pending = `status != 'rejected'` (gồm pending). threshold = ẩn khi < 3, hằng số client chỉnh sau khi đọc số prod. phủ = chỉ QuickTable open-reg; doubles-elim/flex bỏ (traffic 0, không bảng đăng ký); team_match hoãn. OpenRegistrationSection = xóa.

## SSR/bundle
Không route mới. Badge client-only, bot không cần cache số đăng ký → không đụng `functions/_lib/render/`, sitemap, hreflang. 0 KB. Không đụng auth/payment/config → **không RED-tier**.

## Điều KHÔNG chắc (load-bearing)
- **team_match_teams anon SELECT** CHƯA verify policy — nếu phủ team_match sau, verify RLS trước, đừng giả định giống quick_table_registrations.
- **Số open-reg thật prod**: nếu đăng ký thưa (phần lớn 0-2), ngưỡng 3 ẩn gần hết → feature vô hình. Cần `select count(*),status from quick_table_registrations` prod trước khi chốt ngưỡng; có thể hạ 2.
- **doubles-elim/flex**: chưa tự mở migration 2 format này khẳng định không có bảng đăng ký tái dùng được.
- **pending lạm dụng**: nếu có luồng tự-đăng-ký rồi bỏ (spam pending), `!= 'rejected'` phồng số. Chưa kiểm có cron dọn pending cũ.
