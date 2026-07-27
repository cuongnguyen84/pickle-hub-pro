# Intake — SEO P1 (work order 2026-07-24)

**Nguồn:** `/Users/cm10/Downloads/claude-code-workorder-SEO-P1-2026-07-24.md`
**Ngày intake:** 2026-07-26
**Orchestrator:** Claude Code (/idea)

## Ý tưởng gốc

Work order SEO P1 gồm 5 task, mục tiêu "lấy lại click nhanh + chặn rò rỉ", dựa trên
nghiên cứu từ khóa GSC 90 ngày. Phần lớn là verify/tinh chỉnh code đã có, không viết bài ồ ạt.

## Quyết định của Cuong (2026-07-26)

| Câu hỏi | Trả lời |
|---|---|
| **Phạm vi đợt này** | **CHỈ Task 1 + Task 2** (code-only quick win). Task 3/4/5 KHÔNG làm đợt này. |
| Task 4 — nút vé Ticketbox | **Chèn prose có URL** — không thêm field `cta`/`externalLinks` vào `BlogSection`. (Quyết định đã chốt cho khi nào làm T4.) |
| Task 5 — bản EN glossary | **EN + VI song song**, hreflang reciprocal đầy đủ. (Quyết định đã chốt cho khi nào làm T5.) |

→ Panel vòng 1 chỉ phân tích **Task 1 + Task 2**. T4/T5 answers ghi lại làm input cho đợt sau.

## Phạm vi đã chốt

### Task 1 — Nâng brand entity schema
Trong CẢ 2 khối Organization JSON-LD (EN + VI) ở `functions/_lib/render/index.ts`:
- `logo`: `DEFAULT_OG_IMAGE` (1200×630) → ảnh vuông `${siteUrl}/android-chrome-512x512.png`
- `sameAs`: thêm Play Store `net.thepicklehub.app` + App Store `id6759968026`, giữ FB/IG/YT

Bằng chứng GSC 90d: "the pickle hub" 1.270 impr @ pos 8,2 (CTR 3,1%); "picklehub" 215 impr @ pos 7,2.

### Task 2 — Verify + dứt điểm URL non-www 2025
- URL `https://thepicklehub.net/blog/best-pickleball-tournament-software-2025` còn index, 262 impr @ pos 42
- Xác minh redirect trong `public/_redirects` có thật sự fire không
- **Deliverable quan trọng:** xác định TẦNG NÀO thực sự honor redirect (Pages `_redirects` / `_middleware.ts` / Cloudflare Rules / legacy prerender-worker)
- Dọn slug `-2025` còn sót trong sitemap + metadata

## Ràng buộc bắt buộc (từ work order §3)

1. **www only. KHÔNG đụng DNS.** Việc thuộc Cloudflare dashboard → DỪNG, ghi 1 dòng cho Cuong.
2. `npx tsc --noEmit` + eslint pass; `curl -A "Googlebot"` = 200 + hreflang en/vi/x-default sạch; không 404 mồ côi.
3. `BLOG_POST_META` + sitemap là **generated** từ `metadata.ts` — không sửa tay (khớp CLAUDE.md SEO-02).
4. 1 PR/task.

## ⚠️ Brief lệch repo (ground rule "repo thắng")

Work order tham chiếu các artifact **không tồn tại** trong repo tại HEAD `4708b2ea`:

| Tham chiếu trong brief | Thực tế |
|---|---|
| `growth-tasks/CONTENT-PLAN-tuan28-30-2026-07-06.md` §6 | KHÔNG tồn tại (`growth-tasks/` chỉ có `seo-audit-2026-05-14.md` + `sql/`) |
| `docs/seo-topical-authority-plan.md` | KHÔNG tồn tại |
| `.gsc-index-queue.json` | KHÔNG tồn tại ở bất kỳ đâu trong repo |
| nhánh `strictnull-postmerge` đang mở | KHÔNG tồn tại (chỉ có `chore/strictnull-wave1/2a/2b/2c` trên origin) |
| `keyword-implementation-plan-2026-07-24.md` | chưa xác minh |

Hệ quả: DoD "cập nhật `.gsc-index-queue.json` status pending" **không thi hành được** như viết.
Task 1+2 không tạo content mới nên không chặn đợt này, nhưng cần Cuong xác nhận trước T3/T4/T5.

Tồn tại và đã verify: `docs/seo-tools-cluster-intent-map.md`, `docs/agent-round2-rules.md`,
`docs/proposals/_TEMPLATE.md`.

## Tiền đề Task 1 đã verify trước panel

- `public/android-chrome-512x512.png` — TỒN TẠI (cùng `android-chrome-192x192.png`, `apple-touch-icon.png`)
- `index.html:49` — `<meta name="google-play-app" content="app-id=net.thepicklehub.app">`
- `index.html:51` — `<meta name="apple-itunes-app" content="app-id=6759968026, ...">`

→ App-id trong brief khớp repo. Không phải số bịa.

## Hạ tầng pipeline thiếu

`scripts/agents/` KHÔNG tồn tại → `debate-ledger.mjs` và `risk-tier.mjs` không chạy được.
Vòng 2 sẽ cưỡng chế luật `docs/agent-round2-rules.md` **thủ công**, ghi rõ trong proposal.
(Đã biết từ trước — memory `idea-pipeline-missing-scripts`.)
