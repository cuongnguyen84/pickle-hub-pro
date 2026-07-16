# Agent Loops Plan — ThePickleHub

> Kế hoạch hệ thống agent chạy theo vòng lặp (loop) để phát triển mọi mảng của dự án.
> Nền tảng: **Claude Code** (subagents + slash commands trong repo) + **Cowork scheduled tasks** (chạy tự động theo lịch).
> Ngày tạo: 2026-07-06.

## Nguyên tắc thiết kế

1. **Loop = làm → verify → sửa → lặp lại đến khi pass.** Mỗi agent có điều kiện dừng (exit criteria) rõ ràng, không "làm xong rồi hy vọng".
2. **Tận dụng tooling sẵn có:** `scripts/seo-verify.sh`, `scripts/seo/gsc_report.py`, `scripts/seo/ga4_report.py`, `scripts/ops/notify_telegram.py`, `docs/cron-schedules.md`.
3. **Solo builder constraint:** agent tự chạy verify bằng CLI/curl, chỉ báo Cuong khi cần quyết định hoặc UI check.
4. **Mọi URL dùng `https://www.thepicklehub.net`** (www). Verify bằng curl Googlebot UA, KHÔNG dùng GSC Live Test.

## Kiến trúc 2 tầng

```
Tầng 1 — Claude Code (trong repo, anh chủ động chạy)
  .claude/agents/     ← subagents chuyên môn hoá (tự động được gọi hoặc gọi đích danh)
  .claude/commands/   ← slash commands đóng gói cả loop end-to-end

Tầng 2 — Cowork scheduled tasks (chạy tự động theo lịch, không cần ngồi máy)
  Daily / weekly loops: SEO health, pipeline check, growth digest
```

## 4 Loop chính

### Loop 1 — Content + SEO (`/publish-post`, agent `content-publisher` + `seo-auditor`)

Vòng lặp xuất bản bài blog bilingual, tự verify đủ 4 bước bắt buộc:

```
Nhận topic → hỏi audience (VI/EN/cả 2, theo two-track strategy)
  → Viết content
  → 4 thay đổi đồng thời:
      1. src/content/blog/posts/<slug>.ts (content.en + content.vi)
      2. src/content/blog/metadata.ts (prepend)
      3. functions/_lib/render/index.ts → BLOG_POST_META
      4. Supabase vi_blog_posts INSERT (alternate_en_slug)
  → git push main → chờ Cloudflare deploy
  → LOOP verify: curl -A Googlebot → 200 + title + og:image + hreflang en/vi/x-default
      fail → chẩn đoán (thiếu BLOG_POST_META? cache pr:v6 stale?) → fix → verify lại
  → Request indexing: GSC (manual) + IndexNow (tự động qua functions/api/indexnow.ts)
Exit: cả EN + VI URL trả 200 với đầy đủ SEO surface qua Googlebot UA.
```

### Loop 2 — Dev + QA (`/ship-feature`, agent `qa-verifier`)

```
Nhận feature spec → tạo feature branch
  → Code (theo patterns hiện có, không đụng *.legacy.tsx)
  → LOOP QA: npm run lint → npm run test → npm run build
      fail → fix → chạy lại (tối đa 5 vòng, kẹt thì báo Cuong)
  → Push → preview URL <branch>.pickle-hub-pro.pages.dev
  → Nếu ảnh hưởng SEO route: BASE_URL=<preview> ./scripts/seo-verify.sh
  → Mở PR (KHÔNG auto-merge; DUPR PR #114–#122 giữ nguyên)
Exit: lint + test + build pass, seo-verify pass trên preview, PR mở.
```

### Loop 3 — News + Data pipeline (`/pipeline-check`, agent `pipeline-medic`)

