# CodeQL backlog — 28 alert → 0

> Slug: `codeql-backlog` · Ngày: `2026-07-17` · Trạng thái: `draft`
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài chính xác: xem `external/*.meta.json`.
> Model thiếu key trong lần chạy này: `none`
>
> **Raw audit trail** (đọc để kiểm tra bản tổng hợp này có trung thực không):
> `round1/*.md` — output độc lập vòng 1 · `round2/*.json` — đối chất
> `external/*.md` — prompt gửi đi + reply GPT-5.6 (+ `.meta.json` pin model ID) · `debate.json` — ledger

---

## 0. 🔶 Cần anh quyết

Không có bất đồng nào còn mở — cả 2 bất đồng (D1, D2) đều giải quyết bằng bằng chứng ở vòng 2 (architect concede sau khi tự chạy regex + mở file). Xem mục 7.

Một quyết định vận hành duy nhất cần anh (vì tier RED): **PR3 (workers) deploy bằng `wrangler` thủ công, không có PR gate, không có nút rollback** — pipeline dừng chờ anh duyệt trước khi chạm workers. 3 PR còn lại AMBER, đi gate bình thường.

---

## 1. Ý tưởng gốc

"đọc handoff và memory, tiếp tục các tác vụ cải tiến" → Cuong chốt: chạy lần lượt 4 cụm, cụm 1 = CodeQL backlog.

**Làm rõ ở bước 0:**

| Hỏi | Trả lời |
|---|---|
| Ai dùng | Task nội bộ an ninh/chất lượng; beneficiary = mọi user + Cuong (main sạch alert) |
| Đau ở đâu | 28 alert mở trên main từ sau QA-02; 7 stack-trace-exposure |
| Thành công = | 28 → 0 (fix hoặc dismiss có lý do ghi rõ) |
| Ràng buộc | Prod đang chạy; không phá error contract client đang đọc; đổi `_shared/` = redeploy ALL ~50 functions |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🔴 RED (chỉ vì nhóm workers — 3 PR kia 🟡 AMBER) |
| **Khuyến nghị** | Option A — fix inline tại nguồn taint, 4 PR theo ranh giới deploy + 1 mẻ dismiss; KHÔNG chạm `_shared/` |
| **Công sức** | 3–4 nửa ngày |
| **Rủi ro lớn nhất** | Worker deploy drift: merge fix → CodeQL xanh nhưng worker chạy bản cũ vẫn leak (dashboard xanh giả) |
| **Auto-merge** | PR1/2/4 + dismiss: được sau gate · **PR3 workers: chặn — cần Cuong duyệt + `wrangler deploy` + probe** |

🔴 RED của cụm này KHÔNG phải migration — là "Worker đã deploy không revert được bằng git revert" (phải deploy lại từ checkout tốt).

---

## 3. Đã có sẵn gì (recon)

28 alert thật trên `cuongnguyen84/pickle-hub-pro` (lấy qua `gh api code-scanning/alerts`). Đính chính so với brief ban đầu:

- Chỉ **4/7** stack-trace-exposure nằm ở `supabase/functions/`; **3 cái ở Cloudflare Workers** (`social-poster`, `secret-sync`, `pro-tour-scraper`) — surface khác hoàn toàn.
- Không alert nào trên function "Public (no auth)" thật sự — toàn internal/admin/HMAC/cron. **Không có P0.**
- Không có helper xử lý lỗi an toàn dùng chung: pattern `json()/jsonResponse()` trả `err.message` copy-paste ở 6 vị trí.
- Alert #17 sink ở `_shared/auth.ts:56` nhưng **source taint ở 3 caller DUPR** — sửa caller là alert tắt, không cần đụng `_shared/`.

**Ràng buộc đã ghi trong repo:** `deploy-guard.yml:60-66` — diff `_shared/` → redeploy tuần tự ALL ~50 functions dưới `timeout-minutes: 15`, `set -e`, không atomic. `workers/**` bị deploy-guard loại trừ — wrangler thủ công.

Chi tiết từng alert: `round1/idea-recon.md`.

---

## 4. Phương án (solution-architect)

