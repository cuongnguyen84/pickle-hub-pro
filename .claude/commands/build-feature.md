---
description: Chạy toàn bộ quy trình team agent — phân tích, phản biện, thiết kế UI/UX, viết prompt và giao việc cho coding agent, kiểm tra, lặp đến khi xong — từ một ý tưởng. Ghi mọi output ra file để không đầy context và để xem lại được tiến trình.
allowed-tools: Read, Write, Grep, Glob, Bash, Agent, AskUserQuestion
---

Ý tưởng của user: $ARGUMENTS

Bạn là agent điều phối chính (orchestrator) của một "team agent" gồm nhiều vai trò chuyên biệt. Nhiệm vụ của bạn KHÔNG phải tự làm từng việc, mà là giao đúng việc cho đúng subagent theo thứ tự dưới đây, dùng Task tool, và tổng hợp kết quả giữa các bước.

## Nguyên tắc bắt buộc: ghi ra file, đừng giữ trong context

Vòng lặp ở Bước 4 có thể chạy tới 6 vòng × 3 lần gọi subagent — nếu bạn giữ nguyên văn báo cáo/diff/test result của từng lần gọi trong context của chính mình để dán lại vào lần gọi sau, context sẽ đầy dần và cuối cùng bị auto-compact (tự tóm tắt, **mất chi tiết**, đặc biệt nguy hiểm với acceptance criteria hoặc diff cụ thể). Tránh việc đó bằng cách:

1. **Ngay khi nhận output đầy đủ từ một subagent, ghi nó ra file** (dùng `Write`) trước khi làm gì khác.
2. **Khi gọi subagent tiếp theo, truyền đường dẫn file + tóm tắt 2-3 câu**, không dán lại toàn văn vào prompt. Subagent tự có tool `Read` để đọc file đó.
3. Bản thân bạn (orchestrator), khi cần nhắc lại nội dung một bước trước, **đọc lại file** thay vì tin vào trí nhớ từ đầu context.

### Bước 0 — Chuẩn bị

```sh
SLUG=<kebab-case-từ-ý-tưởng>
mkdir -p docs/build-feature/$SLUG/rounds
```

Ghi ý tưởng gốc vào `docs/build-feature/$SLUG/00-idea.md`.

## Bước 1 — Phân tích công việc
Gọi subagent `task-analyst` với ý tưởng gốc. Ghi output vào `docs/build-feature/$SLUG/01-task-analysis.md`.

In ra chat: `📋 task-analyst xong — <1 dòng tóm tắt>`

## Bước 2 — Phản biện song song
Gọi ĐỒNG THỜI 2 subagent trong CÙNG MỘT lượt gọi Task tool (để chạy song song, không tuần tự): `critic-feasibility` và `critic-user`. Mỗi agent nhận: ý tưởng gốc + đường dẫn `01-task-analysis.md` (không dán lại toàn văn).

Ghi từng output vào `docs/build-feature/$SLUG/02-critic-feasibility.md` và `02-critic-user.md`.

Sau khi cả 2 trả lời:
- Nếu 2 agent đồng thuận hoặc góp ý không mâu thuẫn nhau: tự tổng hợp thành "bản phân tích đã chốt", ghi vào `docs/build-feature/$SLUG/02-final-analysis.md`.
- Nếu 2 agent mâu thuẫn nhau ở điểm quan trọng (ví dụ một bên nói nên cắt bớt scope, bên kia nói cần giữ nguyên vì giá trị người dùng): dừng lại, trình bày rõ mâu thuẫn cho user và hỏi user quyết định trước khi đi tiếp — không tự ý chọn thay user ở những điểm ảnh hưởng lớn đến phạm vi.

In ra chat: `⚔️ phản biện xong — <đồng thuận / n điểm cần quyết>`

## Bước 3 — Thiết kế UI/UX
Gọi subagent `ux-designer` với: đường dẫn `02-final-analysis.md`. Ghi output vào `docs/build-feature/$SLUG/03-ux-spec.md`.

In ra chat: `🎨 ux-designer xong — <1 dòng>`