```
Kiểm tra sức khoẻ pipeline theo docs/cron-schedules.md:
  → Supabase: news_items mới trong 12h? news_translation_status có pending kẹt?
  → pro-tour-scraper: lần ingest gần nhất? fixtures test pass?
  → supabase functions list --project-ref ajvlcamxemgbxduhiqrl (confirm deploy)
  → LOOP fix: lỗi ở tầng nào (Worker cron / edge function / Gemini quota / RLS)
      → fix nhỏ tự làm + verify lại; lỗi lớn → báo cáo kèm chẩn đoán
Exit: mọi pipeline có dữ liệu mới đúng chu kỳ, không có hàng đợi kẹt.
```

### Loop 4 — Growth + Monitoring (agent `growth-analyst`)

```
Daily:  scripts/seo-verify.sh (prod) + spot-check sitemap index + GSC indexing errors
Weekly: python scripts/seo/gsc_report.py + ga4_report.py
  → Digest: top queries tăng/giảm, pages mất position, CTR bất thường
  → Đề xuất 2–3 content ideas theo two-track (VI local / EN Asia-niche)
  → Gửi qua scripts/ops/notify_telegram.py (nếu có token) hoặc file report
Exit: report tạo xong tại seo/reports/YYYY-MM-DD.md.
```

## Files được tạo

> Files nằm trong bundle `agent-loops/` (Cowork outputs). Cài vào repo bằng:
> ```sh
> cp -r <đường-dẫn-bundle>/agents/. .claude/agents/
> cp -r <đường-dẫn-bundle>/commands/. .claude/commands/
> ```

| File | Vai trò |
|---|---|
| `.claude/agents/content-publisher.md` | Subagent viết + xuất bản blog bilingual đủ 4 bước |
| `.claude/agents/seo-auditor.md` | Subagent audit SEO, verify prerender/hreflang/sitemap |
| `.claude/agents/qa-verifier.md` | Subagent loop lint/test/build/seo-verify |
| `.claude/agents/pipeline-medic.md` | Subagent chẩn đoán + fix news/scraper/translate pipeline |
| `.claude/agents/growth-analyst.md` | Subagent GSC/GA4 digest + content ideas |
| `.claude/commands/publish-post.md` | `/publish-post <topic>` — chạy trọn Loop 1 |
| `.claude/commands/ship-feature.md` | `/ship-feature <spec>` — chạy trọn Loop 2 |
| `.claude/commands/pipeline-check.md` | `/pipeline-check` — chạy trọn Loop 3 |
| `.claude/commands/seo-loop.md` | `/seo-loop` — audit + fix + verify SEO |

## Cowork scheduled tasks (đề xuất — tạo khi anh duyệt)

| Task | Lịch (ICT) | Nội dung |
|---|---|---|
| Daily SEO health | 08:00 hằng ngày | Chạy seo-verify prod, check sitemap, báo nếu fail |
| Pipeline watch | 09:00 hằng ngày | Loop 3 rút gọn: news/translate/scraper có dữ liệu mới? |
| Weekly growth digest | Thứ 2, 08:30 | Loop 4 weekly: GSC + GA4 report + content ideas |

## Cách dùng

```sh
# Trong Claude Code tại repo:
/publish-post PPA Tour Asia Hanoi Cup recap   # Loop 1
/ship-feature <mô tả feature>                  # Loop 2
/pipeline-check                                # Loop 3
/seo-loop                                      # SEO audit + fix

# Hoặc gọi đích danh subagent:
> Use the qa-verifier agent to check this branch
```

## Guardrails chung (mọi agent phải tuân thủ)

- KHÔNG set `verify_jwt = true` trên các function ES256 workaround.
- KHÔNG đụng `prerender-worker` legacy.
- KHÔNG auto-merge DUPR PRs (#114–#122).
- KHÔNG sửa `*.legacy.tsx`.
- KHÔNG dùng non-www URL trong code.
- Bump `pr:v6` cache version khi đổi SSR output.
- Code deliverable = file hoàn chỉnh, không snippet.