### Option A — Fix inline theo nhóm surface + dismiss có tài liệu ⭐

Effort: 3–4 nửa ngày · Data: none (không migration/RLS)

- **PR0 (thêm sau debate): #24 safeRedirect** — 1 dòng regex `src/lib/auth/safeRedirect.ts:35` + test. Đứng riêng vì là bug sống (xem D1).
- **PR1 — DUPR edge cluster:** redact `err.message` tại `dupr-webhook-test-fire:135`, `dupr-partner-token:52`, `dupr-webhook-register:77` (body → `{error:"internal_error"}`, giữ `console.error` full); escape `\` trong ILIKE `dupr-user-search:156`. Chỉ 3–4 function redeploy.
- **PR2 — content-pipeline edge:** `send-blog-blast`, `news-translate`… (alert #18/#20/#48/#5).
- **PR3 — workers (RED):** stack-trace 3 worker + nhóm 5 alert sanitizer `news-fetcher stripHtml` (#2/6/7/8/9). Merge xong PHẢI `wrangler deploy` từng worker + HTTP probe.
- **PR4 — frontend + Pages Functions:** `sanitizeBlogHtml` (#45/46/47), `normalizeImageUrl` hostname check (#22/23 — sửa cả 2 bản trùng), mlp-event-scraper (#4).
- **Dismiss có reason:** #1 (log-only), #12/13 (Math.random username-candidate, không phải secret), #14/15/16 (admin-only `<img src>` — xem D2).

Được: blast-radius nhỏ nhất, không đổi response shape client đang đọc (đã grep verify), mỗi PR review 1 buổi tối. Mất: ~20 chỗ sửa tay, 5 PR. Đóng cửa: không — vẫn gom helper sau được nếu muốn.

### Option B — Cheap: chỉ fix cái render ra ngoài, dismiss phần nội bộ

1.5–2 nửa ngày. Toàn bộ 7 stack-trace → dismiss. Về 0 nhanh nhất nhưng để lại 12–14 dismiss = nợ mềm phải đọc-và-tin lại mỗi lần audit. Fallback nếu quỹ thời gian bị bóp.

### Option C — Shared safeError() helper

Thua dứt khoát: trả giá full-fleet redeploy cho một "DRY" không có thật (edge/workers/Pages là 3 module system riêng).

### Khuyến nghị

**Option A.** Điểm mấu chốt cả 3 agent Claude hội tụ độc lập và GPT-5.6 (risk pass) xác minh: **sửa alert #17 tại 3 call-site DUPR, tuyệt đối không chạm `_shared/auth.ts`** — tránh full-fleet redeploy (sự cố 1 pre-mortem) và cắt đường lây qua helper (sự cố 2).

### Increments

1. PR0 safeRedirect — verify: unit test hyphen PASS + `//evil.com`/`javascript:` BLOCK; login về đúng `/tim-ban-choi`.
2. PR1 DUPR — verify: chỉ dupr-* redeploy; CodeQL rescan #17/#10/#11 closed; AdminDuprDashboard search vẫn chạy.
3. PR2 content-pipeline — verify: news-translate cron 1 vòng OK; send-blog-blast test-fire 200.
4. PR3 workers — verify: `wrangler deploy` từng worker + probe; STOP-AND-LOOK xem CodeQL có thật sự clear regex-sanitizer không (nếu còn flag → dismiss "defense-in-depth, input admin-authored" thay vì thêm HTML-parser dependency).
5. PR4 frontend/Pages — verify: `curl -A Googlebot` blog EN+VI 200 + render đúng; nếu SSR output đổi → bump `pr:v29`.
6. Mẻ dismiss — verify: `gh api .../alerts?state=open --jq length` == 0.

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

### Đánh giá tổng thể

Task an ninh nhưng chạm **error contract** edge function ↔ client. Với scope 7 alert thật (backend HMAC, worker cron, admin) — rủi ro UX ≈ 0, không cái nào trên luồng user ẩn danh lưu lượng cao. Rủi ro chỉ bật lên nếu làm shared helper áp rộng (Option C — đã loại).

### Vấn đề

| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| 1 | Blocker (có điều kiện — chỉ khi làm helper) | `RegistrationModal.tsx` (phone-OTP, lưu lượng cao nhất) đọc field `code` từ error body và map sang copy VI. Helper nuốt `code` → "Giải đã đủ người" sập về "Lỗi mạng" | Option A không làm helper → vô hiệu. Nguyên tắc giữ lại: sanitize chỉ strip `err.message`/stack, **luôn giữ machine `code`** |
| 2 | Nên sửa | Nếu sau này có helper: tách `respondWithPublicError`/`respondWithUnexpectedError`, không dùng 1 helper + cờ boolean | follow-up |
| 3 | Nên sửa | Giữ lớp HTTP status (4xx/5xx), đừng gom về 500 | áp dụng ngay trong PR1/PR2 |
| 4 | Nit | Phân biệt `network_error` vs `unexpected_error` cho user 4G ở sân | follow-up |

### Panel đa model

- Claude + GPT-5.6 đồng thuận: giữ `code` machine-readable trong mọi error body; scope 7 alert không đụng luồng user chính.
- Bất đồng nội bộ: GPT-5.6 muốn migrate `InviteTeamDialog` (parse body mong manh) ngay; critic Claude chọn để follow-up vì function đó không nằm trong 28 alert → không nống scope. Critic thắng (đúng nguyên tắc scope).
- **Bonus follow-up đáng ghi backlog:** 83 site client đang rò chuỗi kỹ thuật tiếng Anh ("Edge Function returned a non-2xx status code") cho 95% user Việt — cơ hội làm parser client tập trung + map code→copy VI (đã soạn 8 dòng copy trong `round1/ui-ux-critic.md`). KHÔNG làm trong cụm này.

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🔴 RED (carve-out), nền 🟡 AMBER

Classifier đường dẫn nói: **RED** (vì `workers/**` deploy ngoài pipeline, không PR gate) · Auditor vòng 1 nói AMBER + RED riêng `_shared/auth.ts`. Theo luật "auditor được nâng không được hạ" → **RED cho PR3 workers; AMBER cho PR0/1/2/4 + dismiss.** Option A đã né `_shared/` nên RED-auth.ts không kích hoạt.

| # | Mức | Cơ chế hỏng | User thấy gì | Giảm thiểu |
|---|-----|-------------|--------------|------------|
| 1 | RED | Chạm `_shared/auth.ts` → redeploy tuần tự ~50 func, fail giữa vòng = fleet nửa cũ nửa mới, không rollback nguyên tử | Lỗi rải rác ngẫu nhiên theo function | KHÔNG chạm `_shared/` — fix tại 3 caller |
| 2 | RED | Worker drift: merge fix → CodeQL đóng alert nhưng worker chạy bản cũ vẫn leak (secret-sync giữ service-role key + PAT) | Không thấy gì — đó chính là vấn đề (xanh giả) | PR3 kèm bước bắt buộc `wrangler deploy` + HTTP probe version |
| 3 | AMBER | #24 safeRedirect là bug sống: login xong mất return-to với mọi path có hyphen | Login từ `/tim-ban-choi` xong rơi về `/` | PR0 fix 1 dòng + test (giá trị dương) |
| 4 | AMBER | Regex sanitizer viết sai → ReDoS trong Pages Function SSR → bot nhận 5xx → SEO regression im lặng | Không (chỉ bot) | Đo regex mới trên `content_html` dài nhất < 50ms trước merge |
| 5 | Thấp | `dupr-user-search` ILIKE: user gõ `\` cuối chuỗi → 500 | Search DUPR fail | Escape `\` `%` `_` + test `abc\` |

### SLO bị đe doạ

- SLO 2 (Auth): #24 fix ĐÚNG thì cải thiện (đang hỏng thầm); fix SAI có thể chặn redirect hợp lệ → bắt buộc test cả 2 chiều.
- SLO 1 (Availability): chỉ nếu ReDoS lọt vào SSR path.

### Perf

- Bundle: ~+0 KB (chỉ sửa regex/escape) → 1903.8 / 1970 KB, còn ~66 KB headroom.
- Vietnam p75: không tác động.

### SEO

- Route SSR bị đụng: `functions/_lib/utils.ts` (sanitizeBlogHtml, normalizeImageUrl) phục vụ renderBlog/renderViBlog.
- Bump `pr:v29`? **Có, nếu** output SSR đổi cho page thật (thường không — input blog là admin/Gemini; an toàn nhất là bump khi chạm sanitizer).
- Verify: `curl -A "Googlebot" https://www.thepicklehub.net/blog/<slug>` → 200 + title + og:image + hreflang, so sánh trước/sau.

