# Setup auth Google (GSC + GA4 API) — thay Ahrefs MCP (miễn phí)

Hai script `gsc_report.py` và `ga4_report.py` dùng **một service account** để đọc
dữ liệu Google Search Console + GA4. Setup 1 lần, sau đó các scheduled task chạy
headless không cần đăng nhập.

## 1. Tạo service account + key (Google Cloud Console)

1. Mở https://console.cloud.google.com → chọn (hoặc tạo) một project. Có thể tái
   dùng project Firebase của app (`net.thepicklehub.app`).
2. **APIs & Services → Library** → bật 2 API:
   - **Google Search Console API**
   - **Google Analytics Data API**
3. **APIs & Services → Credentials → Create credentials → Service account**.
   - Đặt tên ví dụ `picklehub-seo-readonly`. Không cần cấp role nào ở bước này.
4. Vào service account vừa tạo → tab **Keys → Add key → Create new key → JSON**.
   Tải file JSON về.
5. Copy email của service account (dạng `...@<project>.iam.gserviceaccount.com`) —
   cần ở bước 2 và 3 bên dưới.

## 2. Cấp quyền trong Google Search Console

1. Mở https://search.google.com/search-console → chọn property `thepicklehub.net`.
2. **Settings → Users and permissions → Add user**.
3. Dán email service account, quyền **Restricted** (đọc là đủ).

> Lưu ý property type: nếu là **Domain** property → trong `.env` đặt
> `GSC_SITE=sc-domain:thepicklehub.net` (mặc định). Nếu là **URL-prefix** →
> `GSC_SITE=https://www.thepicklehub.net/`.

## 3. Cấp quyền trong GA4

1. Mở https://analytics.google.com → **Admin** (bánh răng).
2. Cột Property → **Property Access Management → +** (góc phải).
3. Dán email service account, role **Viewer**.
4. Lấy **Property ID** dạng số: **Admin → Property Settings → Property ID**
   (ví dụ `123456789`). Đây KHÔNG phải `G-JQG63B6NX0` (measurement id).

## 4. Lưu key vào repo (đã gitignore sẵn)

Đặt file JSON tại đường dẫn sau (khớp `.gitignore` mục `.claude/secrets.local.*`,
sẽ KHÔNG bị commit):

```
.claude/secrets.local.gsc-ga4-sa.json
```

Thêm vào `.env` (hoặc export trong shell scheduled task):

```sh
GOOGLE_SA_JSON=.claude/secrets.local.gsc-ga4-sa.json
GSC_SITE=sc-domain:thepicklehub.net
GA4_PROPERTY_ID=123456789      # thay bằng property id thật
```

## 5. Cài deps + test

```sh
pip install -r scripts/seo/requirements.txt --break-system-packages

# GSC: 7 ngày gần nhất vs 7 ngày trước
python3 scripts/seo/gsc_report.py

# GA4: cần property id
GA4_PROPERTY_ID=123456789 python3 scripts/seo/ga4_report.py
```

Cả hai in JSON ra stdout (totals + WoW%, top queries/pages, source channels,
countries, pages mất clicks). Chỉ đọc, không ghi gì.

## 6. `index_coverage.py` — phân loại index coverage (từ 03/08/2026)

Trạng thái key trên máy Cuong (duyệt 03/08/2026): key thật là SA
`firebase-adminsdk-fbsvc@thepicklehub-dee20` (gốc `~/Downloads/thepicklehub-dee20-*.json`,
đã copy vào `.claude/secrets.local.gsc-ga4-sa.json`). Quyền đo thật ngày 02/08:
**siteFullUser** trên `sc-domain:thepicklehub.net`, chỉ **siteRestrictedUser** trên
URL-prefix `https://www.thepicklehub.net/` → URL Inspection API **phải** dùng
`GSC_SITE=sc-domain:thepicklehub.net` (mặc định), đổi sang URL-prefix sẽ 403.

```sh
# Tầng 1 — offline, không cần credential: sitemap × Trang.csv (+ HTTP check)
python3 scripts/seo/index_coverage.py \
  --performance-dir ~/Downloads/https___www.thepicklehub.net_-Performance-on-Search-2026-08-01

# Tầng 2 — URL Inspection API (~7s/URL, cache sqlite, chạy lại tự resume)
python3 scripts/seo/index_coverage.py --performance-dir ... --inspect 60

# Phân loại danh sách URL cụ thể (vd export 404 từ GSC UI)
python3 scripts/seo/index_coverage.py --performance-dir ... \
  --urls-file ~/Downloads/gsc-coverage-urls/404.csv --check-http

# Selftest (không mạng)
python3 scripts/seo/index_coverage.py --selftest
```

Exit codes: `0` ok · `2` tham số · `3` thiếu file/credential · `4` sai schema/enum lạ ·
`5` thiếu nguồn per-URL (đưa nhầm export Coverage aggregate) · `6` safety gate
(ứng viên đụng URL có impression — cần `--force`). Nguyên tắc: script **không bao giờ**
in nhãn coverage cho URL không có nguồn per-URL; `coverageState` được pin
`languageCode=en-US` và normalize sang enum nội bộ (chuỗi lạ = exit 4, không rơi
im lặng vào bucket unknown).

## Troubleshooting

- `403 PERMISSION_DENIED` GSC → chưa add service account vào Users & permissions,
  hoặc sai `GSC_SITE` (Domain vs URL-prefix).
- `403` GA4 → chưa add service account làm Viewer, hoặc sai `GA4_PROPERTY_ID`.
- `SERVICE_DISABLED` → chưa bật API ở bước 1.2 (chờ vài phút sau khi bật).
