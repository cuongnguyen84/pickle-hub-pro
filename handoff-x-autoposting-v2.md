# Bàn giao: X Auto-Posting — phần còn lại

> Đọc file này rồi làm theo. Repo: `pickle-hub-pro`. Ngày bàn giao: 2026-08-16.

## Bối cảnh: đã làm gì

Pipeline auto-post lên X (`@thepicklehub`) **đã code xong**, nằm ở nhánh
`feat/x-auto-posting` (2 commit, đã đúng, đã test).

Khác với bản thiết kế cũ: **không có Edge Function `x-post-create` /
`x-post-link-comment`**. Toàn bộ nằm trong Cloudflare Worker `social-poster`
đã có sẵn (chỗ đang chạy pipeline Facebook), thêm route `POST /x/run`. Lý do:
đường Facebook đã sở hữu logic claim-row-atomic / retry / reply-link; viết lại
lần hai chính là kiểu drift đã gây sự cố 2026-05-28.

Nội dung 2 commit:

| Commit | Nội dung |
|---|---|
| `f13abe00` | `workers/social-poster/src/x.ts` (718 dòng) + route `/x/run` + `x.test.ts` (19 test) + `wrangler.toml` + 2 migration + `docs/cron-schedules.md` |
| `8b9866cf` | `docs/x-content-playbook.md` — luật soạn nội dung X cho AI |

Đã verify: `tsc --noEmit` sạch, `eslint` sạch, 19 unit test pass, và 2
migration đã được apply **2 lần** lên Postgres 16 thật (cả DB trắng lẫn bản sao
schema hand-made có row rác) để chắc chắn idempotent và không abort.

### Cách pipeline chạy

```
Cuong duyệt row trong x_posts (status='approved')
            ↓
  cron x-poster-drain-5min (mỗi 5 phút) → POST /x/run
            ↓
  ├── quarantine row kẹt 'posting' > 10 phút → 'failed' (KHÔNG republish)
  ├── reply link cho bài đã đăng > 90 giây
  ├── giãn nhịp X_POST_MIN_GAP_MINUTES (90 phút)
  ├── claim CAS approved → posting
  └── POST api.x.com/2/tweets → 'posted' + x_post_id
            ↓
  tick sau: reply "🔗 <link_url>" → 'link_commented'
```

Link **không bao giờ** nằm trong body — URL trong body làm giảm phân phối trên
"For you". Đó là lý do có bước reply riêng.

---

## Việc cần làm

### Bước 1 — Push + mở PR  *(Claude Code làm được)*

```sh
cd ~/pickle-hub-pro
git push                    # nhánh feat/x-auto-posting, remote mới có commit 1
```

Nếu còn file `_to_delete/` hoặc `x-playbook.patch` / `x-auto-posting.patch` ở
repo root thì xoá đi, đó là rác của phiên bàn giao trước.

Mở PR `feat/x-auto-posting` → `main`. Title:

```
feat(social-poster): drain a hand-approved X queue from the same Worker
```

Body nêu: adapter X đặt trong worker `social-poster` thay vì edge function
riêng; pipeline này không news-driven mà chỉ đăng row Cuong duyệt tay; state
machine chặt hơn Facebook vì đăng lên X không rút lại được (CAS claim, row kẹt
`posting` bị quarantine chứ không republish, tweet đã lên mà PATCH lỗi thì
finalize `posted` chứ không requeue, 429 không tiêu retry của link reply); 2
migration ledger lại bảng `x_posts`/`x_oauth_tokens` vốn tạo tay trong SQL
Editor.

Chờ CI xanh: `Workers CI` (typecheck + vitest) và `quality`.

### Bước 2 — Merge rồi apply migration NGAY  *(Cuong tự làm, không tự chạy)*

Quan trọng về thứ tự: workflow `migration-drift.yml` chạy 19:47 UTC mỗi ngày
với `DRIFT_STRICT=1`. Merge mà chưa apply là repo-ahead → bắn Telegram.

```sh
supabase db push --project-ref ajvlcamxemgbxduhiqrl
```

Hai file:
- `supabase/migrations/20260816090000_x_posts_queue_hardening.sql`
- `supabase/migrations/20260816091000_x_poster_cron_job.sql`

Nhớ ledger vào `supabase_migrations.schema_migrations` theo đúng ops-runbook §1.
**Không bao giờ** `db push --include-all`.

Migration 1 làm gì: thêm status `posting`, `attempt_count`,
`link_comment_attempt_count`, `link_comment_error`; ép `updated_at NOT NULL`;
thêm 3 CHECK dạng `NOT VALID` (ép từ giờ trở đi, không quét row cũ nên không
thể abort); RLS admin-only cho `x_posts`, service-role-only cho
`x_oauth_tokens`.

Migration 2: cron `x-poster-drain-5min` gọi
`https://social-poster.thecuong.workers.dev/x/run`, đọc secret từ vault
(`social_poster_auth_secret` — dùng chung với cron Facebook, **không** cần tạo
`CRON_SECRET` mới như bản handoff cũ ghi).

### Bước 3 — Secret + deploy worker  *(Cuong tự làm)*

```sh
cd workers/social-poster
wrangler secret put X_CLIENT_ID
wrangler secret put X_CLIENT_SECRET
wrangler deploy
```

Chỉ 2 secret này. Access token / refresh token **không** để ở wrangler — chúng
nằm trong bảng `x_oauth_tokens` vì X xoay refresh token mỗi lần dùng và worker
không tự ghi lại secret của chính nó được.