### Rollback

- Frontend + Pages Functions: `git revert` + Pages redeploy (~5 phút).
- Edge (3 caller DUPR): revert → deploy-guard redeploy 3 function. Không nguyên tử nhưng hẹp.
- **Không revert được:** Workers — `wrangler` không có nút rollback, phải deploy lại từ checkout tốt. → Đây là nguồn RED.

### Phản biện độc lập (GPT-5.6)

- Đã xác minh trong repo: worker/KV drift; taint sinh ở caller không phải `_shared/auth.ts`; **#24 hyphen bug bằng runtime test** (đồng thuận chéo-vendor với risk-auditor — trọng lượng thật); ILIKE `\` → 500.
- Điều chỉnh: GPT xếp HTML sanitizer "highest priority nếu attacker-controlled" — trong repo `sanitizeBlogHtml` nhận input admin/Gemini nên hạ; chỉ `news-fetcher` (HTML nguồn ngoài) giữ ưu tiên cao.

### Pre-mortem — 3 sự cố (chi tiết: `round1/pre-mortem.md`)

1. Deploy-guard timeout giữa loop redeploy-ALL → fleet nửa cũ nửa mới, Telegram alert nói sai bản chất.
2. Helper dùng chung nuốt `code`/`details` của `dupr-link` 4xx → onboarding DUPR đứng im, không exception JS → `errors-telegram-alert` không bao giờ nổ.
3. **Tệ nhất:** worker drift — dashboard 28→0 xanh giả trong khi `secret-sync` bản cũ vẫn rò; là kết cục *mặc định* nếu quên deploy.

Cả 3 đều bị chặn bởi 2 quyết định của Option A: không chạm `_shared/`, và PR3 kèm bước deploy+probe bắt buộc.

---

## 7. Tranh luận trong panel

> Vòng 1 độc lập → vòng 2 đối chất (một vòng). Đồng thuận không phải mục tiêu.
> Luật cưỡng chế bởi `debate-ledger.mjs`: 2 bất đồng · 2 giải quyết bằng bằng chứng · 0 còn mở · ✅ Luật đối chất OK.

| # | Chủ đề | Các phía | Vòng 2 | Trạng thái | Kết luận |
|---|--------|----------|--------|------------|----------|
| D1 | Alert #24 safeRedirect.ts:35 — bug sống phải fix ưu tiên #1, hay char-class thừa vô hại? | **architect**: behavior đúng, sửa 1 dòng cho rẻ hoặc dismiss · **risk-auditor**: bug SỐNG, `/[ -\s]/` match `-`, GPT-5.6 verify runtime độc lập | **architect**: CONCEDE (`safeRedirect.ts:35` + tự chạy `node -e` + trace `FindPlayers.tsx:83`, `Messages.tsx:109`) · **risk-auditor**: HOLD (refine: lỗi UX mất return-to, không phải sập auth) | ✅ RESOLVED_EVIDENCE | #24 là defect sống — fix ưu tiên #1, PR đứng riêng, 1 dòng regex + test 2 chiều |
| D2 | #14/15/16 xss-through-dom admin-only: fix scheme allow-list hay dismiss? | **architect**: fix http/https-only · **risk-auditor**: dismiss, đừng rewrite chỉ để im CodeQL | **architect**: CONCEDE (`AdminViBlogEditor.tsx:282-295,400`, `EditLivestreamDialog.tsx:108-115` — sink `<img src>` không exec, nguồn admin-only) · **risk-auditor**: HOLD (+fix của architect còn chặn `data:image` URI hợp lệ → regress preview) | ✅ RESOLVED_EVIDENCE | Dismiss với reason; không thêm scheme allow-list |

