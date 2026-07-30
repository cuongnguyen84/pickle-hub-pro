---
description: Thực thi một proposal đã duyệt → branch, code, verify loop, PR, deploy, post-deploy smoke, auto-revert
argument-hint: <proposal-slug> [--option A|B|C]
allowed-tools: Read, Write, Edit, Grep, Glob, Bash, Agent, AskUserQuestion
---

# /ship — proposal đã duyệt thành production

Proposal: **$ARGUMENTS**

## Bước 0 — Đọc và kiểm tra tư cách

1. Đọc `docs/proposals/<slug>.md`. Không có file → dừng, bảo Cuong chạy `/idea` trước.
2. Đọc mục **Verdict rủi ro**.
   - **🔴 RED** → dừng ngay. Kiểm tra Cuong đã duyệt tường minh cho *chính thay đổi này* chưa. Chưa có → hỏi, rồi đợi. "Anh ấy chạy /ship nghĩa là đồng ý" **không phải** là duyệt — Cuong có thể chưa đọc mục rủi ro. RED nghĩa là không revert được; đoán sai ở đây không có đường lùi.
   - 🟡 AMBER / 🟢 GREEN → đi tiếp.
3. Xác nhận phương án (A/B/C). Proposal khuyến nghị một cái; nếu Cuong không nói rõ, dùng cái đó và nói ra bạn đang dùng cái nào.

## Bước 1 — Branch

```sh
git switch main && git pull
git switch -c feat/<slug>
```

Không bao giờ code trên `main`. Không đụng `*.legacy.tsx`. Không đụng PR #114–#122 (DUPR).

## Bước 2 — Code

Theo mục "Increments" của proposal, từng lát một. Sau mỗi lát, chạy vòng verify — đừng code hết ba lát rồi mới chạy test lần đầu; lúc đó bạn không còn biết lát nào làm gãy.

Bám sát pattern của các file xung quanh. Đây là codebase của một người; nhất quán quan trọng hơn hay ho.

Text người dùng thấy → VI **và** EN, ngay từ đầu.

Route công khai mới → trả lời cả ba câu: handler trong `functions/_lib/render/`? vào sitemap nào? cặp hreflang ra sao?

## Bước 3 — Vòng verify

Gọi agent `qa-verifier`. Nó chạy lint → TheLine → typecheck (`tsc -b`) → vitest → build → bundle budget → e2e → seo-verify, tự sửa, tối đa 5 vòng.

Nó báo đỏ và bí → **dừng**, đưa chẩn đoán cho Cuong. Đừng tự đi đường vòng qua guardrail mà nó vừa đâm phải; guardrail đó ở đó là có lý do.

## Bước 3b — Nhìn sản phẩm thật (nếu user-facing)

`qa-verifier` chứng minh code **chạy**. Nó không chứng minh cái build ra là cái Cuong duyệt.

Push branch → đợi preview deploy → gọi agent `ui-ux-verifier` với preview URL + proposal.
Nó chụp màn hình (mobile trước), đọc console error trong `manifest.json`, đối chiếu với
mục UI/UX của proposal.

**FAIL → không merge.** Ngang một check đỏ. Đừng bỏ qua vì CI xanh — CI xanh chứng minh
code chạy, không chứng minh nút bấm được, chữ tiếng Việt không tràn nút, hay cái empty
state đã duyệt có thật sự tồn tại. Những thứ đó ship im lặng và CI vỗ tay.

## Bước 4 — Release

Gọi agent `release-pilot`. Nó: PR → watch CI → verify preview → **baseline lỗi** → merge →
watch deploy → smoke production → **soak 30 phút** → **tự revert nếu smoke hoặc soak đỏ**.

Nó từ chối merge → tôn trọng. Nó là gate cuối; đè nó chính là gỡ bỏ lý do khiến "auto to prod"
chấp nhận được.

## Bước 5 — Đóng sổ

1. Cập nhật `docs/proposals/<slug>.md`: shipped, SHA, ngày, những gì khác với kế hoạch.
2. Học được gì đau đớn → append vào `.claude/memory/lessons-learned.md`. Đây là file khiến agent lần sau không lặp lại lỗi lần này; bỏ qua nó là vứt đi thứ duy nhất tích luỹ được.
3. Báo Cuong, ngắn:

```
🚀 <slug> — shipped
PR: <url> · SHA: <sha>
UI/UX verify: <PASS/PASS-với-ghi-chú>
Post-deploy: / <code> · /feed <code> · Googlebot <route> <code>
Soak 30p: 🟢 0 signature mới
Khác kế hoạch: <nếu có>

Chưa chứng minh: soak sạch = 30 phút không có gì ném exception, KHÔNG phải
là feature dùng tốt. Anh cần tự nhìn: <route cụ thể, trên điện thoại>
Cần anh làm tay: <GSC indexing, ...>
```

Đừng để dòng "Soak 30p 🟢" nói hộ một điều nó không nói. Nó chứng minh không có gì
gãy to. Không ai — kể cả nó — chứng minh có người dùng được tính năng này.

## Không bao giờ

- Merge khi có check đỏ hoặc check bị skip. Check không chạy ≠ check pass.
- Merge RED chưa được duyệt tường minh.
- Nâng `BUNDLE_BUDGET_KB` để build pass.
- Xoá/skip test để green.
- `verify_jwt = true` trên function user-facing (401 toàn bộ user — CLAUDE.md).
- `supabase db push --include-all`.
- Sửa file trong `.github/workflows/` để qua CI.
- Apply migration lên prod mà không có Cuong.
- Báo "xong" cho thứ chưa chạy qua.
