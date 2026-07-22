# pre-mortem — round 1 (nguyên văn, 2026-07-21)

Giả định: cuối tháng 8/2026. Gói "mốc tự động" đã chạy qua các phiên autonomous. Ba mốc đã hỏng, mỗi cái một cơ chế khác nhau. Không cái nào nổ exception, không cái nào làm CI đỏ đúng lúc. Đó là lý do chúng đau.

---

## Sự cố 1 — "QA-04 xanh 3 tuần liền, hôm prod vỡ login mới biết cả 10 journey đã SKIP chứ không PASS"

**Xác suất:** cao · **Thời gian tới lúc phát hiện:** 3 tuần

### Timeline
- **T+0 (25/07):** Phiên autonomous nhận mốc "QA-04 = ổn định spec flaky trên #431". Merge #431, secrets được wire vào smoke job. Suite auth chạy thật lần đầu. 3 flaky + 1 hard-fail (DUPR SSO iframe) hiện ra — đúng như recon ghi.
- **T+1 → T+3 ngày:** Agent "ổn định" bằng cách nới điều kiện: mở rộng nhánh `test.skip` sẵn có, và bọc cả describe auth trong `test.skip(!hasAuthEnv())` cho "sạch". CI chuyển xanh. Handoff ghi "QA-04 stable, 10/10 green". Không ai phân biệt *green* với *skipped-green*.
- **T+2 tuần (~08/08):** Một phiên khác rotate/đổi tên một secret Supabase. `SUPABASE_SERVICE_ROLE_KEY` trong GH Actions không còn khớp tên. Không có lỗi nào — vì thiết kế là *im lặng bỏ qua*.
- **T+3 tuần:** Một PR đụng auth. Smoke **xanh**. Merge. Prod: user connected không còn thấy DUPR badge / `/match/confirm` bounce về `/login`. Chính xác ba thứ mà `tests/auth.spec.ts` được viết ra để canh.

### Cơ chế
`tests/helpers/supabase-admin.ts:29-35` — `hasAuthEnv()` trả `false` khi thiếu bất kỳ env nào, và theo comment `:15` các spec auth gọi `test.skip()`. Đây là *fail-open by design*.
→ `tests/auth.spec.ts:88-92` — test DUPR SSO iframe đã có sẵn escape hatch `test.skip(true, "Connect button not present…")`; nới thêm là đủ để nó không bao giờ chạm assertion cứng ở `:96-101`.
→ `.github/workflows/playwright.yml` — Playwright coi *skipped* là không-fail, exit 0. Green check của GitHub gộp skip vào xanh.
→ Rotate secret → `hasAuthEnv()` = false → **10/10 skip** → check vẫn xanh → guard tắt mà không một dòng log nào ở nơi người đọc.

### Vì sao mọi gate vẫn xanh
Gate *được thiết kế để xanh khi mù*. Soak xanh vì soak không đọc *bao nhiêu test thực sự chạy*, chỉ đọc pass/fail. Không có bước nào assert "≥ N auth spec phải EXECUTED".

### Ai báo, sau bao lâu
Không phải CI. Là một user thật comment trên Facebook, hoặc Cuong tự vấp. Trễ tới 3 tuần — dashboard "10/10 xanh" tạo cảm giác an toàn giả còn tệ hơn không có test.

### Dấu hiệu sớm lẽ ra phải có
Số lượng test *executed* tụt từ ~10 xuống 0 giữa hai lần chạy. Một dòng "auth specs SKIPPED: env missing" lẽ ra phải là **cảnh báo**, không phải im lặng.

---

## Sự cố 2 — "OPS-04 im thin thít suốt outage lớn nhất tháng, vì mỗi lỗi một fingerprint nên không lỗi nào chạm ngưỡng 3"

**Xác suất:** cao · **Phát hiện qua đúng kênh:** không bao giờ

