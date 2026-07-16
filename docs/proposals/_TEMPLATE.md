# <Tên ý tưởng>

> Slug: `<slug>` · Ngày: `<YYYY-MM-DD>` · Trạng thái: `draft | approved | shipped | rejected`
> Sinh bởi `/idea`. Panel 4 agent: `solution-architect` · `ui-ux-critic` (+GPT-5.6) ·
> `risk-auditor` (+GPT-5.6) · `pre-mortem`. Model ngoài chính xác: xem `external/*.meta.json`.
> Model thiếu key trong lần chạy này: `<none | openai>`
>
> **Raw audit trail** (đọc để kiểm tra bản tổng hợp này có trung thực không):
> `round1/*.md` — output độc lập vòng 1 · `round2/*.json` — đối chất
> `external/*.md` — prompt gửi đi + reply GPT-5.6 (+ `.meta.json` pin model ID) · `debate.json` — ledger

---

## 0. 🔶 Cần anh quyết

<Bất đồng `OPEN_FOR_CUONG` — panel đã đối chất một vòng và vẫn không thống nhất. Đây là
thứ duy nhất thật sự cần anh, nên nó nằm ở đầu. Trống = panel đồng thuận hoặc mọi bất
đồng đã được giải quyết bằng bằng chứng.>

| # | Vấn đề | Phía A | Phía B | Nếu chọn sai thì sao |
|---|--------|--------|--------|----------------------|
| D2 | | `<agent>`: | `<agent>`: | |

---

## 1. Ý tưởng gốc

<Nguyên văn Cuong nói, không diễn giải lại.>

**Làm rõ ở bước 0:**

| Hỏi | Trả lời |
|---|---|
| Ai dùng | |
| Đau ở đâu | |
| Thành công = | |
| Ràng buộc | |

---

## 2. Verdict — đọc cái này trước

| | |
|---|---|
| **Rủi ro** | 🟢 GREEN / 🟡 AMBER / 🔴 RED |
| **Khuyến nghị** | Option `<X>` — `<1 câu tại sao>` |
| **Công sức** | `<n>` nửa ngày (1 người) |
| **Rủi ro lớn nhất** | `<1 câu>` |
| **Auto-merge** | Được sau khi qua gate / **Chặn — cần Cuong duyệt** |

🔴 RED nghĩa là: **không revert được bằng `git revert`.** Migration, native build, push đã gửi, Worker đã deploy. Pipeline dừng ở đây và đợi anh.

---

## 3. Đã có sẵn gì (recon)

<Từ `idea-recon`. Nếu đã tồn tại phần lớn → nói ngay ở dòng đầu.>

**Prior art:**

**Sẽ đụng vào:**

**Ràng buộc đã ghi trong repo:**

---

## 4. Phương án (solution-architect)

### Option A — <tên>

Effort: `<n>` nửa ngày · Files: `<paths>` · Data: `<migration / RLS / none>`

Cách hoạt động:

Được: · Mất: · Đóng cửa gì về sau:

### Option B — <tên, bản rẻ>

### Option C — <chỉ khi thực sự khác>

### Khuyến nghị

<Một option. Lý do cụ thể các option kia thua. Không có bảng-so-sánh-không-kết-luận.>

### Increments

1. `<lát đầu tiên ship được>` — verify bằng `<check>`
2. …

---

## 5. UI/UX (ui-ux-critic + GPT-5.6)

### Đánh giá tổng thể

### Luồng người dùng

<entry → task → exit. Nhớ: user thường vào thẳng deep link từ Facebook, không đi qua trang chủ.>

### Vấn đề

| # | Mức | Vấn đề | Sửa |
|---|-----|--------|-----|
| 1 | Blocker / Nên sửa / Nit | | |

### Trạng thái màn hình

- **Empty:** VI `` / EN ``
- **Loading:** <skeleton hay spinner, lý do>
- **Error:** VI `` / EN ``
- **Offline:** <PWA + Capacitor>