### Bất đồng bị giết ở vòng 2 (ảo — do thiếu thông tin)

Cả D1 lẫn D2: architect vòng 1 kết luận mà không chạy regex / không mở file sink. Vòng 2 tự verify → concede với bằng chứng hợp lệ (ledger chấp nhận, không weasel). Đây là vòng 2 làm đúng việc của nó.

### Bất đồng sống sót

Không.

### Nhượng bộ bị LOẠI

Không có — ledger strict exit 0.

**Ghi chú độc lập:** kết luận "không chạm `_shared/auth.ts`, fix tại caller" được 3 agent Claude tìm ra riêng rẽ VÀ GPT-5.6 verify — nhưng 3 Claude đồng ý nhau chỉ chứng minh chúng cùng là Claude; điểm neo thật là GPT-5.6 (vendor khác) xác minh cùng kết luận, và D1 được GPT-5.6 verify runtime trước cả khi architect concede.

---

## 8. Kế hoạch verify

**Tự động:**

- [ ] `npx eslint <changed>` · `node scripts/check-theline.mjs <changed tsx>`
- [ ] `npx tsc -b --noEmit` (KHÔNG plain tsc — cache cho pass giả)
- [ ] `npm run test` (test mới: safeRedirect 2 chiều, stripHtml, ILIKE escape)
- [ ] `npm run build` + `check-bundle-size.mjs` (kỳ vọng +0 KB)
- [ ] `npm run e2e:smoke`
- [ ] Đo regex sanitizer mới trên `vi_blog_posts.content_html` dài nhất < 50ms
- [ ] Sau merge PR3: `wrangler deploy` từng worker + HTTP probe
- [ ] Sau mỗi PR: `gh api .../code-scanning/alerts?state=open` đếm giảm đúng số kỳ vọng (lưu ý: có thể phải chờ lần scan kế)
- [ ] `curl -A "Googlebot"` blog EN+VI sau PR4; bump `pr:v29` nếu SSR đổi

**Cuong phải tự làm:**

- [ ] Duyệt PR3 (workers — RED, wrangler không rollback được)
- [ ] Smoke login từ `/tim-ban-choi` trên điện thoại thật sau PR0 (về đúng trang, không về `/`)

---

## 9. Sau khi ship

- SHA: · PR: · Ngày:
- Khác kế hoạch:
- Học được:

---

## ⚠️ ĐÍNH CHÍNH SAU KHI SHIP (2026-07-17, orchestrator)

**Kết luận D1 của panel SAI.** Khi bắt tay sửa alert #24, phát hiện: `safeRedirect.ts:35`
chứa **byte control THÔ** trong char class — regex thật là `/[\x00-\x1f\x7f\s]/` (hex dump
`5b 00 2d 1f 7f 5c 73 5d`). Byte NUL còn làm git coi file là binary. Mọi editor/scanner
render nó thành "[ -\s]" — và cả recon, risk-auditor, GPT-5.6 lẫn architect (vòng 2) đều
"runtime verify" bằng cách GÕ LẠI CHUỖI HIỂN THỊ vào node thay vì chạy byte thật.

**Sự thật:** hyphen luôn pass (test có sẵn `/su-kien/foo` xanh trên CI là bằng chứng mâu
thuẫn mà không agent nào đối chiếu); không có bug login-redirect nào tồn tại. Lập trường
VÒNG 1 của architect ("behavior đúng") mới là đúng — nó bị đè bởi một "bằng chứng runtime"
rởm được 2 nguồn độc lập cùng tái tạo (độc lập không cứu được khi cả hai cùng đọc qua một
lớp hiển thị dối).

**Fix đã ship (PR0):** viết lại class bằng escape tường minh `/[\x00-\x1F\x7F\s]/` + pin
test hyphen — hygiene, không phải bug fix. Bài học ghi vào lessons-learned: claim "bug sống"
phải đối chiếu với test suite đang xanh; regex phải verify bằng hexdump khi có nghi ngờ
ký tự vô hình.