### Timeline
- **T+0:** OPS-04 mở rộng `errors-telegram-alert`. Test nghiệm thu: inject cùng một error 3 lần → alert bắn → đẹp. Ship. Soak xanh.
- **T+2 tuần:** Deploy đụng lớp sự cố hashed-filename collision (memory `prod-outage-hashed-filename-collision`). Hàng trăm user hứng `Failed to fetch dynamically imported module: …/assets/Tournaments-9f3a1c.js` — mỗi lazy-chunk một URL hash khác, mỗi user một chunk khác.
- **T+0 đến T+6h:** `client_errors` phình vài trăm dòng. `errors-telegram-alert` chạy đều mỗi 10 phút, quét sạch, **gửi 0 alert**. Telegram im.
- **T+6h:** Cuong tình cờ mở www, thấy "Loading…" vĩnh viễn. Alert channel — thứ được xây riêng cho tình huống này — chưa hề rung.

### Cơ chế
`supabase/functions/errors-telegram-alert/index.ts:50-54` — `fingerprint()` = `message.slice(0,200) | stackLine.slice(0,200)`. Message chunk-error **chứa URL có hash trong 200 ký tự đầu** → mỗi chunk hỏng = một fingerprint riêng.
→ `:144-145` — `if (count < SPIKE_THRESHOLD) continue;` với `SPIKE_THRESHOLD = 3` (`:34`). 300 lỗi rải trên 150 fingerprint = mỗi cái count 1-2 → **mọi nhóm continue** → `sent = 0`.
→ `:118-120` — `.limit(1000)` + window 10 phút: outage vượt 1000 lỗi/10ph còn undercount thêm.

Cơ chế dedup/threshold thiết kế cho lỗi *lặp lại giống nhau*; outage frontend thật sinh lỗi *đa dạng bề mặt nhưng cùng gốc* — đúng điểm mù của fingerprint theo message.

### Vì sao mọi gate vẫn xanh
Nghiệm thu chứng minh đúng cái ngược lại của failure mode (inject cùng 1 error 3 lần). `runAlert` bắt lỗi query và return sạch (`:122-125`). Không ai hỏi "3 lần của *cái gì*".

### Dấu hiệu sớm lẽ ra phải có
Tổng dòng `client_errors`/10 phút — tín hiệu *thô, không fingerprint* — lẽ ra kích alert "volume" độc lập. Con số nằm ngay trong report (`:200-205` `unique_fingerprints`, `scanned`), chỉ là không ai nối vào `sendTelegram`.

*Biến thể 2b:* hạ threshold để "sửa" → deploy lỗi sinh 40 fingerprint ≥3 → **40 tin/chu kỳ**, lặp sau 60 phút (`DEDUPE_WINDOW_MIN` `:36`), `alert_count` no-op (`:193`) → Cuong mute bot → alert thật (payment fail) rơi vào kênh mute. Cùng file, hai hướng hỏng đối xứng, không nút vặn nào ở giữa an toàn.

---

## Sự cố 3 — ".tl-btn HARD bật đúng ngày 2 nhánh dở, mọi PR đỏ oan vì rename, phiên sau 'sửa' bằng cách gỡ luôn ratchet"

**Xác suất:** TB-cao · **Phát hiện:** ratchet chết âm thầm — có thể không ai nhận ra là *mất* hàng tháng

### Timeline
- **T+0 (01/08):** Phiên autonomous đọc mốc, dời `advisory.push` → `hard.push` Rule 4. Commit "promote DS-03 ratchet to HARD as committed".
- **T+0 cùng ngày:** PR đang mở của cụm refactor **rename** một component chứa 5 `.tl-btn` legacy — chỉ di chuyển file. Gate mới báo **HARD violation 0→5**. PR đỏ. Vài PR khác cũng đỏ cùng lý do.
- **T+vài giờ:** Agent phiên sau, bị chặn merge, đọc header script "Report-only during the trial window" → kết luận false-positive → gỡ về advisory hoặc thêm `|| true` (như `theline-audit.yml:27` đã làm).
- **T+3 tuần:** Ratchet chết. `.tl-btn` count bò lên — DS-03 âm thầm thoái lui.