### Accessibility (WCAG 2.1 AA)

### Copy (VI / EN)

### Panel đa model

- Claude + GPT-5.6 đồng thuận:
- Bất đồng: <cả hai phía, ai thắng, tại sao>

---

## 6. Rủi ro (risk-auditor + GPT-5.6 + pre-mortem)

### Verdict: 🟢/🟡/🔴

Classifier đường dẫn nói: `<tier>` · Auditor nâng lên `<tier>` vì `<lý do>` *(nếu có)*

| # | Mức | Cơ chế hỏng | User thấy gì | Giảm thiểu |
|---|-----|-------------|--------------|------------|
| 1 | | | | |

### SLO bị đe doạ

<`docs/slo.md`. SLO 4 (scoring): mất một slot bracket = **incident**, không phải tỉ lệ.>

### Perf

- Bundle: +`<n>` KB → `<total>` / **1970 KB** (còn ~20 KB headroom)
- Vietnam p75: <LCP/INP/CLS impact — số global GA4 bị bot Mỹ làm nhiễu, đừng tin>

### SEO

- Route SSR bị đụng: <hoặc "không">
- Bump `pr:v26`? <yes/no + lý do>
- Verify: `curl -A "Googlebot" https://www.thepicklehub.net/<path>` → 200 + title + og:image + hreflang en/vi/x-default

### Rollback

- Cơ chế: <git revert / migration down / feature flag / app-store>
- Thời gian khôi phục:
- **Không revert được:** <đây là thứ quyết định RED>

### Phản biện độc lập (GPT-5.6 — vendor khác, không thấy repo)

- Đã xác minh trong repo:
- Bác bỏ (GPT-5.6 nói nhưng sai):

---

## 7. Tranh luận trong panel

> Vòng 1 độc lập → vòng 2 đối chất (một vòng). **Đồng thuận không phải mục tiêu.**
> Bất đồng còn mở, được ghi rõ, là kết quả hợp lệ — nó lên mục 0.
> Luật: chỉ đổi lập trường khi trích được file/dòng chưa thấy ở vòng 1.
> Cưỡng chế bởi `debate-ledger.mjs`, không bởi lòng tin.

<Dán bảng từ: node scripts/agents/debate-ledger.mjs docs/proposals/<slug>/debate.json --markdown>

### Bất đồng bị giết ở vòng 2 (ảo — do thiếu thông tin)

<Ai CONCEDE, vì thấy file gì. Đây là phần vòng 2 làm tốt việc của nó.>

### Bất đồng sống sót (thật — cùng dữ kiện, khác đánh giá)

<Cả hai HOLD. Lên mục 0. Điều gì sẽ chứng minh phía kia đúng?>

### Nhượng bộ bị LOẠI

<`debate-ledger.mjs` bắt được agent nào CONCEDE không bằng chứng. Trống là tốt.
Có tên ở đây nghĩa là agent đó đã định nhượng bộ vì áp lực chứ không vì dữ kiện —
đáng để anh biết, vì nó nói lên chất lượng của cả phần phân tích còn lại.>

---

## 8. Kế hoạch verify

**Tự động:**

- [ ] `npx eslint <changed>`
- [ ] `node scripts/check-theline.mjs <changed tsx>`
- [ ] `npx tsc -b --noEmit`
- [ ] `npm run test`
- [ ] `npm run build` + `check-bundle-size.mjs`
- [ ] `npm run e2e:smoke`
- [ ] `BASE_URL=<preview> ./scripts/seo-verify.sh`
- [ ] Post-deploy: `/`, `/feed`, Googlebot `<route>`

**Cuong phải tự làm (agent không làm được):**

- [ ] <kiểm tra trên điện thoại thật>
- [ ] <flow login/thanh toán>
- [ ] <GSC request indexing>

---

## 9. Sau khi ship

- SHA: · PR: · Ngày:
- Khác kế hoạch:
- Học được (→ append `.claude/memory/lessons-learned.md`):
