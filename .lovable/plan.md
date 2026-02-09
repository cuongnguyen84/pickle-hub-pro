

# Auto-archive giải đấu bị bỏ rơi

## Vấn de
Hiện có **52 giải Quick Tables** và **10 giải Team Match** đang ở trạng thai active (setup/group_stage/playoff/registration/ongoing) nhung nguoi tao da khong tuong tac tu rat lau (co giai tu thang 12/2025).

Nhung giai nay lam "ban" danh sach giai cong khai, gay an tuong xau cho nguoi dung moi.

## Giai phap: Cron Job tu dong archive

### 1. Tao Edge Function `auto-archive-tournaments`

Function se chay dinh ky va:
- Tim cac giai **Quick Tables** co `updated_at` qua **14 ngay** va status khong phai `completed` -> chuyen thanh `completed`
- Tim cac giai **Team Match** co `updated_at` qua **14 ngay** va status khong phai `completed` -> chuyen thanh `completed`
- Ghi log so luong giai da archive

### 2. Cai dat Cron Job

Dung `pg_cron` + `pg_net` de goi Edge Function moi ngay 1 lan (luc 3h sang UTC):

```text
Schedule: 0 3 * * *  (moi ngay luc 3:00 UTC)
```

### 3. Logic chi tiet

```text
Quick Tables:
  - status IN ('setup', 'group_stage', 'playoff')
  - updated_at < now() - interval '14 days'
  -> UPDATE status = 'completed'

Team Match Tournaments:
  - status IN ('registration', 'ongoing')
  - updated_at < now() - interval '14 days'
  -> UPDATE status = 'completed'
```

### 4. An toan

- Chi thay doi `status`, khong xoa du lieu
- Nguoi tao van co the xem lai giai cua minh trong danh sach "Da hoan thanh"
- Khong anh huong giai dang duoc su dung (vi `updated_at` se duoc cap nhat khi co bat ky thao tac nao)

## Chi tiet ky thuat

### File moi
| File | Mo ta |
|------|-------|
| `supabase/functions/auto-archive-tournaments/index.ts` | Edge Function xu ly archive |

### Database
- Bat extension `pg_cron` va `pg_net` (neu chua bat)
- Tao cron schedule goi function moi ngay

### Thay doi ngay lap tuc
- Chay 1 lan thu cong ngay sau khi deploy de don dep 52+ giai cu

## Luu y
- Nguong 14 ngay co the dieu chinh tuy theo nhu cau
- Co the them thong bao email cho nguoi tao truoc khi archive (giai doan sau)
- Nen them cot `archived_at` de phan biet giai "hoan thanh that" va "bi archive tu dong" (tuy chon)