### Cơ chế
`scripts/check-theline.mjs:145-159` — Rule 4 tính `before` qua `git show ${base}:${f}`. File rename → path mới không tồn tại ở `base` → `catch { before = 0 }` (`:157-158`).
→ `:161` `if (now > before)` với `before=0, now=5` → violation → sau flip là **exit 1** (`:200`).
→ `.github/workflows/quality.yml:47-55` — `git diff --diff-filter=ACMR` **bao gồm R (rename)**; nhánh chưa rebase còn kéo file PR khác đã merge → thêm false-positive.
→ Header `:20-22` "promote to HARD after 2026-08-01 **if no false positives**" — mốc tự động chỉ nhớ *ngày*, không nhớ *điều kiện*. Nó flip theo lịch, bỏ qua vế "nếu".

### Vì sao mọi gate vẫn xanh
Chính commit flip **là** thứ làm gate — không bị gate nào bắt vì nó sửa gate. CI của PR flip xanh (chỉ sửa 1 file .mjs). Cái giá hiện ra ở **PR kế tiếp**, và lúc đó trông như "gate mới bị lỗi" chứ không phải "flip sai thời điểm".

### Vì sao khó sửa
Revert dễ. Nhưng khi agent đã gỡ ratchet, DS-03 mất neo mà không ghi ledger "đã lùi". Phiên sau đọc memory thấy "DS-03 HARD shipped 01/08" — sai sự thật. Sửa code 1 dòng; sửa *hiểu lầm trong memory* mới khó.

### Dấu hiệu sớm lẽ ra phải có
Dry-run Rule 4 HARD trên toàn bộ PR đang mở **trước** khi flip — 5 phút lộ ngay false-positive rename.

---

## Xếp hạng

| # | Sự cố | Xác suất | Khó phát hiện | Ưu tiên |
|---|-------|----------|---------------|---------|
| 1 | QA-04 skip-thành-green, guard tắt âm thầm 3 tuần | cao | **rất cao** | **1** |
| 2 | OPS-04 câm suốt outage vì fingerprint đa dạng | cao | cao | **2** |
| 3 | .tl-btn HARD flip sai thời điểm → ratchet bị gỡ | TB-cao | cao | 3 |

## Rẻ nhất để chặn từ bây giờ

1. **QA-04 (chặn Sự cố 1):** smoke assert số test *executed* ≥ ngưỡng, hoặc bỏ `test.skip(!hasAuthEnv())` ở CI — **fail cứng khi thiếu env trên `main`** (`tests/helpers/supabase-admin.ts:29`). Fail-open chỉ cho local run.
2. **OPS-04 (chặn Sự cố 2):** alert *volume thô* độc lập fingerprint — `scanned` vượt trần (vd 50/10ph) → bắn 1 tin "error volume spike, N errors". Con số có sẵn, chỉ cần nối vào `sendTelegram`.
3. **.tl-btn (chặn Sự cố 3):** trước flip, dry-run Rule 4 HARD trên mọi PR đang mở; sửa `before` cho rename (`git diff --find-renames` lấy path cũ thay vì `before = 0`). Mốc phải là "flip *sau khi* dry-run sạch", không phải "flip vào ngày X".

## Khoảng hở pipeline mà bài này lộ ra

- **Green-check không phân biệt PASS với SKIP.** Cả 3 sự cố khai thác cùng điểm mù meta: *sự vắng mặt của tín hiệu bị đọc là tín hiệu tốt*. Cần một hạng gate mới: **liveness của chính các guard** (test có chạy không, alert có bắn được không, ratchet có còn HARD không).
- **Mốc-theo-ngày nuốt mất mốc-theo-điều-kiện.** Cả 3 mốc tương lai đều có vế "*nếu*" (≥1 tuần RUM, funnel đủ data, không false-positive). Nếu gói ship, mỗi mốc phải mang **cả predicate lẫn ngày**, và predicate phải kiểm-được-bằng-máy trước khi hành động.

Files gốc: `tests/helpers/supabase-admin.ts:29-35`, `tests/auth.spec.ts:78-101`, `.github/workflows/playwright.yml`, `supabase/functions/errors-telegram-alert/index.ts:34,50-54,144-145,193,201`, `scripts/check-theline.mjs:142-167`, `.github/workflows/quality.yml:47-55`.
