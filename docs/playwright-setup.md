# Playwright E2E — anh ship local trong 2 phút

Em đã push toàn bộ Playwright code + lock file lên repo. Chỉ còn **2 việc tay** anh làm vì GitHub API không cho bot push file trong `.github/workflows/` (PAT thiếu scope `workflow`).

## Bước 1: Copy workflow file vào đúng vị trí

Trên máy anh:

```bash
cd ~/pickle-hub-pro
git pull origin main          # lấy code Playwright em vừa push
cp docs/playwright-workflow.yml .github/workflows/playwright.yml
git add .github/workflows/playwright.yml
git commit -m "ci(qa): wire Playwright Phase 1 workflow"
git push origin main
```

Sau lần push này:
- Mỗi PR mới vào main → Playwright tự chạy trên Cloudflare preview
- Mỗi push vào main → Playwright chạy trên production
- Nếu fail trên main → Telegram bot @Tphaisupport_bot ping anh

## Bước 2: Add 2 GitHub Actions secrets cho Telegram alert

URL: https://github.com/cuongnguyen84/pickle-hub-pro/settings/secrets/actions → **New repository secret**

| Name | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | `8647605878:AAFnwsf7XBXV9cgzIQFy6r5ZBtXmZXxiLL4` |
| `TELEGRAM_CHAT_ID` | `233837066` |

(Cùng giá trị đã set vào Supabase secrets cho error tracker.)

Nếu skip step này — workflow vẫn chạy bình thường, chỉ là không có alert Telegram khi fail. Anh sẽ thấy ❌ red badge trên commit + summary trong tab Actions.

## Bước 3 (tùy chọn): Cập nhật PAT scope để tránh việc tay lần sau

Tạo PAT mới tại https://github.com/settings/tokens/new với 2 scopes:
- ✅ `repo` (đã có)
- ✅ `workflow` (mới — cho phép modify `.github/workflows/`)

Update `.claude/secrets.local.md` với token mới → em push thẳng workflow files được mà không cần anh can thiệp.

## Test local trước khi push

Optional — nếu anh muốn xem test chạy ra sao trước khi ship:

```bash
cd ~/pickle-hub-pro
npm install                      # cài @playwright/test
npx playwright install chromium  # download browser (~150MB)
npm run e2e                      # run tất cả tests
npm run e2e:ui                   # mode interactive — debug từng step
```

Predicted output cho run đầu tiên trên prod (read-only):
- 10 smoke tests pass (mỗi route có title đúng)
- 5 mobile tests pass (no horizontal scroll trên 375px)
- 5 SEO tests pass (Googlebot fetch trả 200 + meta tag đầy đủ)

Tổng ~3-5 phút chạy.

## Khi nào dùng tests

| Scenario | Action |
|---|---|
| Sửa code SEO meta / title | Push → CI tự chạy → nếu break SEO sẽ fail trước khi merge |
| Sửa CSS layout | CI catch horizontal-scroll regression mobile |
| Sửa CSP / `_headers` | Smoke catch nếu CSP block critical resource |
| Add blog post mới | SEO test catch nếu quên thêm vào `BLOG_POST_META` |
| Refactor route | Smoke catch nếu route 404 trên prod |

## Khi nào KHÔNG có tác dụng

- Auth-gated flow (DUPR Connect modal, log match, opponent confirm) — đợi Phase 2 vì cần test user password
- Backend RPC contract → đợi Phase 2 contract tests
- Visual diff (pixel-perfect) — chưa wire Percy/Chromatic

Báo em nếu test fail bất thường — em debug ngay.
