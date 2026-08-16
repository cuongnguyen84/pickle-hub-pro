# social-poster

Cloudflare Worker tự động đăng news_items (tiếng Việt) lên các Facebook Page
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

- `src/index.ts` — Worker entrypoint, Facebook pipeline
- `src/x.ts` — X (Twitter) queue drain, see [§X](#x-twitter--xrun)
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
- `fb_post_log` table with UNIQUE (`news_item_id`, `page_id`) and tracks the
  first link comment independently, so comment retries never duplicate posts.
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

wrangler secret put FB_SECONDARY_PAGE_ACCESS_TOKEN
# paste Page Access Token dài hạn của TA Pickleball

wrangler secret put SOCIAL_POSTER_ADMIN_SECRET
# dedicated secret for manual dry-runs and one-item smoke tests

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

## X (Twitter) — `/x/run`

Second pipeline in the same Worker. **Not** news-driven: it publishes only what
Cuong has approved in the `x_posts` table.

```
Cuong writes/approves a row in x_posts (status='approved', English copy)
                          ↓
        cron x-poster-drain-5min → POST /x/run
                          ↓
  ├── Link-reply pass first (posted rows older than X_LINK_COMMENT_DELAY_SECONDS)
  ├── Pacing gap (X_POST_MIN_GAP_MINUTES, default 90)
  ├── Claim approved → posting  (CAS on status, no duplicate publish)
  ├── POST api.x.com/2/tweets { text }
  └── posted → x_post_id, then a later tick replies 🔗 <link_url>
                          ↓
        x_posts.status = link_commented   (or posted, if no link_url)
```

Why the link is a reply and not part of the post: the "For you" ranking weights
reply / quote / repost far above like, and a URL in the body suppresses
distribution. The body sells the take; the reply carries the link.

### Content types

`result` (hot scoreline) · `prediction` · `stat` (insight) · `blog_teaser`.
Target 2-4 posts/day, published within 48h of the event.

### Setup

Tokens live in Postgres, not in wrangler secrets — X rotates the refresh token
on every use and a Worker cannot rewrite its own secrets at runtime.

1. `x_oauth_tokens` must hold one row with `id='thepicklehub'` and a valid
   access/refresh pair (generated from the X Developer Console for the app tied
   to @thepicklehub, scopes `tweet.write tweet.read users.read offline.access`).
2. Set the two app credentials the Worker needs to refresh that pair:

```sh
cd workers/social-poster
wrangler secret put X_CLIENT_ID
wrangler secret put X_CLIENT_SECRET
wrangler deploy
```

Without them `/x/run` returns `{"skipped": true, "reason": "x_not_configured"}`
and the Facebook pipeline is unaffected.

### Smoke test

```sh
# Preview: shows weighted length (URLs count 23, emoji count 2) and the reply
# that would be sent. No API call to X.
curl -X POST "$WORKER_URL/x/run" \
  -H "X-Auth-Secret: $AUTH_SECRET" \
  -H "Content-Type: application/json" -d '{"dry_run":true}'

# Publish one specific row now, bypassing the pacing gap.
curl -X POST "$WORKER_URL/x/run" \
  -H "X-Auth-Secret: $AUTH_SECRET" \
  -H "Content-Type: application/json" -d '{"post_id":"<uuid>"}'

# Token + queue depth
curl "$WORKER_URL/health?deep=1"
```

### Operations

Retry a failed row — the Worker only picks up `approved`:

```sql
UPDATE x_posts SET status = 'approved', error_message = NULL, attempt_count = 0
WHERE id = '<uuid>';
```

Stop X posting without touching Facebook: disable the cron job
(`SELECT cron.unschedule('x-poster-drain-5min');`) or delete the `X_CLIENT_ID`
secret. Rows already published cannot be recalled from here — delete on X.

A row wedged in `posting` (invocation crashed mid-publish) is moved to
`failed` after 10 minutes and **never republished** — a duplicate tweet cannot
be undone the way a duplicate Page post can. Its `error_message` says to check
the timeline. If the tweet is live, record it instead of requeueing:

```sql
UPDATE x_posts SET status = 'posted', x_post_id = '<tweet id>', posted_at = now()
WHERE id = '<uuid>';   -- the link reply then goes out on the next tick
```

`GET /health?deep=1` reports `link_reply_overdue` — published posts still
missing their link reply after an hour. Anything above 0 means posts are live
with no conversion path; check `link_comment_error` on those rows.

## Known limits

- **Image post:** dùng `image_url` của news_item. Nếu image link 404 hoặc
  bị FB reject (vd CORS, size), Graph API trả error và Worker log `failed`.
  Fallback: bỏ image_url, Worker tự fallback sang text post với link.
- **News Group, không Page:** Worker này CHỈ post vào Page. Graph API đã
  deprecate Group posting từ 4/2024.
- **X write budget:** the X free tier allows very few writes per month and
  each queued row costs two (post + link reply). The 90-minute pacing gap and
  the 3-attempt retry cap exist to keep a stuck row from eating the budget.
- **X duplicate content:** X rejects a post whose text matches a recent one
  with 403. That is not retryable — the row goes to `failed` and needs new copy.
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

- Auto-draft `x_posts` rows from finished matches / new blog posts so Cuong
  only reviews and approves instead of writing from scratch. Threads adapter
  next, same shape as `src/x.ts`.
- A/B caption: sinh 2 caption, random chọn 1, track CTR qua UTM.
- Smart skip: nếu importance < 2 thì skip auto-post (giảm noise).
- Auto reply comments: hook FB webhook → reply bằng Gemini.