Thiếu 2 secret thì `/x/run` trả `{"skipped": true, "reason":
"x_not_configured"}` và pipeline Facebook không bị ảnh hưởng gì.

### Bước 4 — Kiểm tra token còn sống

```sh
curl "https://social-poster.thecuong.workers.dev/health?deep=1"
```

Đọc nhánh `x`: `token_expires_at`, `token_needs_refresh`, `approved_queue`,
`link_reply_overdue`. Nếu trả `{"error": "x_health_unavailable"}` → xem
`wrangler tail` để biết chi tiết (health endpoint public nên cố ý không trả
nội dung lỗi ra ngoài).

Token trong `x_oauth_tokens` được generate từ X Developer Console hồi set up
app, có thể đã hết hạn. Worker tự refresh nếu `refresh_token` còn dùng được.
Nếu không, phải generate lại cặp token trong Console rồi UPDATE thẳng vào bảng
qua SQL Editor — **không paste giá trị token vào chat**.

### Bước 5 — Dry-run rồi live test

```sql
insert into x_posts (content_type, body, status)
values ('result', 'Ben Johns def. Federico Staksrud 11-6, 11-9 to win the Hong Kong Open final. His 3rd PPA Tour Asia title this year.', 'approved');
```

```sh
WORKER_URL="https://social-poster.thecuong.workers.dev"
curl -X POST "$WORKER_URL/x/run" \
  -H "X-Auth-Secret: $SOCIAL_POSTER_SECRET" \
  -H "Content-Type: application/json" -d '{"dry_run":true}'
```

Trả về `weighted_length` (X đếm URL = 23 ký tự, emoji = 2, trần 280), `valid`,
`warning`, và đúng chuỗi reply sẽ gửi. Ổn thì bỏ `dry_run` để đăng thật 1 bài,
mở x.com/thepicklehub xác nhận, kiểm tra row đã lên `posted` → tick sau thành
`link_commented`. Rồi để cron tự chạy.

---

## Vận hành

Retry 1 row failed:

```sql
UPDATE x_posts SET status = 'approved', error_message = NULL, attempt_count = 0
WHERE id = '<uuid>';
```

Row kẹt `posting` → sau 10 phút tự chuyển `failed` với message bảo đi kiểm tra
timeline. **Đừng set lại `approved` trước khi xem X** — có thể tweet đã lên
thật. Nếu đã lên:

```sql
UPDATE x_posts SET status = 'posted', x_post_id = '<tweet id>', posted_at = now()
WHERE id = '<uuid>';
```

Tắt X mà không đụng Facebook: `SELECT cron.unschedule('x-poster-drain-5min');`
hoặc xoá secret `X_CLIENT_ID`.

Chi tiết đầy đủ: `workers/social-poster/README.md` §X.

---

## Luật soạn nội dung

Nằm ở `docs/x-content-playbook.md` — bắt buộc đọc trước khi insert vào
`x_posts`. Tóm tắt:

- Tài khoản tiếng Anh. 4 dạng: `result`, `prediction`, `stat`, `blog_teaser`.
- Thuật toán X trả điểm rất lệch: copy-link share ×20, reply ×5–20, quote ×5,
  like ×1. Mỗi bài phải nhắm cụ thể vào một hành động điểm cao.
- Không chèn link trong `body`; link để cột `link_url`.
- `prediction` không được có `link_url`.
- Mỗi bài phải có ít nhất 1 chi tiết cụ thể (tên, số, tỷ số).
- Tối đa 1 hashtag. 2–4 bài/ngày.
- AI sinh bài phải set `status='draft'`, chỉ Cuong đổi sang `approved`.

Playbook này **chỉ áp dụng cho X**. Pipeline Facebook giữ nguyên prompt tiếng
Việt trong `news-social-caption`, không sửa.

---

## Còn tồn, chưa làm

1. **Ép luật bằng DB.** Hai luật "body không chứa link" và "`prediction` phải
   có `link_url` NULL" hiện chỉ nằm trong doc — AI khác vẫn insert sai được.
   Thêm 2 CHECK constraint vào migration là chặn được ở tầng DB. Nếu PR chưa
   merge thì sửa thẳng vào `20260816090000_...sql`, merge rồi thì làm migration
   mới.
2. **Skill X cho Cowork.** Doc trong repo chỉ tới được session đang mở repo.
   Muốn mọi phiên Cowork tự áp dụng playbook khi soạn bài thì phải đóng gói
   thành skill lưu vào account (kiểu `pickleball-social-content` nhưng cho X).
3. **Tự sinh draft.** Hiện Cuong viết tay từng row. Bước tiếp: nối dữ liệu
   match/tournament có sẵn (live scoring, PPA Tour scraping) để tự sinh
   `status='draft'` vào `x_posts`, Cuong chỉ review và duyệt. Dạng `stat` là
   chỗ đáng làm trước — đó là lợi thế dữ liệu thật không ai copy được.

## Ghi chú

- Không paste secret/token thật vào chat — thao tác thẳng trong Supabase
  Dashboard / SQL Editor / `wrangler secret put`.
- Migration và `wrangler deploy` luôn thủ công. Không tự chạy.
- Không thêm DB webhook / trigger realtime trên `x_posts`. Cron một chiều là cố
  ý — trigger realtime chính là nguyên nhân sự cố Facebook 2026-05-28.
