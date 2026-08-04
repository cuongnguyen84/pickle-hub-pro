# Cải thiện checklist "SEO follow-up sau PR #515" + tooling phân loại GSC

> Slug: `seo-followup-checklist-v2` · Ngày: `2026-08-02` · Trạng thái: `shipped` (gói docs+tooling)
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài: `gpt-5.6-sol` (xem `external/`).
> Model thiếu key trong lần chạy này: `none`
> ⚠️ Quy trình: `scripts/agents/debate-ledger.mjs`, `risk-tier.mjs`, `ask-model.mjs` KHÔNG tồn tại
> trong repo — ledger cưỡng chế thủ công, model ngoài gọi trực tiếp qua curl. (Gap đã biết:
> memory `idea-pipeline-missing-scripts`.)
>
> **Raw audit trail:** `round1/*.md` · `round2/*.json` · `external/*.md` · `debate.json`

---

## 0. 🔶 Cần anh quyết

Panel đối chất xong: **cả 3 bất đồng chính đều RESOLVED bằng bằng chứng** (chi tiết mục 7).
Còn 2 thứ cần anh, không phải bất đồng kỹ thuật mà là quyết định của chủ nhà:

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| Q1 | **Credential GSC.** Trong lúc đối chất, 3 agent tự tìm thấy và DÙNG SA key `~/Downloads/thepicklehub-dee20-68a66e81d1d6.json` (firebase-adminsdk, có quyền siteFullUser trên `sc-domain:thepicklehub.net`) để gọi URL Inspection API read-only. Harness gắn security warning. Đề xuất của architect: copy key vào `.claude/secrets.local.gsc-ga4-sa.json` (path mặc định của `gsc_report.py`, đã gitignore) để 3 script `scripts/seo/` hết chết. | Duyệt: key này được phép dùng cho tooling SEO local | Không duyệt: script chỉ chạy tầng 1 offline, tầng 2 API bỏ | Key Firebase admin nằm ở Downloads vốn đã là rủi ro; nếu anh không muốn agent đụng, nên nói rõ và cân nhắc tạo SA riêng chỉ có scope `webmasters.readonly` |
| Q2 | **Thứ tự sửa cụm VI** (ND1, chưa qua đối chất đủ vòng). auditor + architect hội tụ độc lập: 844 trang `/vi/san/*` nhận **0 internal link** vì `venues.ts` hardcode prefix `/san/` (L174, L445, L693…) → sửa 3-6 dòng trước, rewrite title sau. ui-ux-critic (#6) muốn phân hoá title VI/EN trước và chưa được phản hồi (không có vòng 3). | Links-first (khuyến nghị của em: rẻ hơn, 0 rủi ro deindex, tách biến số cho phép đo) | Title-first | Hai fix không loại trừ nhau — sai thứ tự chỉ làm nhiễu phép đo, không mất dữ liệu |

---

## 1. Ý tưởng gốc

"em có ý tưởng gì về việc cải thiện checklist trên khoogn" — checklist = mục "SEO follow-up
sau PR #515" trong TODO.md (commit `f4c20b19`, nhánh `docs/seo-followup-checklist`).

**Làm rõ ở bước 0:**

| Hỏi | Trả lời |
|---|---|
| Ai dùng | Cuong / agent autonomous thi hành checklist |
| Đau ở đâu | Checklist gốc mơ hồ (không nói làm ở đâu), vài mục sai kỹ thuật, mục chính không chạy được với export đang có |
| Thành công = | Thi hành được không cần rà tay từng URL; bước kỹ thuật đúng; baseline GSC 01/08 giữ làm mốc |
| Ràng buộc | Docs + tooling (KHÔNG thực thi SEO ngay); export GSC local có sẵn; giữ workflow Googlebot-curl |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🟢 GREEN cho gói docs + tooling · 🔴 **RED cho giai đoạn THI HÀNH checklist** (noindex/301/title trên cụm `/san` = 56% click, hỏng thì `git revert` không cứu — phục hồi index tính bằng tuần) |
| **Khuyến nghị** | Option A refined — checklist viết lại thành `docs/seo-followup-2026-08.md` + `scripts/seo/index_coverage.py` 2 tầng + **3 guard CI (~15 dòng) ship TRƯỚC** |
| **Công sức** | 3,5 nửa ngày (0,5 guard CI · 1 checklist · 2 script) |
| **Rủi ro lớn nhất** | Panel phát hiện **bug đang sống trên prod**: title venue cắt byte (5/10 sân mẫu ship title cụt hôm nay) — mọi sprint CTR chạy trên nền này sẽ kết luận ngược |
| **Auto-merge** | Gói docs+tooling: được sau gate. Giai đoạn thi hành: **Chặn — từng nhóm việc cần Cuong duyệt riêng** |

---

## 3. Đã có sẵn gì (recon — ĐÃ hiệu chỉnh sau vòng 2)

**Recon vòng 1 có 1 claim SAI bị cả 3 agent bác độc lập:** `/vi/blog/singapore-open-2026`
TỒN TẠI (curl 200, 52 click — trang VI top site; slug nằm trong `vi_blog_posts`, không phải
file repo). Checklist gốc trích URL **đúng**. Bài học: recon chỉ grep repo, không curl prod.

**Prior art:** `scripts/seo/gsc_report.py` + `seo_verify.py` + `canonical_monitor.py` (cả 3
đang CHẾT trên máy Cuong — path SA sai + lỗi cert Python; xem mục 4) · `isThinVenue()`
(`venues.ts:62-72`) predicate chung noindex+sitemap · `internalLinks` field trong blog posts ·
tiền lệ 301 map trong `_middleware.ts:365-455` · `tests/seo.spec.ts` sweep first-loc.

**Sự thật nền (đo từ Trang.csv 01/08):** site sống nhờ cụm **`/san/*`: 56% click, 83%
impression** — không phải bài blog như checklist gốc giả định. Baseline 01/08 là ảnh chụp
GIỮA một đợt sửa (GONE_EXACT ship 30/07, validation GSC "Đã bắt đầu" đang chạy).

**Ràng buộc đã ghi trong repo:** cấm GSC Live Test · cache `pr:v32` TTL 6h, `?nocache=1`
phải đúng `"1"` · bot bypass `public/_redirects` (middleware chạy trước — repo tự ghi bài
học 3-4 lần) · mốc SEO-CLUSTER-READ 23/08 (`docs/milestones.md:17`).

---

## 4. Phương án (solution-architect, đã cập nhật theo vòng 2)

### Option A refined (KHUYẾN NGHỊ) — guards → checklist → script 2 tầng

Effort: 3,5 nửa ngày · Files: `tests/seo.spec.ts`, `src/__tests__/redirect-parity.test.ts`,
`docs/seo-followup-2026-08.md`, `TODO.md` (con trỏ 3 dòng), `scripts/seo/index_coverage.py`,
`scripts/seo/SETUP.md` · Data: none (0 KB bundle, không route mới)

**Increment 1 — 3 guard CI (~15 dòng, ship TRƯỚC, không phụ thuộc gì):**
1. Floor `<loc>` per-segment trong sweep `tests/seo.spec.ts`: venues ≥ **1500**, news ≥ 700,
   matches ≥ 200 (số hôm nay: 1688/1000/246; lấy sàn CHẶT của auditor — sàn 900 cho phép mất
   47% inventory mà CI vẫn xanh). Sweep lấy thêm `<loc>` CUỐI + 1 ngẫu nhiên (hiện chỉ lấy
   đầu tiên = luôn lấy hàng khoẻ nhất do sort DESC).
2. Test `_redirects`: dòng non-comment cuối phải là `/* /index.html 200` (rule sau nó = chết).
3. Assert title không có đuôi cụt `/[|·–]\s*…$/` trên các URL sweep.

**Increment 2 — checklist v3** (`docs/seo-followup-2026-08.md`, TODO.md giữ con trỏ):
cấu trúc mỗi mục = `[nơi làm]` prefix + hành động + verify-tại-chỗ + done-criteria là lệnh
chạy được. Nội dung đã sửa hết lỗi kỹ thuật — xem "Nội dung checklist v3" dưới.

**Increment 3 — `scripts/seo/index_coverage.py` 2 tầng:**
- Tầng 1 (offline, chạy độc lập): sitemap segments × `Trang.csv` × HTTP status curl Googlebot
  (`--limit` mặc định ≤50, tuần tự, delay). Ba cột độc lập, KHÔNG in nhãn coverage.
- Tầng 2 (`--inspect`, cần credential): URL Inspection API — pin `GSC_SITE=sc-domain:thepicklehub.net`
  (www chỉ siteRestrictedUser → 403) + `languageCode=en`, normalize `coverageState` sang enum nội bộ
  (INDEXED/DISCOVERED/CRAWLED_NOT_INDEXED/UNKNOWN/EXCLUDED), hard-fail chuỗi lạ, sqlite cache +
  per-call timeout cứng (curl 7,2s đều nhưng python requests từng treo 449s) + resume. ~22 phút/180 URL.
- Exit codes theo convention `gsc_report.py`: 0 ok/empty · 2 tham số · 3 file · 4 schema ·
  5 thiếu nguồn per-URL · 6 safety gate (ứng viên noindex có impression > 0 → từ chối, trừ `--force`).
- `--performance-dir` bắt buộc (không auto-guess export cũ); in ngày export ra stderr dòng đầu.
- Nhóm 61 URL 404: API không enumerate được → hướng dẫn export tay 1 lần trong error message
  (exit 5) với nhãn UI tiếng Việt.
- Kèm fix 1 dòng: credential path (`GOOGLE_SA_JSON` hoặc copy key — **chờ Q1**) + ghi
  `scripts/seo/SETUP.md`; fix cert Python (`Install Certificates.command`) cho 2 script còn lại.

### Option B — bản rẻ (chỉ tầng 1 offline + checklist)

Không phân biệt được 42 Crawled vs 138 Discovered — đúng phần giá trị nhất. Chênh với A chỉ
1,5 nửa ngày. Thua. (Nếu Q1 = không duyệt credential → tự động rơi về B.)

### Option C — siết thin-gate news/matches (increment 4 cũ)

**ĐÃ BỎ bởi chính architect ở vòng 2:** đo 12 URL news ngẫu nhiên → chỉ 18% chưa index
(gate đòi ≥70%). Tiền đề "news mỏng" chết bằng đo đạc. Không còn trên bàn.

### Nội dung checklist v3 (điểm khác checklist gốc)

1. **[repo] Sửa 2 bug sống trước mọi việc khác** *(mới — panel phát hiện)*:
   - Title/desc venue cắt byte: xoá tiền-kiểm `.length <= 60` ở `venues.ts:306-309` (luôn gọi
     `buildTitle`), đổi `seo-helpers.ts:169` sang đếm byte. Bug #468 tái phát qua caller đi vòng.
   - Internal link prefix theo lang ở `venues.ts:174/445/693` *(chờ Q2)*.
   - (rẻ, độc lập) Thêm filter `qt-*`/`-test` vào related-matches `match-page.ts:221-224` —
     đang phát link tới URL mà sitemap cố giấu.
2. **[terminal] Index coverage** — chạy `index_coverage.py`; bước ĐẦU: đối chiếu 138 Discovered
   với tập thin-venue stub (nhiều khả năng là noindex CHỦ Ý → disposition "đúng ý đồ"); ưu tiên
   42 Crawled. **Cấm tuyệt đối** vòng noindex thứ hai trên venues; tiêu chí thin chỉ được là
   hình dạng dữ liệu, không bao giờ là click/impression.
3. **[GSC UI → repo] 404 hygiene** — export tay 1 lần danh sách 61 URL; **301 phải vào
   `_middleware.ts`** (bot bypass `_redirects`), cùng commit mirror `_redirects` cho người;
   grep `GONE_EXACT` trước — ~24/61 URL đã 410 chủ ý từ 30/07, GIỮ 410; chờ validation GSC
   đang chạy ra kết quả hoặc ghi lý do restart. **Freeze 6 URL cohort bracket** (danh sách
   trong `debate.json` D2) tới sau 23/08 — đặc biệt canonical-host non-www.
4. **[repo] CTR** — sau khi mục 1 xong: phân hoá title VI/EN (VI thêm `Sân `, thêm quận/tỉnh,
   normalize CAPS — copy đề xuất trong `round1/ui-ux-critic.md`); done-criteria = CTR ≥ 50%
   kỳ vọng theo VỊ TRÍ (không phải số phẳng 2,5%); tách mục local-pack riêng cho query 0% ở pos 5.
5. **[terminal] Cache** — **KHÔNG bump `pr:v32`** (bump = flush 3176 URL, cold-render 8s budget,
   quá hạn bot nhận SPA shell); để TTL 6h tự cuốn hoặc warm `?nocache=1` lô ≤50 path.
6. **[GSC] CWV field-data ≥28 ngày** — giữ nguyên từ checklist gốc (mục này vốn đúng).
7. **[terminal] Verify** — mỗi mục có verify tại chỗ; sample ≥10 URL `/san/*` ngẫu nhiên cả 2
   ngôn ngữ (không tin first-loc); tracker organic thủ công: clicks `/san` theo tuần (không SLO
   nào bắt được thiệt hại SEO — grep `docs/slo.md` → 0 kết quả organic).

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

**Đánh giá:** checklist gốc là "ghi chú của người đã biết việc", không phải tài liệu thi hành —
5/7 mục không nói làm ở đâu. Nguyên tắc v3: một checkbox = một hành động = một bằng chứng.

**Luồng thật đang hỏng (phát hiện giá trị nhất của critic):** người Sài Gòn gõ
`bsb pickleball club` → rơi vào trang **EN** (383 impr vs VI 50) vì title EN/VI trùng từng
byte + x-default trỏ EN (+ vòng 2 bổ sung: 844 trang VI 0 internal inlink). 17 vấn đề chi tiết
+ bảng copy title dán được: `round1/ui-ux-critic.md`.

**CLI:** stdout JSON thuần / stderr cho người; empty ≠ error; offline-first, `--online` tường minh;
error message tiếng Anh (tiền lệ 3 script sẵn có), nhãn GSC UI trong hướng dẫn giữ tiếng Việt;
thuật ngữ trong docs ghi song song VI (EN).

**Panel đa model:** Claude + GPT-5.6 đồng thuận độc lập: (1) coverage không chạy được từ
aggregate export — cấm bịa nhãn; (2) `isThinVenue()` là định nghĩa duy nhất của thin;
(3) không bump `pr:v33` global. GPT tìm ra mà Claude sót: bot bypass `_redirects`;
GONE_EXACT ship 2 ngày trước export → baseline là ảnh giữa đợt sửa; nhiễm mốc 23/08.
Bất đồng Claude-vs-GPT về title-rewrite: critic giữ "phân hoá ngôn ngữ trước" — vòng 2
nghiêng thêm về phía critic nhưng bổ sung tầng sâu hơn (internal link, Q2).

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🟢 gói docs+tooling · 🔴 giai đoạn thi hành

Classifier `risk-tier.mjs` không chạy được (không tồn tại) — auditor tự gán, orchestrator
không hạ. RED thi hành vì: thiệt hại index **không revert được bằng git** (recrawl 2-6 tuần,
mất position history, mất counterfactual baseline) và **không SLO nào canh organic** — thiệt
hại lớn nhất có thể xảy ra mà không alert nào kêu.

Top rủi ro (bảng đầy đủ 9 mục: `round1/risk-auditor.md`):

| # | Mức | Cơ chế | Giảm thiểu (đã vào checklist v3) |
|---|-----|--------|----------------------------------|
| 1 | Cao | Vòng noindex 2 trên venues ăn vào 462 URL 0-click nhưng 19.611 impr | Cấm tuyệt đối; tiêu chí data-shape only |
| 2 | Cao | 301 trong `_redirects` — bot không bao giờ thấy | 301 vào `_middleware.ts`, verify curl Googlebot |
| 3 | Cao | Redirect map chạy TRƯỚC `isGoneUrl` → 301 mới âm thầm đè 410 chủ ý | grep GONE_EXACT trước mọi 301 |
| 4 | Cao | Script in nhãn bịa từ aggregate → hành động nhầm nhóm | exit 5, cấm nhãn không nguồn per-URL |
| 5 | TB | Bump pr:v33 → mass cold-render → SPA shell cho bot | Cấm bump; TTL 6h / nocache lô nhỏ |
| 6 | TB | Sự cố 3 pre-mortem: title cắt byte ĐANG SỐNG → sprint CTR kết luận ngược, verdict sai ghi vào milestone | Fix venues.ts:306-309 TRƯỚC mọi việc title |

### Perf / SEO / Rollback
Bundle +0 KB · không route mới · gói docs+tooling revert 5 phút · thi hành: xem RED ở trên.
Verify chuẩn: `curl -A "Googlebot" https://www.thepicklehub.net/vi/san/<slug>` → 200 + title
mới + hreflang + KHÔNG có meta noindex.

### Phản biện GPT-5.6 (qua risk-auditor)
Giữ sau verify: bot bypass `_redirects`, aggregate không có URL, bump v33 nguy hiểm, first-loc
sweep mù. Bác bỏ: chiều GONE_EXACT (GPT nói ngược cơ chế), "freeze toàn bộ tới 23/08" (quá
rộng), sai domain `.com`, "render-timeout im lặng" (có Telegram fingerprint alert ~10-20 phút).

---

## 7. Tranh luận trong panel

> Ledger cưỡng chế THỦ CÔNG (`debate-ledger.mjs` không tồn tại — gap pipeline đã biết).
> Kiểm tra từng move: mọi CONCEDE/REFINE đều kèm bằng chứng tái lập được.

| ID | Chủ đề | Vòng 2 | Kết quả |
|----|--------|--------|---------|
| D1 | Nguồn dữ liệu classifier | architect REFINE (25/25 call 200, repro script) · auditor **CONCEDE có bằng chứng** (tự ký JWT gọi API) · critic REFINE (tự chạy API, rút export-tay-mặc-định) | **RESOLVED** — API 2 tầng; export tay chỉ cho nhóm 404; fix path credential (chờ Q1) |
| D2 | Freeze mốc 23/08 | auditor HOLD (cohort = 6 URL, query Search Analytics thật; phát hiện kênh non-www) · critic REFINE (thừa nhận đọc sai PREDICATE, bỏ freeze toàn site) | **RESOLVED** — freeze theo danh sách 6 URL; cấm bump cache global trước 23/08 |
| D3 | Vòng thin-gate 2 | architect REFINE (**tự đo giết increment 4 của mình**: 18% ≠ ≥70%) · auditor REFINE (cấm venues, điều kiện cho news/matches) · pre-mortem REFINE (6 điều kiện, cấm cron-column, cấm share predicate) | **RESOLVED** — increment 4 bỏ; tiền điều kiện hợp nhất cho mọi thay đổi gate tương lai |

### Bất đồng bị giết ở vòng 2 (ảo — thiếu thông tin)
D1 toàn bộ: auditor thiếu một `ls ~/Downloads`; architect vòng 1 thiếu giới hạn enumerate.
ND4 (path credential) là bất đồng ảo kinh điển — cả hai đúng, nhìn hai nửa sự thật.

### Bất đồng sống sót → mục 0
Q2 (thứ tự links-first vs title-first) — ND1 sinh ra ở vòng 2, không có vòng 3 để critic
phản hồi. Hai fix không loại trừ nhau; chỉ là thứ tự đo.

### Nhượng bộ bị LOẠI
Không có. (CONCEDE duy nhất — auditor D1 — kèm bằng chứng tự chạy API, hợp lệ.)

### Hội tụ đa nguồn đáng tin (ghi nhận một lần)
- Recon sai slug: 3 agent bác độc lập bằng curl.
- coverageState localized: 3 agent tự đo độc lập, cùng kết quả (ND2).
- Không bump pr:v33: auditor + critic + GPT-5.6 ×2 — cross-vendor.
- Bot bypass `_redirects`: GPT-5.6 (không thấy repo) + auditor (đọc repo) — cross-vendor thật sự.

---

## 8. Kế hoạch verify

**Tự động (gói docs+tooling):**
- [ ] `npx eslint` các file sửa · `npx tsc -b --noEmit` · `npm run test` (guard CI mới phải đỏ khi mô phỏng sitemap co / rule sau SPA-fallback)
- [ ] `python3 scripts/seo/index_coverage.py --performance-dir ~/Downloads/https___www.thepicklehub.net_-Performance-on-Search-2026-08-01` → tầng 1 chạy, exit 0, KHÔNG in nhãn coverage
- [ ] Đưa thư mục Coverage aggregate → exit 5 kèm hướng dẫn
- [ ] Ứng viên noindex có impression > 0 → exit 6
- [ ] `--inspect` không credential → exit 3 fail-loud kèm câu lệnh sửa
- [ ] `--inspect` có credential (sau Q1): 5 URL mẫu → enum đúng, sqlite ghi, chạy lại → cache hit

**Cuong phải tự làm:**
- [ ] Quyết Q1 (credential) + Q2 (thứ tự VI fix)
- [ ] Export tay 1 lần danh sách 61 URL 404 từ GSC UI (nhãn tiếng Việt: Lập chỉ mục → Trang → Không tìm thấy (404) → Xuất)
- [ ] Duyệt riêng TỪNG nhóm việc thi hành (RED): 301 batch, title batch, mọi thứ đụng index

---

## 9. Sau khi ship
- SHA: `3c2dac23` · PR: #530 · Ngày: 2026-08-03 (Cuong tự squash-merge; quality.yml waived — coverage 75.04% là nợ main từ 30/07)
- Khác kế hoạch:
  - Q1: SA key được duyệt + copy vào `.claude/secrets.local.gsc-ga4-sa.json` → cả 3 script scripts/seo/ cũ hết chết. Q2: links-first.
  - `index_coverage.py` chuyển toàn bộ network sang `curl` subprocess (python urllib/requests treo hàng phút trên máy này).
  - Header Trang.csv thật là `Trang hàng đầu` — schema guard exit 4 bắt được ngay lần chạy đầu.
  - security.yml được BẬT LẠI giữa chừng theo lệnh Cuong → lộ CodeQL finding có sẵn từ main (false positive, baseline với reason Cuong duyệt) + phát hiện CodeQL không quét Python.
  - Guard title-cụt tạm exempt venues (bug cắt byte đang sống) — gỡ cùng PR fix checklist mục 1.
- Học được (đã append `.claude/memory/lessons-learned.md` 03/08): python-HTTP-treo→curl; GSC chuỗi bản địa hoá; gate khoá hàm không khoá caller; gate lấy mẫu hàng khoẻ nhất; soak so giờ liền kề.
- Post-deploy: / 200 · /feed 200 · Googlebot blog route 200 + title/og/hreflang ✅ · seo-verify 40/0 · soak 30' CLEAN (0 signature mới).