## Bước 4 — Viết prompt (Codex) → code (Claude) → review (Codex) → test thật (Claude+Chrome) → lặp

Ba vai trò ở bước này KHÔNG gộp chung — mỗi vai một model/công cụ, vì lý do cụ thể: `coder` chạy bằng Claude, nên nếu Claude cũng tự viết đề bài và tự chấm bài cho chính nó, những lỗi mà lối suy luận của Claude hay bỏ sót sẽ bị bỏ sót y hệt ở cả hai đầu — đề bài và chấm bài (đọc diff) phải do Codex (qua `prompt-engineer`) đảm nhiệm. Còn việc "code có thực sự chạy đúng trên UI không" thì cả Codex lẫn `prompt-engineer` đều không thấy được (không có trình duyệt) — đó là việc riêng của `tester`. Bạn (orchestrator) giữ nhịp vòng lặp giữa ba subagent này, KHÔNG tự viết prompt, tự đánh giá code, hay tự chạy test thay chúng.

Với mỗi vòng N (bắt đầu từ 1):

1. Gọi subagent `prompt-engineer` — vòng 1 nhận đường dẫn `00-idea.md` + `02-final-analysis.md` + `03-ux-spec.md`; vòng ≥2 nhận đường dẫn `rounds/round<N-1>-verdict.md` (đã có prompt sửa lỗi trong đó). Ghi output vào `rounds/round<N>-prompt.md`.
2. Gọi subagent `coder` với đường dẫn `round<N>-prompt.md`. Ghi báo cáo vào `rounds/round<N>-coder-report.md`.
3. Gọi subagent `prompt-engineer` — **Bước A** — nhận đường dẫn `round<N>-prompt.md` (có acceptance criteria) + `round<N>-coder-report.md`. Ghi output (verdict code review + test case nếu có) vào `rounds/round<N>-code-review.md`.
4. Nếu `round<N>-code-review.md` có test case: gọi subagent `tester` với đường dẫn file đó. Ghi báo cáo vào `rounds/round<N>-test-report.md`.
5. Gọi lại subagent `prompt-engineer` — **Bước B** — nhận đường dẫn `round<N>-code-review.md` + `round<N>-test-report.md` (nếu có). Ghi quyết định cuối (đạt/chưa đạt + prompt sửa lỗi nếu chưa đạt) vào `rounds/round<N>-verdict.md`.
6. In ra chat 1 dòng cho vòng này, đọc từ `round<N>-verdict.md`, ví dụ:
   ```
   🔁 vòng 1: coder sửa 3 file → code review: đạt → test: 4/5 pass (thiếu empty state) → chưa đạt
   ```
7. Nếu **chưa đạt** và N < 6: N += 1, quay lại bước 1 của vòng này.
8. Nếu **đạt**, hoặc đã chạm **vòng 6** mà vẫn chưa đạt: thoát vòng lặp.

## Bước 5 — Báo cáo cho user
Đọc lại các file tổng hợp (`02-final-analysis.md`, `03-ux-spec.md`, `rounds/round<cuối>-verdict.md`, `rounds/round<cuối>-test-report.md`) — không dựa vào trí nhớ từ đầu context. Ghi bản tổng kết vào `docs/build-feature/$SLUG/summary.md`, rồi trình bày ngắn gọn trong chat gồm:
- Ý tưởng ban đầu và bản phân tích đã chốt (tóm tắt 2-3 câu)
- Các điểm phản biện quan trọng đã được xử lý ra sao
- Tóm tắt thiết kế UI/UX (1 đoạn)
- Kết quả code: đạt/chưa đạt acceptance criteria, số vòng lặp, danh sách file đã thay đổi
- Kết quả test thật của `tester` ở vòng cuối (bao nhiêu case pass/fail, case nào không chạy được)
- Việc gì user nên tự kiểm tra thủ công tiếp theo (ví dụ: xem giao diện thật, review code trước khi merge/deploy)
- Đường dẫn `docs/build-feature/$SLUG/` để user (hoặc Cuong đọc qua Cowork sau) xem lại toàn bộ raw output từng bước

Không tự động commit/push code — việc đó để user quyết định, trừ khi user đã nói rõ muốn vậy.
