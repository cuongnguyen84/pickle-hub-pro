# social-poster

Cloudflare Worker tự động đăng news_items (tiếng Việt) lên Facebook Page
**ThePickleHub** thông qua Graph API. Driven by Supabase DB Webhook → realtime,
không cần cron.

## Pipeline

```
news-fetcher (Worker) → news_items (EN)
                          ↓
                  news-translate (Edge Fn, cron)
                          ↓
              news_items (VI, ai_translated=true)
                          ↓
              Supabase DB Webhook (INSERT/UPDATE)
                          ↓
                social-poster (Worker)
              ├── Eligibility check (vi + translated + published)
              ├── Dedupe via fb_post_log
              ├── Rate limit (FB_POST_MIN_GAP_MINUTES)
              ├── Gemini caption (skill: pickleball-social-content)
              └── Graph API POST /{page-id}/feed or /photos
                          ↓
                       fb_post_log
                  (status: posted | failed)
```

## Files

- `src/index.ts` — Worker entrypoint, all logic
- `wrangler.toml` — config + env vars + placement
- `package.json` — npm scripts (`dev`, `deploy`, `tail`, `secrets`)
- `tsconfig.json` — TS strict + ES2022

## DB migration

Apply once before deploying:

```sh
supabase db push --project-ref ajvlcamxemgbxduhiqrl
# Or via Studio: paste content of supabase/migrations/20260519030000_fb_post_log.sql
```

The migration creates:
- `fb_post_log` table (UNIQUE on `news_item_id`)
- RLS: service_role full, admin read-only
- Triggers for `updated_at`

## Setup

### 1. Lấy Facebook Page Access Token (long-lived)

Bước 1 — Tạo FB App (chỉ 1 lần):
1. https://developers.facebook.com/apps → Create App
2. Use case: **Other** → Type: **Business**
3. App name: `ThePickleHub Auto Poster` (chỉ admin nhìn thấy)
4. Lấy **App ID** và **App Secret** từ Settings → Basic

Bước 2 — Lấy User Access Token (short-lived, 1h):
1. https://developers.facebook.com/tools/explorer
2. Chọn FB App vừa tạo
3. Permissions cần: `pages_manage_posts`, `pages_read_engagement`, `pages_show_list`
4. Click **Generate Access Token** → login → grant → copy token

Bước 3 — Exchange thành Long-Lived User Token (60 ngày):
```sh
curl -G "https://graph.facebook.com/v20.0/oauth/access_token" \
  --data-urlencode "grant_type=fb_exchange_token" \
  --data-urlencode "client_id=$FB_APP_ID" \
  --data-urlencode "client_secret=$FB_APP_SECRET" \
  --data-urlencode "fb_exchange_token=$SHORT_LIVED_USER_TOKEN"
```
→ copy field `access_token` (đây là long-lived user token).

Bước 4 — Lấy Page Access Token (never-expire khi exchange từ long-lived user token):
```sh
curl -G "https://graph.facebook.com/v20.0/me/accounts" \
  --data-urlencode "access_token=$LONG_LIVED_USER_TOKEN"
```
→ JSON trả về list các Page anh quản lý. Copy `access_token` của Page ThePickleHub
   và `id` của Page → đó là `FB_PAGE_ACCESS_TOKEN` và `FB_PAGE_ID`.

Token này **không hết hạn** miễn là:
- Anh không đổi password FB
- App không bị vi phạm policy
- Permissions không bị revoke

Verify token còn hạn:
```sh
curl "https://graph.facebook.com/v20.0/debug_token?input_token=$FB_PAGE_ACCESS_TOKEN&access_token=$FB_PAGE_ACCESS_TOKEN"
```

### 2. Lấy Gemini API key

1. https://aistudio.google.com/apikey → Create API key
2. Copy → đây là `GEMINI_API_KEY`

### 3. Chọn SCRAPER_AUTH_SECRET

Random 32 bytes:
```sh
openssl rand -hex 32
```

### 4. Set secrets

```sh
cd workers/social-poster
npm install

wrangler secret put SUPABASE_SERVICE_ROLE_KEY
# paste từ Supabase Dashboard → Settings → API → service_role key

wrangler secret put SCRAPER_AUTH_SECRET
# paste output của openssl rand

wrangler secret put FB_PAGE_ID
# paste numeric Page ID (vd: 100000123456789)

wrangler secret put FB_PAGE_ACCESS_TOKEN
# paste Page Access Token từ bước 1.4

wrangler secret put GEMINI_API_KEY
# paste từ aistudio
```

### 5. Deploy Worker

```sh
wrangler deploy
```

Sau khi deploy, Worker chạy tại:
```
https://social-poster.<account>.workers.dev
```

### 6. Smoke test (dry-run, KHÔNG post lên FB)

```sh
# Lấy news_item_id thật từ Supabase Studio
NEWS_ITEM_ID="<uuid>"
WORKER_URL="https://social-poster.<account>.workers.dev"
AUTH_SECRET="<SCRAPER_AUTH_SECRET>"

curl -X POST "$WORKER_URL/run" \
  -H "X-Auth-Secret: $AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"news_item_id\":\"$NEWS_ITEM_ID\",\"dry_run\":true}"
```

Response sẽ trả về caption Gemini sinh + payload Graph API. **Đọc kỹ caption**
trước khi enable production webhook. Nếu tone/hashtag không ổn, sửa prompt
trong `buildGeminiPrompt()` rồi `wrangler deploy` lại.

Hoặc không truyền `news_item_id` để Worker tự pick news mới nhất chưa post:
```sh
curl -X POST "$WORKER_URL/run" \
  -H "X-Auth-Secret: $AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dry_run":true}'
```

### 7. Live test (post 1 bài thật để verify)

```sh
curl -X POST "$WORKER_URL/run" \
  -H "X-Auth-Secret: $AUTH_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"news_item_id\":\"$NEWS_ITEM_ID\",\"dry_run\":false}"
```

Mở Page ThePickleHub trên Facebook → kiểm tra bài đăng. Vào Supabase Studio
→ table `fb_post_log` → confirm row `status='posted'` + `fb_post_id` + `posted_at`.

### 8. Enable Supabase DB Webhook (production trigger)

Supabase Studio → Database → Webhooks → **Create a new hook**:

| Field | Value |
|---|---|
| Name | `social-poster-news-items` |
| Table | `news_items` |
| Events | ☑ Insert, ☑ Update |
| Type | HTTP Request |
| HTTP Method | POST |
| URL | `https://social-poster.<account>.workers.dev/` |
| HTTP Headers | `Content-Type: application/json` |
| | `X-Auth-Secret: <SCRAPER_AUTH_SECRET>` |
| HTTP Params | (empty) |

Save. Từ giờ mỗi khi `news-translate` Edge Function UPDATE 1 row VI thành
`ai_translated=true`, webhook bắn vào Worker và Worker tự post lên FB.

## Operations

### Xem log realtime

```sh
wrangler tail
```

### Manual trigger nếu webhook bỏ lỡ

```sh
curl -X POST "$WORKER_URL/run" \
  -H "X-Auth-Secret: $AUTH_SECRET" \
  -H "Content-Type: application/json" -d '{}'
```

(Tự pick news_item mới nhất chưa post.)

### Retry 1 row failed

Trong Supabase Studio:
```sql
DELETE FROM fb_post_log WHERE news_item_id = '<uuid>' AND status = 'failed';
```
Rồi gọi lại `/run` với `news_item_id`.

Hoặc Worker tự retry: gọi lại `/run` với cùng `news_item_id`, Worker sẽ
UPDATE row hiện có (không tạo duplicate vì UNIQUE constraint).

### Health check

```sh
curl "$WORKER_URL/health"
# → {"ok": true, "name": "social-poster"}
```

## Tuning

- **FB_POST_MIN_GAP_MINUTES** (default `5`): tăng nếu sợ spam Page khi news
  drop nhiều cùng lúc. Set `0` để tắt rate limit.
- **GEMINI_MODEL** (default `gemini-2.0-flash`): đổi `gemini-2.0-pro` nếu cần
  caption chất lượng cao hơn (chậm + đắt hơn).
- **Caption prompt** trong `buildGeminiPrompt()`: chỉnh tone, hook, hashtag
  style theo phản hồi từ community.

## Known limits

- **Image post:** dùng `image_url` của news_item. Nếu image link 404 hoặc
  bị FB reject (vd CORS, size), Graph API trả error và Worker log `failed`.
  Fallback: bỏ image_url, Worker tự fallback sang text post với link.
- **News Group, không Page:** Worker này CHỈ post vào Page. Graph API đã
  deprecate Group posting từ 4/2024.
- **Token expiry:** Page Access Token "không hết hạn" trong 99% case, nhưng
  nếu anh đổi password FB hoặc revoke app permissions, token sẽ chết và
  Worker sẽ log `failed` với status 190. Cần làm lại bước 1.

## Rollback

Nếu Worker spam hoặc generate caption sai:

```sh
# Disable webhook ngay
# → Supabase Studio → Database → Webhooks → toggle off

# Hoặc xoá secrets để Worker reject mọi request
wrangler secret delete SCRAPER_AUTH_SECRET
```

Worker không xoá data đã post lên FB — phải xoá manual trên FB Page.

## Future enhancements

- Multi-platform: gửi cùng caption sang Twitter/X + Threads (cần adapter).
- A/B caption: sinh 2 caption, random chọn 1, track CTR qua UTM.
- Smart skip: nếu importance < 2 thì skip auto-post (giảm noise).
- Auto reply comments: hook FB webhook → reply bằng Gemini.
